const express = require('express');
const authController = require('../controllers/authController');
const { authLimiter, authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/common');
const { registerSchema, loginSchema, refreshTokenSchema } = require('../models/auth');

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refresh);

// Internal service route (for other microservices)
router.post('/verify', authController.verifyToken);

// Protected routes
router.post('/logout', authenticateToken, authController.logout);
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;