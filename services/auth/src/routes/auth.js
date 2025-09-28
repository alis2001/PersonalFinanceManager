const express = require('express');
const authController = require('../controllers/authController');
const { authLimiter, authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/common');
const { 
  registerSchema, 
  loginSchema, 
  emailVerificationSchema,
  resendVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshTokenSchema 
} = require('../models/auth');

const router = express.Router();

// FIXED: Public authentication routes with proper middleware order
router.post('/register', 
  authLimiter,  // Rate limiting AFTER body parsing (now safe)
  validateRequest(registerSchema), 
  authController.register
);

router.post('/login', 
  authLimiter,  // Rate limiting AFTER body parsing (now safe)
  validateRequest(loginSchema), 
  authController.login
);

router.post('/verify-email', 
  authLimiter,  // Add rate limiting to prevent abuse
  authController.verifyEmail
);

router.post('/resend-verification', 
  authLimiter,  // Add rate limiting to prevent spam
  validateRequest(resendVerificationSchema), 
  authController.resendVerification
);

router.post('/request-password-reset', 
  authLimiter,  // Add rate limiting to prevent abuse
  validateRequest(passwordResetRequestSchema), 
  authController.requestPasswordReset
);

router.post('/reset-password', 
  authLimiter,  // Add rate limiting to prevent abuse
  validateRequest(passwordResetSchema), 
  authController.resetPassword
);

router.post('/refresh', 
  validateRequest(refreshTokenSchema), 
  authController.refresh
);

// Internal service route (for other microservices) - no rate limiting
router.post('/verify', 
  authController.verifyToken
);

// Protected routes (require authentication)
router.post('/logout', 
  authenticateToken, 
  authController.logout
);

router.get('/profile', 
  authenticateToken, 
  authController.getProfile
);

router.put('/update-language', 
  authenticateToken, 
  authController.updateLanguage
);

// Health check route - no middleware needed
router.get('/health', 
  authController.health
);

// Root endpoint - service information
router.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Auth Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      authentication: {
        register: 'POST /register',
        login: 'POST /login',
        logout: 'POST /logout (protected)',
        refresh: 'POST /refresh'
      },
      emailVerification: {
        verify: 'POST /verify-email',
        resend: 'POST /resend-verification'
      },
      passwordReset: {
        request: 'POST /request-password-reset',
        reset: 'POST /reset-password'
      },
      profile: {
        get: 'GET /profile (protected)'
      },
      internal: {
        verify: 'POST /verify (for microservices)',
        health: 'GET /health'
      }
    },
    features: {
      emailVerification: true,
      accountTypes: ['personal', 'business'],
      passwordReset: true,
      jwtTokens: true,
      refreshTokens: true,
      rateLimiting: true,
      emailLogging: true
    }
  });
});

module.exports = router;