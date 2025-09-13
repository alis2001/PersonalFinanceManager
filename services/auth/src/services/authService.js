const { db, redisClient } = require('../config/database');
const { hashPassword, comparePassword, generateTokens, verifyToken } = require('../utils/token');
const emailService = require('./EmailService');
const emailLogger = require('./EmailLogger');
const emailConfig = require('../config/email');
const crypto = require('crypto');
const winston = require('winston');
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
    this.passwordResetExpiry = SECURITY_SETTINGS.PASSWORD_RESET_EXPIRY;
  }

  // User registration with email verification
  async createUser(userData) {
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

  // Email verification
  async verifyEmail(verificationData) {
    const { token, code } = verificationData;

    try {
      let user;

      if (token) {
        // Verify by token (URL-based verification)
        const userResult = await db.query(
          'SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
          [token]
        );

        if (userResult.rows.length === 0) {
          throw new Error('Invalid or expired verification token');
        }

        user = userResult.rows[0];
      } else if (code) {
        // Verify by code (manual code entry)
        const verificationResult = await db.query(
          `SELECT ev.*, u.* FROM email_verifications ev 
           JOIN users u ON ev.user_id = u.id 
           WHERE ev.verification_token = $1 
           AND ev.verification_type = $2 
           AND ev.expires_at > NOW() 
           AND ev.verified_at IS NULL`,
          [code, VERIFICATION_TYPES.EMAIL_VERIFICATION]
        );

        if (verificationResult.rows.length === 0) {
          throw new Error('Invalid or expired verification code');
        }

        user = verificationResult.rows[0];
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
        if (code) {
          await client.query(
            'UPDATE email_verifications SET verified_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND verification_token = $2',
            [user.id, code]
          );
        }

        await client.query('COMMIT');

        // Get updated user
        const updatedUser = await this.findUserById(user.id);

        // Send welcome email (async)
        this.sendWelcomeEmailAsync(updatedUser);

        // Generate tokens for immediate login
        const tokens = generateTokens(updatedUser);
        const sessionExpiry = new Date(Date.now() + SECURITY_SETTINGS.SESSION_TIMEOUT);
        await this.storeRefreshToken(user.id, tokens.refreshToken, sessionExpiry);

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
        // Don't reveal if user exists - security best practice
        logger.info('Password reset requested for non-existent email', { email: normalizedEmail });
        return { 
          message: 'If an account exists with this email, you will receive reset instructions.',
          resetSent: false 
        };
      }

      // Check rate limiting
      const rateLimit = await this.checkPasswordResetRateLimit(user.id);
      if (rateLimit.isLimitExceeded) {
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

      // Send reset email (async)
      this.sendPasswordResetEmailAsync(user, resetToken, requestDetails);

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

  // MISSING METHOD - Added to fix controller calls
  async findUserByResetToken(token) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE verification_token = $1 AND email_verification_expires > NOW()',
        [token]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by reset token:', error);
      throw new Error('Database error');
    }
  }

  // MISSING METHOD - Added to fix controller calls
  async resetPassword(userId, newPassword) {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Hash the new password
      const passwordHash = await hashPassword(newPassword);

      // Update password and clear reset tokens
      await client.query(
        `UPDATE users SET 
         password_hash = $1,
         verification_token = NULL,
         email_verification_expires = NULL,
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );

      await client.query('COMMIT');

      logger.info('Password reset successfully', { userId });

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Password reset failed:', error);
      throw error;
    } finally {
      client.release();
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
      const rateLimit = await this.checkEmailVerificationRateLimit(user.id);
      if (rateLimit.isLimitExceeded) {
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

      // Send verification email (async)
      this.sendVerificationEmailAsync(user, emailVerificationToken, emailVerificationCode);

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

  // Async email sending methods
  async sendVerificationEmailAsync(user, token, code) {
    try {
      // Log email attempt
      const emailLogId = await emailLogger.logEmailAttempt(
        user.id, 
        user.email, 
        emailLogger.getEmailTypes().EMAIL_VERIFICATION,
        'Email Verification Required'
      );

      // Check rate limit
      const rateLimit = emailConfig.getEmailRateLimit('email_verification');
      const rateLimitCheck = await emailLogger.checkEmailRateLimit(
        user.id, 
        emailLogger.getEmailTypes().EMAIL_VERIFICATION,
        rateLimit.window,
        rateLimit.max
      );

      if (rateLimitCheck.isLimitExceeded) {
        await emailLogger.updateEmailStatus(emailLogId, 'failed', null, 'Rate limit exceeded');
        return;
      }

      // Send email
      const result = await emailService.sendEmailVerification(user, token, code);
      
      if (result.success) {
        await emailLogger.updateEmailStatus(emailLogId, 'sent', result.messageId);
      } else {
        await emailLogger.updateEmailStatus(emailLogId, 'failed', null, result.error);
      }
    } catch (error) {
      logger.error('Failed to send verification email:', error);
    }
  }

  async sendWelcomeEmailAsync(user) {
    try {
      const emailLogId = await emailLogger.logEmailAttempt(
        user.id, 
        user.email, 
        emailLogger.getEmailTypes().WELCOME,
        'Welcome to Finance Tracker'
      );

      const result = await emailService.sendWelcomeEmail(user);
      
      if (result.success) {
        await emailLogger.updateEmailStatus(emailLogId, 'sent', result.messageId);
      } else {
        await emailLogger.updateEmailStatus(emailLogId, 'failed', null, result.error);
      }
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
    }
  }

  async sendPasswordResetEmailAsync(user, token, requestDetails) {
    try {
      const emailLogId = await emailLogger.logEmailAttempt(
        user.id, 
        user.email, 
        emailLogger.getEmailTypes().PASSWORD_RESET,
        'Password Reset Request'
      );

      const result = await emailService.sendPasswordReset(user, token);
      
      if (result.success) {
        await emailLogger.updateEmailStatus(emailLogId, 'sent', result.messageId);
      } else {
        await emailLogger.updateEmailStatus(emailLogId, 'failed', null, result.error);
      }
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
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

  async checkEmailVerificationRateLimit(userId) {
    const rateLimit = emailConfig.getEmailRateLimit('email_verification');
    return await emailLogger.checkEmailRateLimit(
      userId, 
      emailLogger.getEmailTypes().EMAIL_VERIFICATION,
      rateLimit.window,
      rateLimit.max
    );
  }

  async checkPasswordResetRateLimit(userId) {
    const rateLimit = emailConfig.getEmailRateLimit('password_reset');
    return await emailLogger.checkEmailRateLimit(
      userId, 
      emailLogger.getEmailTypes().PASSWORD_RESET,
      rateLimit.window,
      rateLimit.max
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
    } catch (error) {
      logger.error('Error updating last login:', error);
    }
  }

  async validateUserPassword(user, password) {
    return await comparePassword(password, user.password_hash);
  }
}

module.exports = new AuthService();