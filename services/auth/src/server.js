const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const { connectDatabase, connectRedis } = require('./config/database');
const { requestLogger, errorHandler } = require('./middleware/common');
const emailService = require('./services/EmailService');

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

// Initialize database connections
const initializeConnections = async () => {
  try {
    logger.info('Initializing database connections...');
    await connectDatabase();
    await connectRedis();
    logger.info('Database and Redis connections established');

    // FIXED EMAIL SERVICE INITIALIZATION
    logger.info('Initializing email service...');
    try {
      const emailInitialized = await emailService.initialize();
      if (emailInitialized) {
        logger.info('Email service initialized successfully');
      } else {
        logger.warn('Email service initialization failed, continuing without email functionality');
      }
    } catch (error) {
      logger.warn('Email service initialization failed, continuing without email functionality:', error.message);
    }

  } catch (error) {
    logger.error('Failed to connect to databases:', error);
    process.exit(1);
  }
};

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/', authRoutes);

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

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  await initializeConnections();
  
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Auth Service listening on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    logger.info(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    logger.info(`Email Service: ${process.env.SMTP_USERNAME ? 'Configured with ' + process.env.SMTP_USERNAME : 'Not configured'}`);
  });
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});