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

    // Initialize email service
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

// Body parser error handler middleware
const bodyParserErrorHandler = () => {
  return (err, req, res, next) => {
    if (err.type === 'request.aborted') {
      logger.warn('Request aborted by client', { 
        path: req.path, 
        method: req.method,
        ip: req.ip 
      });
      return res.status(400).json({ 
        error: 'Request was cancelled by client',
        message: 'The request was interrupted before completion'
      });
    }
    
    if (err.code === 'ECONNRESET') {
      logger.warn('Connection reset', { 
        path: req.path, 
        method: req.method,
        ip: req.ip 
      });
      return res.status(502).json({ 
        error: 'Connection interrupted',
        message: 'The connection was reset during request processing'
      });
    }
    
    if (err.name === 'PayloadTooLargeError') {
      logger.warn('Payload too large', { 
        path: req.path, 
        method: req.method,
        limit: err.limit,
        received: err.received 
      });
      return res.status(413).json({ 
        error: 'Request payload too large',
        message: 'The request body exceeds the maximum allowed size'
      });
    }
    
    if (err.type === 'entity.parse.failed') {
      logger.warn('JSON parse error', { 
        path: req.path, 
        method: req.method,
        body: err.body 
      });
      return res.status(400).json({ 
        error: 'Invalid JSON format',
        message: 'The request body contains malformed JSON'
      });
    }
    
    next(err);
  };
};

// Request timeout middleware
const requestTimeout = (timeoutMs = 60000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.error(`Request timeout: ${req.method} ${req.path} from ${req.ip}`);
        res.status(408).json({ 
          error: 'Request timeout',
          message: 'The server did not receive a complete request within the expected time'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    const originalSend = res.send;
    res.send = function(...args) {
      clearTimeout(timeout);
      return originalSend.apply(this, args);
    };

    const originalJson = res.json;
    res.json = function(...args) {
      clearTimeout(timeout);
      return originalJson.apply(this, args);
    };

    const originalEnd = res.end;
    res.end = function(...args) {
      clearTimeout(timeout);
      return originalEnd.apply(this, args);
    };

    next();
  };
};

// Apply request timeout early in middleware stack
app.use(requestTimeout(60000)); // 60 second timeout

// Body parsing middleware with enhanced configuration
app.use(express.json({ 
  limit: '10mb',
  timeout: 45000, // 45 second parsing timeout
  verify: (req, res, buf, encoding) => {
    // Preserve raw body for debugging
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb',
  timeout: 45000 // 45 second parsing timeout
}));

// Apply body parser error handler immediately after body parsing
app.use(bodyParserErrorHandler());

// General rate limiting (after body parsing)
const { generalLimiter } = require('./middleware/auth');
app.use(generalLimiter);

// Request logging
app.use(requestLogger);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Unhandled error logging (but don't crash)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Authentication Service',
    version: '1.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        login: 'POST /login',
        register: 'POST /register',
        refresh: 'POST /refresh',
        logout: 'POST /logout',
        verify: 'POST /verify-email',
        profile: 'GET /profile'
      },
      health: 'GET /health'
    },
    timestamp: new Date().toISOString()
  });
});

// Final error handler
app.use(errorHandler);

// Start server with timeout configuration
const server = app.listen(port, '0.0.0.0', async () => {
  await initializeConnections();
  
  logger.info(`Auth Service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  logger.info(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  logger.info(`Email Service: Configured with ${process.env.SMTP_USERNAME}`);
});

// Configure server timeouts (cascading approach - lower than gateway)
server.requestTimeout = 60000; // 60 seconds for full request  
server.headersTimeout = 61000; // Must be > requestTimeout
server.keepAliveTimeout = 61000; // Connection keep-alive
server.timeout = 0; // Disable socket inactivity timeout

// Export server for testing
module.exports = { app, server };