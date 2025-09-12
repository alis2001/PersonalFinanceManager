const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../utils/token');

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || 'unknown');
  }
});

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

const requireEmailVerification = (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource'
    });
  }
  next();
};

module.exports = {
  authLimiter,
  authenticateToken,
  requireEmailVerification
};