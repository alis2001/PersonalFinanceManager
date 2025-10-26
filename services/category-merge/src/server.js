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
  transports: [new winston.transports.Console()],
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
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Token verification failed' });
  }
};

// Validation schemas
const mergeCategoriesSchema = Joi.object({
  sourceCategoryId: Joi.string().uuid().required(),
  targetCategoryId: Joi.string().uuid().required(),
  confirmMerge: Joi.boolean().default(false)
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Category Merge Service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Service info
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Category Merge Service',
    version: '1.0.0',
    endpoints: {
      merge: {
        preview: 'POST /merge/preview',
        execute: 'POST /merge/execute'
      },
      categories: 'GET /categories/tree',
      health: 'GET /health'
    }
  });
});

// Get category tree for merge interface
app.get('/categories/tree', authenticateToken, async (req, res) => {
  try {
    logger.info(`🌳 MERGE SERVICE: Getting category tree for user ${req.user.userId}`);
    
    // Get all active categories for the user
    const result = await db.query(
      'SELECT * FROM categories WHERE user_id = $1 AND is_active = true ORDER BY path ASC',
      [req.user.userId]
    );
    
    // Build hierarchical tree structure
    const categories = result.rows;
    const categoryTree = buildCategoryTree(categories);
    
    logger.info(`🌳 MERGE SERVICE: Retrieved ${categories.length} categories, built tree with ${categoryTree.length} root nodes`);
    
    res.json({
      categories: categoryTree,
      total: categories.length
    });
    
  } catch (error) {
    logger.error('Get category tree error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Preview merge operation (what will happen)
app.post('/merge/preview', authenticateToken, async (req, res) => {
  try {
    const { error, value } = mergeCategoriesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { sourceCategoryId, targetCategoryId } = value;
    
    logger.info(`🔍 MERGE PREVIEW: User ${req.user.userId} previewing merge from ${sourceCategoryId} to ${targetCategoryId}`);
    
    // Validate categories exist and belong to user
    const categoriesCheck = await db.query(
      'SELECT id, name, level FROM categories WHERE id IN ($1, $2) AND user_id = $3',
      [sourceCategoryId, targetCategoryId, req.user.userId]
    );
    
    if (categoriesCheck.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both categories not found' });
    }
    
    const sourceCategory = categoriesCheck.rows.find(cat => cat.id === sourceCategoryId);
    const targetCategory = categoriesCheck.rows.find(cat => cat.id === targetCategoryId);
    
    // Check if source has subcategories
    const subcategoriesCheck = await db.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
      [sourceCategoryId]
    );
    
    const hasSubcategories = parseInt(subcategoriesCheck.rows[0].count) > 0;
    
    if (hasSubcategories) {
      return res.status(400).json({ 
        error: 'Cannot merge category with subcategories',
        message: 'Please merge all subcategories first before merging the parent category'
      });
    }
    
    // CRITICAL: Check if target has subcategories (cannot merge INTO parent categories)
    const targetSubcategoriesCheck = await db.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
      [targetCategoryId]
    );
    
    const targetHasSubcategories = parseInt(targetSubcategoriesCheck.rows[0].count) > 0;
    
    if (targetHasSubcategories) {
      return res.status(400).json({ 
        error: 'Cannot merge into parent category',
        message: 'Cannot merge into parent categories. Parent categories with subcategories cannot have expenses added to them.'
      });
    }
    
    // Count expenses that will be moved
    const expenseCount = await db.query(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = $1',
      [sourceCategoryId]
    );
    
    const incomeCount = await db.query(
      'SELECT COUNT(*) as count FROM income WHERE category_id = $1',
      [sourceCategoryId]
    );
    
    const totalTransactions = parseInt(expenseCount.rows[0].count) + parseInt(incomeCount.rows[0].count);
    
    res.json({
      preview: {
        sourceCategory: {
          id: sourceCategory.id,
          name: sourceCategory.name,
          level: sourceCategory.level
        },
        targetCategory: {
          id: targetCategory.id,
          name: targetCategory.name,
          level: targetCategory.level
        },
        transactionsToMove: totalTransactions,
        expenseCount: parseInt(expenseCount.rows[0].count),
        incomeCount: parseInt(incomeCount.rows[0].count),
        hasSubcategories: hasSubcategories
      },
      canMerge: !hasSubcategories,
      message: hasSubcategories 
        ? 'Cannot merge category with subcategories' 
        : `${totalTransactions} transactions will be moved from "${sourceCategory.name}" to "${targetCategory.name}"`
    });
    
  } catch (error) {
    logger.error('Merge preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Execute merge operation
app.post('/merge/execute', authenticateToken, async (req, res) => {
  try {
    const { error, value } = mergeCategoriesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { sourceCategoryId, targetCategoryId, confirmMerge } = value;
    
    if (!confirmMerge) {
      return res.status(400).json({ error: 'Merge confirmation required' });
    }
    
    logger.info(`🔄 EXECUTING MERGE: User ${req.user.userId} merging ${sourceCategoryId} to ${targetCategoryId}`);
    
    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get category details
      const categoriesResult = await client.query(
        'SELECT id, name FROM categories WHERE id IN ($1, $2) AND user_id = $3',
        [sourceCategoryId, targetCategoryId, req.user.userId]
      );
      
      if (categoriesResult.rows.length !== 2) {
        throw new Error('Categories not found');
      }
      
      const sourceCategory = categoriesResult.rows.find(cat => cat.id === sourceCategoryId);
      const targetCategory = categoriesResult.rows.find(cat => cat.id === targetCategoryId);
      
      // CRITICAL VALIDATION: Check if source has subcategories
      const sourceSubcategoriesCheck = await client.query(
        'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
        [sourceCategoryId]
      );
      
      if (parseInt(sourceSubcategoriesCheck.rows[0].count) > 0) {
        throw new Error('Cannot merge category with subcategories');
      }
      
      // CRITICAL VALIDATION: Check if target has subcategories (cannot merge INTO parent categories)
      const targetSubcategoriesCheck = await client.query(
        'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
        [targetCategoryId]
      );
      
      if (parseInt(targetSubcategoriesCheck.rows[0].count) > 0) {
        throw new Error('Cannot merge into parent categories. Parent categories with subcategories cannot have expenses added to them.');
      }
      
      // Move expenses
      const expenseResult = await client.query(
        'UPDATE expenses SET category_id = $1 WHERE category_id = $2 AND user_id = $3',
        [targetCategoryId, sourceCategoryId, req.user.userId]
      );
      
      // Move income
      const incomeResult = await client.query(
        'UPDATE income SET category_id = $1 WHERE category_id = $2 AND user_id = $3',
        [targetCategoryId, sourceCategoryId, req.user.userId]
      );
      
      // Delete source category
      await client.query(
        'DELETE FROM categories WHERE id = $1 AND user_id = $2',
        [sourceCategoryId, req.user.userId]
      );
      
      await client.query('COMMIT');
      
      const totalMoved = expenseResult.rowCount + incomeResult.rowCount;
      
      logger.info(`✅ MERGE COMPLETED: Moved ${totalMoved} transactions from "${sourceCategory.name}" to "${targetCategory.name}" for user ${req.user.userId}`);
      
      res.json({
        success: true,
        message: 'Categories merged successfully',
        details: {
          sourceCategory: sourceCategory.name,
          targetCategory: targetCategory.name,
          transactionsMoved: totalMoved,
          expensesMoved: expenseResult.rowCount,
          incomeMoved: incomeResult.rowCount
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Merge execution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to build category tree
function buildCategoryTree(categories) {
  const categoryMap = {};
  const rootCategories = [];
  
  // Create map of all categories
  categories.forEach(category => {
    categoryMap[category.id] = { ...category, children: [] };
  });
  
  // Build tree structure
  categories.forEach(category => {
    if (category.parent_id) {
      if (categoryMap[category.parent_id]) {
        categoryMap[category.parent_id].children.push(categoryMap[category.id]);
      }
    } else {
      rootCategories.push(categoryMap[category.id]);
    }
  });
  
  return rootCategories;
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 Category Merge Service running on port ${port}`);
});

module.exports = app;
