const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../utils/token');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Enhanced key generator that handles various IP scenarios
const generateRateLimitKey = (req) => {
  // Try multiple sources for client identification
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const connectionIP = req.connection?.remoteAddress;
  const socketIP = req.socket?.remoteAddress;
  const reqIP = req.ip;
  
  let clientIP = 'unknown';
  
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    clientIP = forwarded.split(',')[0].trim();
  } else if (realIP) {
    clientIP = realIP;
  } else if (reqIP) {
    clientIP = reqIP;
  } else if (connectionIP) {
    clientIP = connectionIP;
  } else if (socketIP) {
    clientIP = socketIP;
  }
  
  // Clean up IPv6-mapped IPv4 addresses
  if (clientIP.startsWith('::ffff:')) {
    clientIP = clientIP.substring(7);
  }
  
  return clientIP;
};

// Auth-specific rate limiter (stricter for login attempts)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: { 
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for authentication', {
      ip: generateRateLimitKey(req),
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and internal service calls
    return req.path === '/health' || req.path === '/verify';
  }
});

// Internal service rate limiter (very permissive for service-to-service communication)
const internalServiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window per IP (very permissive for internal services)
  message: { 
    error: 'Too many internal service requests',
    message: 'Internal service rate limit exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for internal service requests', {
      ip: generateRateLimitKey(req),
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many internal service requests',
      message: 'Internal service rate limit exceeded',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and internal service verification
    return req.path === '/health' || req.path === '/verify';
  }
});

// General rate limiter (more permissive for regular API usage)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window per IP (reasonable for user requests)
  message: { 
    error: 'Too many requests',
    message: 'Please slow down and try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateRateLimitKey,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for general requests', {
      ip: generateRateLimitKey(req),
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      retryAfter: '15 minutes'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and internal service verification
    return req.path === '/health' || req.path === '/verify';
  }
});

// Token authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('Authentication attempt without token', {
      ip: generateRateLimitKey(req),
      path: req.path,
      method: req.method
    });
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid authorization token'
    });
  }
  
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      logger.warn('Authentication failed with invalid token', {
        ip: generateRateLimitKey(req),
        path: req.path,
        method: req.method
      });
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        message: 'Please log in again'
      });
    }
    
    req.user = decoded;
    logger.debug('Authentication successful', {
      userId: decoded.userId,
      path: req.path,
      method: req.method
    });
    next();
  } catch (error) {
    logger.error('Token verification error', {
      error: error.message,
      ip: generateRateLimitKey(req),
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ 
      error: 'Invalid or expired token',
      message: 'Please log in again'
    });
  }
};

// Email verification requirement middleware
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in first'
    });
  }
  
  if (!req.user.verified) {
    logger.warn('Unverified user access attempt', {
      userId: req.user.userId,
      email: req.user.email,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ 
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource',
      action: 'resend_verification_email'
    });
  }
  next();
};

// Request timeout middleware with enhanced logging
const requestTimeout = (timeoutMs = 60000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const duration = Date.now() - startTime;
        logger.error('Request timeout', {
          method: req.method,
          path: req.path,
          ip: generateRateLimitKey(req),
          duration: duration,
          timeout: timeoutMs,
          userAgent: req.get('User-Agent')
        });
        
        res.status(408).json({ 
          error: 'Request timeout',
          message: 'The server did not receive a complete request within the expected time',
          timeout: `${timeoutMs / 1000} seconds`
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    const clearTimeoutAndLog = (method) => {
      return function(...args) {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        if (duration > 5000) { // Log slow requests (> 5 seconds)
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration: duration,
            ip: generateRateLimitKey(req)
          });
        }
        return method.apply(this, args);
      };
    };

    res.send = clearTimeoutAndLog(res.send);
    res.json = clearTimeoutAndLog(res.json);
    res.end = clearTimeoutAndLog(res.end);

    next();
  };
};

// Admin role middleware (for future admin features)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in first'
    });
  }
  
  if (req.user.role !== 'admin') {
    logger.warn('Admin access attempt by non-admin user', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This resource requires administrator privileges'
    });
  }
  next();
};

// Error boundary for middleware
const middlewareErrorHandler = (err, req, res, next) => {
  logger.error('Middleware error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: generateRateLimitKey(req)
  });
  
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

module.exports = {
  authLimiter,
  internalServiceLimiter,
  generalLimiter,
  authenticateToken,
  requireEmailVerification,
  requestTimeout,
  requireAdmin,
  middlewareErrorHandler,
  generateRateLimitKey
};