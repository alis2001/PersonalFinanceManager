const express = require('express');
const { db, redisClient } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
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
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;