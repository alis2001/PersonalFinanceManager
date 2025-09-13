const authService = require('../services/authService');
const { generateTokens, verifyToken, formatUserResponse } = require('../utils/token');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class AuthController {
  async register(req, res) {
    try {
      const { 
        email, 
        password, 
        confirmPassword,
        firstName, 
        lastName, 
        accountType,
        companyName,
        acceptTerms,
        marketingConsent 
      } = req.validatedData;
      
      // Create new user with email verification
      const result = await authService.createUser({
        email,
        password,
        firstName,
        lastName,
        accountType,
        companyName,
        acceptTerms,
        marketingConsent,
        ipAddress: req.ip
      });
      
      logger.info(`User registration initiated: ${email}`);
      
      res.status(201).json({
        message: 'Registration successful. Please check your email for verification instructions.',
        user: result.user,
        requiresVerification: result.requiresVerification,
        verificationSent: result.verificationSent
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error.message === 'User already exists with this email address') {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }

  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.validatedData;
      
      // Find user
      const user = await authService.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Check if email is verified
      if (!user.email_verified && user.status === 'pending_verification') {
        return res.status(403).json({ 
          error: 'Email verification required',
          message: 'Please verify your email address before logging in',
          requiresVerification: true,
          email: user.email
        });
      }
      
      // Check if user is active
      if (!authService.isUserActive(user)) {
        return res.status(403).json({ error: 'Account is not active. Please contact support.' });
      }
      
      // Validate password
      const passwordValid = await authService.validateUserPassword(user, password);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Generate tokens
      const tokens = generateTokens(user);
      const sessionExpiry = rememberMe 
        ? new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
        : new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

      // Store refresh token
      await authService.storeRefreshToken(user.id, tokens.refreshToken, sessionExpiry);
      
      // Update last login
      await authService.updateLastLogin(user.id, req.ip, req.get('User-Agent'));
      
      logger.info(`User logged in: ${email}`);
      
      res.json({
        message: 'Login successful',
        user: formatUserResponse(user),
        tokens,
        expiresAt: sessionExpiry
      });
      
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { token, code } = req.body;
      
      if (!token && !code) {
        return res.status(400).json({ error: 'Verification token or code is required' });
      }

      const result = await authService.verifyEmail({ token, code });
      
      logger.info(`Email verified successfully for user: ${result.user.email}`);
      
      res.json({
        message: result.message,
        user: result.user,
        tokens: result.tokens,
        verificationSuccess: result.verificationSuccess
      });
      
    } catch (error) {
      logger.error('Email verification error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Email verification failed. Please try again.' });
    }
  }

  async resendVerification(req, res) {
    try {
      const { email } = req.validatedData;
      
      const result = await authService.resendVerificationEmail(email);
      
      logger.info(`Verification email resent to: ${email}`);
      
      res.json({
        message: result.message,
        verificationSent: result.verificationSent
      });
      
    } catch (error) {
      logger.error('Resend verification error:', error);
      
      if (error.message.includes('User not found') || error.message.includes('already verified')) {
        return res.status(400).json({ error: error.message });
      }
      
      if (error.message.includes('rate limit') || error.message.includes('limited')) {
        return res.status(429).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to resend verification email. Please try again.' });
    }
  }

  async requestPasswordReset(req, res) {
    try {
      const { email } = req.validatedData;
      
      const result = await authService.requestPasswordReset(email, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      logger.info(`Password reset requested for: ${email}`);
      
      res.json({
        message: result.message,
        resetSent: result.resetSent
      });
      
    } catch (error) {
      logger.error('Password reset request error:', error);
      
      if (error.message.includes('rate limit') || error.message.includes('limited')) {
        return res.status(429).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to process password reset request. Please try again.' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password, confirmPassword } = req.validatedData;
      
      // Find user with valid reset token
      const user = await authService.findUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Update password
      const result = await authService.resetPassword(user.id, password);
      
      if (result.success) {
        logger.info(`Password reset successful for user: ${user.email}`);
        
        res.json({
          message: 'Password reset successful. You can now log in with your new password.',
          success: true
        });
      } else {
        throw new Error('Password reset failed');
      }
      
    } catch (error) {
      logger.error('Password reset error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Password reset failed. Please try again.' });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.validatedData;
      
      // Verify refresh token
      const decoded = verifyToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }
      
      // Check if refresh token exists in Redis
      const storedToken = await authService.getRefreshToken(decoded.userId);
      if (storedToken !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }
      
      // Get user data
      const user = await authService.findUserById(decoded.userId);
      if (!user || !authService.isUserActive(user)) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }
      
      // Generate new tokens
      const tokens = generateTokens(user);
      const sessionExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
      
      // Store new refresh token
      await authService.storeRefreshToken(user.id, tokens.refreshToken, sessionExpiry);
      
      res.json({ 
        tokens,
        expiresAt: sessionExpiry
      });
      
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  async logout(req, res) {
    try {
      // Remove refresh token from Redis
      await authService.deleteRefreshToken(req.user.userId);
      
      logger.info(`User logged out: ${req.user.email}`);
      
      res.json({ message: 'Logout successful' });
      
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await authService.findUserById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        user: formatUserResponse(user)
      });
      
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  }

  async verifyToken(req, res) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(403).json({ 
          valid: false, 
          error: 'Invalid token' 
        });
      }
      
      // Verify user still exists and is active
      const user = await authService.findUserById(decoded.userId);
      if (!user || !authService.isUserActive(user)) {
        return res.status(403).json({ 
          valid: false, 
          error: 'User not found or inactive' 
        });
      }
      
      res.json({ 
        valid: true, 
        user: { 
          userId: decoded.userId, 
          email: decoded.email,
          verified: decoded.verified
        } 
      });
      
    } catch (error) {
      logger.error('Token verification error:', error);
      res.status(500).json({ 
        valid: false, 
        error: 'Token verification failed' 
      });
    }
  }

  // Health check endpoint
  async health(req, res) {
    try {
      // Test database connection
      await authService.findUserById('00000000-0000-0000-0000-000000000000');
      
      res.json({
        status: 'healthy',
        service: 'Auth Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
          registration: true,
          emailVerification: true,
          passwordReset: true,
          jwtTokens: true,
          refreshTokens: true
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'Auth Service',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new AuthController();