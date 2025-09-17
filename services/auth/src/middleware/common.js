const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Enhanced logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        service: 'auth-service',
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Request ID middleware for tracing
const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Enhanced request logger with performance metrics
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;

  // Get client IP from various sources
  const getClientIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const connectionIP = req.connection?.remoteAddress;
    const socketIP = req.socket?.remoteAddress;
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return realIP || req.ip || connectionIP || socketIP || 'unknown';
  };

  // Override response methods to log completion
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      contentLength: data ? Buffer.byteLength(data, 'utf8') : 0
    });
    
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      responseSize: JSON.stringify(data).length
    });
    
    return originalJson.call(this, data);
  };

  // Log incoming request
  logger.info('Request received', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent')
  });

  next();
};

// Comprehensive error handler
const errorHandler = (err, req, res, next) => {
  const errorId = uuidv4();
  
  // Default error response
  let statusCode = err.statusCode || err.status || 500;
  let message = 'Internal server error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    details = [{
      field: err.path,
      message: `Invalid ${err.kind} format`,
      value: err.value
    }];
  } else if (err.code === 11000) {
    // Duplicate key error
    statusCode = 409;
    message = 'Resource already exists';
    const field = Object.keys(err.keyPattern)[0];
    details = [{
      field: field,
      message: `${field} already exists`,
      value: err.keyValue[field]
    }];
  } else if (err.name === 'UnauthorizedError' || err.message === 'jwt expired') {
    statusCode = 401;
    message = 'Authentication failed';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Access denied';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
  } else if (err.type === 'request.aborted') {
    statusCode = 400;
    message = 'Request was cancelled';
  } else if (err.code === 'ECONNRESET') {
    statusCode = 502;
    message = 'Connection interrupted';
  } else if (err.name === 'PayloadTooLargeError') {
    statusCode = 413;
    message = 'Request payload too large';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON format';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request entity too large';
  } else if (statusCode >= 400 && statusCode < 500) {
    message = err.message || 'Client error';
  } else if (statusCode >= 500) {
    message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message;
  }

  // Log error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error', {
    errorId,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    errorType: err.name || 'UnknownError'
  });

  // Respond to client
  if (!res.headersSent) {
    const response = {
      error: message,
      errorId,
      timestamp: new Date().toISOString()
    };

    if (details) {
      response.details = details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
  }
};

// Database error handler middleware
const databaseErrorHandler = (err, req, res, next) => {
  if (err.code) {
    switch (err.code) {
      case 'ECONNREFUSED':
        logger.error('Database connection refused', {
          requestId: req.requestId,
          error: err.message,
          host: process.env.DB_HOST,
          port: process.env.DB_PORT
        });
        return res.status(503).json({
          error: 'Database service unavailable',
          message: 'Unable to connect to database'
        });
      
      case 'ETIMEDOUT':
        logger.error('Database query timeout', {
          requestId: req.requestId,
          error: err.message,
          timeout: err.timeout
        });
        return res.status(504).json({
          error: 'Database timeout',
          message: 'Database query took too long to complete'
        });
      
      case 'ENOTFOUND':
        logger.error('Database host not found', {
          requestId: req.requestId,
          error: err.message,
          host: err.hostname
        });
        return res.status(503).json({
          error: 'Database configuration error',
          message: 'Database host not found'
        });
    }
  }
  
  next(err);
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      logger.warn('Request validation failed', {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }))
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/['"]/g, ''),
          value: detail.context?.value
        }))
      });
    }

    req.validatedData = value;
    next();
  };
};

// Health check middleware
const healthCheck = async (req, res, next) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check failed', {
      requestId: req.requestId,
      error: error.message
    });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove server header for security
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add cache control for auth endpoints
  if (req.path.includes('/auth/') || req.path.includes('/login') || req.path.includes('/register')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Graceful shutdown handler
const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err.message });
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = {
  logger,
  requestIdMiddleware,
  requestLogger,
  errorHandler,
  databaseErrorHandler,
  validateRequest,
  healthCheck,
  securityHeaders,
  gracefulShutdown
};