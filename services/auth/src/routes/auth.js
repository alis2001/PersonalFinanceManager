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

// Public authentication routes
router.post('/register', 
  validateRequest(registerSchema), 
  authController.register
);

router.post('/login', 
  validateRequest(loginSchema), 
  authController.login
);

router.post('/verify-email', 
  authController.verifyEmail
);

router.post('/resend-verification', 
  validateRequest(resendVerificationSchema), 
  authController.resendVerification
);

router.post('/request-password-reset', 
  validateRequest(passwordResetRequestSchema), 
  authController.requestPasswordReset
);

router.post('/reset-password', 
  validateRequest(passwordResetSchema), 
  authController.resetPassword
);

router.post('/refresh', 
  validateRequest(refreshTokenSchema), 
  authController.refresh
);

// Internal service route (for other microservices)
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

// Health check route
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