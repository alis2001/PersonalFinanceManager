const { db, redisClient } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/token');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class AuthService {
  async findUserByEmail(email) {
    try {
      const result = await db.query(
        'SELECT id, email, password_hash, first_name, last_name, status, email_verified, created_at, last_login FROM users WHERE email = $1',
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
        'SELECT id, email, first_name, last_name, status, email_verified, created_at, last_login FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw new Error('Database error');
    }
  }

  async createUser(userData) {
    const { email, password, firstName, lastName } = userData;
    
    try {
      const passwordHash = await hashPassword(password);
      
      const result = await db.query(
        'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at, status, email_verified',
        [email, passwordHash, firstName, lastName]
      );
      
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User already exists with this email');
      }
      logger.error('Error creating user:', error);
      throw new Error('Database error');
    }
  }

  async validateUserPassword(user, password) {
    try {
      return await comparePassword(password, user.password_hash);
    } catch (error) {
      logger.error('Error validating password:', error);
      throw new Error('Authentication error');
    }
  }

  async updateLastLogin(userId) {
    try {
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch (error) {
      logger.error('Error updating last login:', error);
    }
  }

  async storeRefreshToken(userId, token) {
    try {
      await redisClient.setEx(`refresh_token:${userId}`, 7 * 24 * 60 * 60, token);
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

  async isUserActive(user) {
    return user && user.status === 'active';
  }
}

module.exports = new AuthService();