const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const winston = require('winston');
const Joi = require('joi');
const axios = require('axios');
require('dotenv').config();

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

// Database configuration
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Validation schemas
const categorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional().allow(''),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  icon: Joi.string().max(50).optional(),
  type: Joi.string().valid('income', 'expense', 'both').default('both'),
  is_active: Joi.boolean().default(true)
});

// FIXED: Update schema allows partial updates
const categoryUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional().allow(''),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  icon: Joi.string().max(50).optional(),
  type: Joi.string().valid('income', 'expense', 'both').optional(),
  is_active: Joi.boolean().optional()
}).min(1); // Require at least one field to update

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3000';
    const response = await axios.post(`${authServiceUrl}/verify`, { token }, {
      timeout: 5000
    });
    
    if (response.data.valid) {
      req.user = response.data.user;
      next();
    } else {
      res.status(403).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      service: 'Category Service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'Category Service',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Category Service',
    version: '1.0.0',
    endpoints: {
      categories: {
        list: 'GET /categories',
        create: 'POST /categories',
        get: 'GET /categories/:id',
        update: 'PUT /categories/:id',
        delete: 'DELETE /categories/:id'
      },
      health: 'GET /health'
    }
  });
});

// Get all categories for a user
app.get('/categories', authenticateToken, async (req, res) => {
  try {
    const { type, active } = req.query;
    
    let query = 'SELECT * FROM categories WHERE user_id = $1';
    const params = [req.user.userId];
    
    if (type) {
      query += ' AND (type = $2 OR type = $3)';
      params.push(type, 'both');
    }
    
    if (active !== undefined) {
      const activeFilter = active === 'true';
      query += ` AND is_active = $${params.length + 1}`;
      params.push(activeFilter);
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await db.query(query, params);
    
    res.json({
      categories: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by ID
app.get('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ category: result.rows[0] });
    
  } catch (error) {
    logger.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new category
app.post('/categories', authenticateToken, async (req, res) => {
  try {
    // Validate request
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, description, color, icon, type, is_active } = value;
    
    // Check if category name already exists for user
    const existingCategory = await db.query(
      'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.userId, name]
    );
    
    if (existingCategory.rows.length > 0) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    
    // Create category
    const result = await db.query(
      `INSERT INTO categories (user_id, name, description, color, icon, type, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [req.user.userId, name, description, color, icon, type, is_active]
    );
    
    const category = result.rows[0];
    
    logger.info(`Category created: ${name} by user ${req.user.userId}`);
    
    res.status(201).json({
      message: 'Category created successfully',
      category
    });
    
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category - FIXED to support partial updates
app.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // FIXED: Use update schema instead of create schema
    const { error, value } = categoryUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Check if category exists and belongs to user
    const existingCategory = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if name already exists for user (only if name is being updated)
    if (value.name) {
      const nameCheck = await db.query(
        'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [req.user.userId, value.name, id]
      );
      
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Category with this name already exists' });
      }
    }
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;
    
    // Only update fields that are provided
    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(value[key]);
      }
    });
    
    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add WHERE clause parameters
    values.push(id, req.user.userId);
    
    const updateQuery = `
      UPDATE categories 
      SET ${updateFields.join(', ')} 
      WHERE id = $${++paramCount} AND user_id = $${++paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    const category = result.rows[0];
    
    logger.info(`Category updated: ${category.name} by user ${req.user.userId}`);
    
    res.json({
      message: 'Category updated successfully',
      category
    });
    
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
app.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists and belongs to user
    const existingCategory = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category is being used in expenses or income
    const usageCheck = await db.query(
      'SELECT COUNT(*) as usage_count FROM (SELECT category_id FROM expenses WHERE category_id = $1 UNION ALL SELECT category_id FROM income WHERE category_id = $1) as usage',
      [id]
    );
    
    const usageCount = parseInt(usageCheck.rows[0].usage_count);
    
    if (usageCount > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete category that is being used in transactions',
        usage_count: usageCount
      });
    }
    
    // Delete category
    await db.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    logger.info(`Category deleted: ${id} by user ${req.user.userId}`);
    
    res.json({ message: 'Category deleted successfully' });
    
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category statistics
app.get('/categories/stats', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        type,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
       FROM categories 
       WHERE user_id = $1 
       GROUP BY type
       ORDER BY type`,
      [req.user.userId]
    );
    
    const stats = {
      total: 0,
      by_type: {},
      active_total: 0
    };
    
    result.rows.forEach(row => {
      stats.by_type[row.type] = {
        total: parseInt(row.count),
        active: parseInt(row.active_count)
      };
      stats.total += parseInt(row.count);
      stats.active_total += parseInt(row.active_count);
    });
    
    res.json({ stats });
    
  } catch (error) {
    logger.error('Category stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`, { stack: error.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Category Service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});