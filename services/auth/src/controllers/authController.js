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
      const { email, password, firstName, lastName } = req.validatedData;
      
      // Check if user already exists
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }
      
      // Create new user
      const user = await authService.createUser({
        email,
        password,
        firstName,
        lastName
      });
      
      // Generate tokens
      const tokens = generateTokens(user);
      
      // Store refresh token
      await authService.storeRefreshToken(user.id, tokens.refreshToken);
      
      logger.info(`User registered: ${email}`);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: formatUserResponse(user),
        tokens
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error.message === 'User already exists with this email') {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.validatedData;
      
      // Find user
      const user = await authService.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check if user is active
      if (!authService.isUserActive(user)) {
        return res.status(403).json({ error: 'Account is not active' });
      }
      
      // Validate password
      const passwordValid = await authService.validateUserPassword(user, password);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate tokens
      const tokens = generateTokens(user);
      
      // Store refresh token
      await authService.storeRefreshToken(user.id, tokens.refreshToken);
      
      // Update last login
      await authService.updateLastLogin(user.id);
      
      logger.info(`User logged in: ${email}`);
      
      res.json({
        message: 'Login successful',
        user: formatUserResponse(user),
        tokens
      });
      
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
      
      // Store new refresh token
      await authService.storeRefreshToken(user.id, tokens.refreshToken);
      
      res.json({ tokens });
      
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
      res.status(500).json({ error: 'Internal server error' });
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
      res.status(500).json({ error: 'Internal server error' });
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
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      res.json({ 
        valid: true, 
        user: { 
          userId: decoded.userId, 
          email: decoded.email 
        } 
      });
      
    } catch (error) {
      logger.error('Token verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new AuthController();