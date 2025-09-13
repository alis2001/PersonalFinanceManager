const { db, redisClient } = require('../config/database');
const { hashPassword, comparePassword, generateTokens, verifyToken } = require('../utils/token');
const emailService = require('./EmailService');
const crypto = require('crypto');
const winston = require('winston');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { 
  ACCOUNT_TYPES, 
  USER_STATUSES, 
  VERIFICATION_TYPES, 
  SECURITY_SETTINGS,
  normalizeEmail 
} = require('../models/auth');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class AuthService {
  constructor() {
    this.maxLoginAttempts = SECURITY_SETTINGS.MAX_LOGIN_ATTEMPTS;
    this.lockDuration = SECURITY_SETTINGS.ACCOUNT_LOCK_DURATION;
    this.emailVerificationExpiry = SECURITY_SETTINGS.EMAIL_VERIFICATION_EXPIRY;
    this.loginVerificationExpiry = SECURITY_SETTINGS.LOGIN_VERIFICATION_EXPIRY;
    this.passwordResetExpiry = SECURITY_SETTINGS.PASSWORD_RESET_EXPIRY;
  }

  // User registration with email verification
  async registerUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      accountType = ACCOUNT_TYPES.PERSONAL,
      companyName,
      acceptTerms,
      marketingConsent = false
    } = userData;

    const normalizedEmail = normalizeEmail(email);
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await this.findUserByEmail(normalizedEmail);
      if (existingUser) {
        throw new Error('User already exists with this email address');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Generate verification tokens
      const emailVerificationToken = this.generateSecureToken();
      const emailVerificationCode = this.generateNumericCode(6);
      const emailVerificationExpires = new Date(Date.now() + this.emailVerificationExpiry);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, account_type, company_name,
          status, email_verification_token, email_verification_expires
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING id, email, first_name, last_name, account_type, company_name, status, created_at`,
        [
          normalizedEmail, passwordHash, firstName, lastName, accountType, 
          companyName || null, USER_STATUSES.PENDING_VERIFICATION,
          emailVerificationToken, emailVerificationExpires
        ]
      );

      const user = userResult.rows[0];

      // Store verification record
      await client.query(
        `INSERT INTO email_verifications (
          user_id, email, verification_type, verification_token, expires_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          user.id, normalizedEmail, VERIFICATION_TYPES.EMAIL_VERIFICATION,
          emailVerificationCode, emailVerificationExpires
        ]
      );

      // Store user preferences/consent
      await this.storeUserConsent(client, user.id, {
        termsAccepted: acceptTerms,
        marketingConsent,
        acceptedAt: new Date(),
        ipAddress: userData.ipAddress || null
      });

      await client.query('COMMIT');

      // Send verification email (async)
      this.sendVerificationEmailAsync(user, emailVerificationToken, emailVerificationCode);

      logger.info('User registered successfully', {
        userId: user.id,
        email: normalizedEmail,
        accountType
      });

      return {
        user: this.formatUserResponse(user),
        requiresVerification: true,
        verificationSent: true
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('User registration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Enhanced login with verification support
  async loginUser(credentials, loginDetails = {}) {
    const { email, password, verificationCode, rememberMe = false } = credentials;
    const { ipAddress, userAgent } = loginDetails;
    const normalizedEmail = normalizeEmail(email);

    try {
      // Find user
      const user = await this.findUserByEmail(normalizedEmail);
      if (!user) {
        // Prevent user enumeration
        await this.simulatePasswordCheck();
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (await this.isAccountLocked(user.id)) {
        throw new Error('Account is temporarily locked due to too many failed login attempts');
      }

      // Validate password
      const passwordValid = await comparePassword(password, user.password_hash);
      if (!passwordValid) {
        await this.recordFailedLoginAttempt(user.id, ipAddress);
        throw new Error('Invalid email or password');
      }

      // Check if email is verified
      if (!user.email_verified && user.status === USER_STATUSES.PENDING_VERIFICATION) {
        return {
          requiresEmailVerification: true,
          message: 'Please verify your email address before logging in'
        };
      }

      // Check if user is active
      if (!this.isUserActive(user)) {
        throw new Error('Account is not active. Please contact support.');
      }

      // Check if login verification is required
      const requiresLoginVerification = await this.shouldRequireLoginVerification(user, loginDetails);
      
      if (requiresLoginVerification && !verificationCode) {
        // Send login verification code
        const loginVerificationCode = this.generateNumericCode(6);
        const expiresAt = new Date(Date.now() + this.loginVerificationExpiry);
        
        // Store verification code
        await this.storeLoginVerification(user.id, loginVerificationCode, expiresAt);
        
        // Send verification email
        await emailService.sendLoginVerification(user, loginVerificationCode, loginDetails);
        
        return {
          requiresLoginVerification: true,
          message: 'Please check your email for a verification code',
          sessionToken: this.generateTemporarySessionToken(user.id, normalizedEmail)
        };
      }

      // Verify login verification code if provided
      if (verificationCode) {
        const verificationValid = await this.verifyLoginCode(user.id, verificationCode);
        if (!verificationValid) {
          throw new Error('Invalid or expired verification code');
        }
        
        // Clear login verification
        await this.clearLoginVerification(user.id);
      }

      // Reset failed attempts on successful login
      await this.clearFailedLoginAttempts(user.id);

      // Generate authentication tokens
      const tokens = generateTokens(user);
      const sessionExpiry = rememberMe 
        ? new Date(Date.now() + SECURITY_SETTINGS.REFRESH_TOKEN_EXPIRY)
        : new Date(Date.now() + SECURITY_SETTINGS.SESSION_TIMEOUT);

      // Store refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken, sessionExpiry);

      // Update last login
      await this.updateLastLogin(user.id, ipAddress, userAgent);

      // Log successful login
      await this.logSecurityEvent(user.id, 'login_success', {
        ipAddress,
        userAgent,
        rememberMe,
        verificationCodeUsed: !!verificationCode
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        email: normalizedEmail,
        ipAddress
      });

      return {
        user: this.formatUserResponse(user),
        tokens,
        expiresAt: sessionExpiry,
        loginSuccess: true
      };

    } catch (error) {
      logger.error('Login attempt failed:', {
        email: normalizedEmail,
        ipAddress,
        error: error.message
      });
      throw error;
    }
  }

  // Email verification
  async verifyEmail(verificationData) {
    const { token, code } = verificationData;

    try {
      let user;
      let verificationRecord;

      if (token) {
        // Verify by token (URL-based verification)
        user = await db.query(
          'SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
          [token]
        );

        if (user.rows.length === 0) {
          throw new Error('Invalid or expired verification token');
        }

        user = user.rows[0];
      } else if (code) {
        // Verify by code (manual code entry)
        verificationRecord = await db.query(
          `SELECT ev.*, u.* FROM email_verifications ev 
           JOIN users u ON ev.user_id = u.id 
           WHERE ev.verification_token = $1 
           AND ev.verification_type = $2 
           AND ev.expires_at > NOW() 
           AND ev.verified_at IS NULL`,
          [code, VERIFICATION_TYPES.EMAIL_VERIFICATION]
        );

        if (verificationRecord.rows.length === 0) {
          throw new Error('Invalid or expired verification code');
        }

        user = verificationRecord.rows[0];
      } else {
        throw new Error('Verification token or code is required');
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // Update user as verified
        await client.query(
          `UPDATE users SET 
           email_verified = true, 
           email_verified_at = NOW(), 
           status = $1,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
           WHERE id = $2`,
          [USER_STATUSES.ACTIVE, user.id]
        );

        // Mark verification record as completed
        if (verificationRecord) {
          await client.query(
            'UPDATE email_verifications SET verified_at = NOW(), updated_at = NOW() WHERE id = $1',
            [verificationRecord.rows[0].id]
          );
        }

        await client.query('COMMIT');

        // Get updated user
        const updatedUser = await this.findUserById(user.id);

        // Send welcome email
        await emailService.sendWelcomeEmail(updatedUser);

        // Generate tokens for immediate login
        const tokens = generateTokens(updatedUser);
        const sessionExpiry = new Date(Date.now() + SECURITY_SETTINGS.SESSION_TIMEOUT);
        await this.storeRefreshToken(user.id, tokens.refreshToken, sessionExpiry);

        // Log verification success
        await this.logSecurityEvent(user.id, 'email_verified', {
          verificationType: token ? 'token' : 'code'
        });

        logger.info('Email verified successfully', {
          userId: user.id,
          email: user.email
        });

        return {
          user: this.formatUserResponse(updatedUser),
          tokens,
          verificationSuccess: true,
          message: 'Email verified successfully! You are now logged in.'
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  // Password reset request
  async requestPasswordReset(email, requestDetails = {}) {
    const normalizedEmail = normalizeEmail(email);
    const { ipAddress } = requestDetails;

    try {
      const user = await this.findUserByEmail(normalizedEmail);
      if (!user) {
        // Don't reveal if user exists
        logger.info('Password reset requested for non-existent email', { email: normalizedEmail });
        return { message: 'If an account exists with this email, you will receive reset instructions.' };
      }

      // Check rate limiting
      const canSendReset = await this.checkPasswordResetRateLimit(user.id);
      if (!canSendReset) {
        throw new Error('Password reset requests are limited. Please try again later.');
      }

      // Generate reset token
      const resetToken = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + this.passwordResetExpiry);

      // Store reset token
      await db.query(
        `UPDATE users SET 
         verification_token = $1, 
         email_verification_expires = $2,
         updated_at = NOW()
         WHERE id = $3`,
        [resetToken, expiresAt, user.id]
      );

      // Log reset request
      await this.logSecurityEvent(user.id, 'password_reset_requested', {
        ipAddress,
        expiresAt
      });

      // Send reset email
      await emailService.sendPasswordReset(user, resetToken, requestDetails);

      logger.info('Password reset requested', {
        userId: user.id,
        email: normalizedEmail,
        ipAddress
      });

      return { 
        message: 'If an account exists with this email, you will receive reset instructions.',
        resetSent: true 
      };

    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  // Resend verification email
  async resendVerificationEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    try {
      const user = await this.findUserByEmail(normalizedEmail);
      if (!user || user.email_verified) {
        throw new Error('User not found or already verified');
      }

      // Check rate limiting
      const canResend = await this.checkEmailVerificationRateLimit(user.id);
      if (!canResend) {
        throw new Error('Verification emails are limited. Please try again later.');
      }

      // Generate new tokens
      const emailVerificationToken = this.generateSecureToken();
      const emailVerificationCode = this.generateNumericCode(6);
      const expiresAt = new Date(Date.now() + this.emailVerificationExpiry);

      // Update verification token
      await db.query(
        `UPDATE users SET 
         email_verification_token = $1, 
         email_verification_expires = $2,
         updated_at = NOW()
         WHERE id = $3`,
        [emailVerificationToken, expiresAt, user.id]
      );

      // Update verification record
      await db.query(
        `UPDATE email_verifications SET 
         verification_token = $1, 
         expires_at = $2,
         attempts = attempts + 1,
         updated_at = NOW()
         WHERE user_id = $3 AND verification_type = $4 AND verified_at IS NULL`,
        [emailVerificationCode, expiresAt, user.id, VERIFICATION_TYPES.EMAIL_VERIFICATION]
      );

      // Send verification email
      await emailService.sendEmailVerification(user, emailVerificationToken, emailVerificationCode);

      logger.info('Verification email resent', {
        userId: user.id,
        email: normalizedEmail
      });

      return { 
        message: 'Verification email sent successfully',
        verificationSent: true 
      };

    } catch (error) {
      logger.error('Resend verification failed:', error);
      throw error;
    }
  }

  // Helper methods
  async findUserByEmail(email) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw new Error('Database error');
    }
  }

  async findUserById(id) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw new Error('Database error');
    }
  }

  async isAccountLocked(userId) {
    try {
      const result = await db.query(
        'SELECT locked_until FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) return false;

      const lockedUntil = result.rows[0].locked_until;
      return lockedUntil && new Date() < new Date(lockedUntil);
    } catch (error) {
      logger.error('Error checking account lock status:', error);
      return false;
    }
  }

  async recordFailedLoginAttempt(userId, ipAddress = null) {
    try {
      const result = await db.query(
        `UPDATE users SET 
         failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE 
           WHEN failed_login_attempts + 1 >= $1 THEN NOW() + INTERVAL '${this.lockDuration} milliseconds'
           ELSE locked_until 
         END,
         updated_at = NOW()
         WHERE id = $2
         RETURNING failed_login_attempts, locked_until`,
        [this.maxLoginAttempts, userId]
      );

      const { failed_login_attempts, locked_until } = result.rows[0];

      if (locked_until && new Date() < new Date(locked_until)) {
        await this.logSecurityEvent(userId, 'account_locked', {
          failedAttempts: failed_login_attempts,
          lockedUntil: locked_until,
          ipAddress
        });
      }

      return { failedAttempts: failed_login_attempts, lockedUntil: locked_until };
    } catch (error) {
      logger.error('Error recording failed login attempt:', error);
    }
  }

  async clearFailedLoginAttempts(userId) {
    try {
      await db.query(
        `UPDATE users SET 
         failed_login_attempts = 0, 
         locked_until = NULL,
         updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
    } catch (error) {
      logger.error('Error clearing failed login attempts:', error);
    }
  }

  async shouldRequireLoginVerification(user, loginDetails) {
    // Always require verification for first-time logins
    if (!user.last_login) return true;

    // Check if login from new device/location (simplified check)
    const lastLoginDetails = await this.getLastLoginDetails(user.id);
    if (lastLoginDetails && lastLoginDetails.ip_address !== loginDetails.ipAddress) {
      return true;
    }

    // Check if it's been too long since last login
    const daysSinceLastLogin = moment().diff(moment(user.last_login), 'days');
    if (daysSinceLastLogin > 7) return true;

    return false;
  }

  async storeLoginVerification(userId, code, expiresAt) {
    await db.query(
      `UPDATE users SET 
       login_verification_token = $1, 
       login_verification_expires = $2,
       updated_at = NOW()
       WHERE id = $3`,
      [code, expiresAt, userId]
    );
  }

  async verifyLoginCode(userId, code) {
    try {
      const result = await db.query(
        `SELECT id FROM users 
         WHERE id = $1 
         AND login_verification_token = $2 
         AND login_verification_expires > NOW()`,
        [userId, code]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error verifying login code:', error);
      return false;
    }
  }

  async clearLoginVerification(userId) {
    await db.query(
      `UPDATE users SET 
       login_verification_token = NULL, 
       login_verification_expires = NULL,
       updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateNumericCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * 10)];
    }
    return code;
  }

  generateTemporarySessionToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'temp_session',
      exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  async simulatePasswordCheck() {
    // Prevent timing attacks by simulating password check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  isUserActive(user) {
    return user && user.status === USER_STATUSES.ACTIVE && user.email_verified;
  }

  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      accountType: user.account_type,
      companyName: user.company_name,
      status: user.status,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  }

  async sendVerificationEmailAsync(user, token, code) {
    try {
      await emailService.sendEmailVerification(user, token, code);
    } catch (error) {
      logger.error('Failed to send verification email:', error);
    }
  }

  // Additional helper methods for rate limiting, security events, etc.
  async checkEmailVerificationRateLimit(userId) {
    // Implementation for rate limiting email verifications
    return true; // Placeholder
  }

  async checkPasswordResetRateLimit(userId) {
    // Implementation for rate limiting password resets
    return true; // Placeholder
  }

  async logSecurityEvent(userId, eventType, details = {}) {
    // Implementation for logging security events
    logger.info('Security event logged', { userId, eventType, details });
  }

  async storeUserConsent(client, userId, consent) {
    // Store user consent for GDPR compliance
    // Implementation placeholder
  }

  async storeRefreshToken(userId, token, expiresAt) {
    try {
      await redisClient.setEx(
        `refresh_token:${userId}`, 
        Math.floor((expiresAt - Date.now()) / 1000), 
        token
      );
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      throw new Error('Session storage error');
    }
  }

  async getRefreshToken(userId) {
    try {
      return await redisClient.get(`refresh_token:${userId}`);
    } catch (error) {
      logger.error('Error getting refresh token:', error);
      throw new Error('Session storage error');
    }
  }

  async deleteRefreshToken(userId) {
    try {
      await redisClient.del(`refresh_token:${userId}`);
    } catch (error) {
      logger.error('Error deleting refresh token:', error);
      throw new Error('Session storage error');
    }
  }

  async updateLastLogin(userId, ipAddress = null, userAgent = null) {
    try {
      await db.query(
        'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [userId]
      );

      // Store login details in sessions table if provided
      if (ipAddress || userAgent) {
        // Implementation for storing session details
      }
    } catch (error) {
      logger.error('Error updating last login:', error);
    }
  }

  async getLastLoginDetails(userId) {
    // Implementation for getting last login details
    return null; // Placeholder
  }
}

module.exports = new AuthService();