const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../utils/token');

// FIXED: Rate limiting for auth endpoints - removed req.body access
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // FIXED: Use only IP address, not req.body (which isn't parsed yet)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  // Add timeout handler
  onLimitReached: (req, res) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}`);
  }
});

// FIXED: General rate limiter for all requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource'
    });
  }
  next();
};

// ADDED: Request timeout middleware
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`Request timeout: ${req.method} ${req.path} from ${req.ip}`);
        res.status(408).json({ error: 'Request timeout' });
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

    next();
  };
};

module.exports = {
  authLimiter,
  generalLimiter, // ADDED: Export general limiter
  authenticateToken,
  requireEmailVerification,
  requestTimeout // ADDED: Export timeout middleware
};