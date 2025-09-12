const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');
const Joi = require('joi');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Database configuration
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis configuration
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.connect();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Utility functions
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    // Test Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      service: 'Auth Service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'Auth Service',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Auth Service',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /register',
        login: 'POST /login',
        logout: 'POST /logout',
        refresh: 'POST /refresh',
        profile: 'GET /profile'
      },
      health: 'GET /health'
    }
  });
});

// Register endpoint
app.post('/register', authLimiter, async (req, res) => {
  try {
    // Validate request
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { email, password, firstName, lastName } = value;
    
    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }
    
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const result = await db.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
      [email, passwordHash, firstName, lastName]
    );
    
    const user = result.rows[0];
    const tokens = generateTokens(user);
    
    // Store refresh token in Redis
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, tokens.refreshToken);
    
    logger.info(`User registered: ${email}`);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      },
      tokens
    });
    
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/login', authLimiter, async (req, res) => {
  try {
    // Validate request
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { email, password } = value;
    
    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, status FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Store refresh token in Redis
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, tokens.refreshToken);
    
    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    logger.info(`User logged in: ${email}`);
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      tokens
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
app.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Check if refresh token exists in Redis
    const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
    if (storedToken !== refreshToken) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Get user data
    const result = await db.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1 AND status = $2',
      [decoded.userId, 'active']
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }
    
    const user = result.rows[0];
    const tokens = generateTokens(user);
    
    // Store new refresh token in Redis
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, tokens.refreshToken);
    
    res.json({ tokens });
    
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${req.user.userId}`);
    
    logger.info(`User logged out: ${req.user.email}`);
    
    res.json({ message: 'Logout successful' });
    
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Profile endpoint
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, status, created_at, last_login FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
    
  } catch (error) {
    logger.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint (for other services)
app.post('/verify', async (req, res) => {
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
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`, { stack: error.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  await redisClient.quit();
  process.exit(0);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Auth Service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  logger.info(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});