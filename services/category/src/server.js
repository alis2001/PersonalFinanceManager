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
  is_active: Joi.boolean().default(true),
  // Hierarchical fields
  parent_id: Joi.string().uuid().optional().allow(null)
});

// FIXED: Update schema allows partial updates
const categoryUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional().allow(''),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
  icon: Joi.string().max(50).optional(),
  type: Joi.string().valid('income', 'expense', 'both').optional(),
  is_active: Joi.boolean().optional(),
  // Hierarchical fields
  parent_id: Joi.string().uuid().optional().allow(null)
}).min(1); // Require at least one field to update

// Helper functions for hierarchical categories
const calculateCategoryPath = async (parentId, categoryName) => {
  if (!parentId) {
    return categoryName;
  }
  
  const parentResult = await db.query(
    'SELECT path FROM categories WHERE id = $1',
    [parentId]
  );
  
  if (parentResult.rows.length === 0) {
    throw new Error('Parent category not found');
  }
  
  return `${parentResult.rows[0].path}/${categoryName}`;
};

const calculateCategoryPathIds = async (parentId) => {
  if (!parentId) {
    return [];
  }
  
  const parentResult = await db.query(
    'SELECT path_ids FROM categories WHERE id = $1',
    [parentId]
  );
  
  if (parentResult.rows.length === 0) {
    throw new Error('Parent category not found');
  }
  
  return [...parentResult.rows[0].path_ids, parentId];
};

const calculateCategoryLevel = async (parentId) => {
  if (!parentId) {
    return 1;
  }
  
  const parentResult = await db.query(
    'SELECT level FROM categories WHERE id = $1',
    [parentId]
  );
  
  if (parentResult.rows.length === 0) {
    throw new Error('Parent category not found');
  }
  
  return parentResult.rows[0].level + 1;
};

const buildCategoryTree = (categories) => {
  const map = new Map();
  const roots = [];
  
  // Create map of all categories
  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] });
  });
  
  // Build tree structure
  categories.forEach(cat => {
    if (cat.parent_id) {
      const parent = map.get(cat.parent_id);
      if (parent) {
        parent.children.push(map.get(cat.id));
      }
    } else {
      roots.push(map.get(cat.id));
    }
  });
  
  return roots;
};

const updateChildrenPaths = async (parentId, newParentPath, newParentPathIds, newParentLevel) => {
  const children = await db.query(
    'SELECT id, name FROM categories WHERE parent_id = $1',
    [parentId]
  );
  
  for (const child of children.rows) {
    const childPath = `${newParentPath}/${child.name}`;
    const childPathIds = [...newParentPathIds, parentId];
    const childLevel = newParentLevel + 1;
    
    await db.query(
      'UPDATE categories SET path = $1, path_ids = $2, level = $3 WHERE id = $4',
      [childPath, childPathIds, childLevel, child.id]
    );
    
    // Recursively update grandchildren
    await updateChildrenPaths(child.id, childPath, childPathIds, childLevel);
  }
};

// Cascade active status to all children and grandchildren
const cascadeActiveStatus = async (parentId, isActive, userId) => {
  const children = await db.query(
    'SELECT id, name FROM categories WHERE parent_id = $1 AND user_id = $2',
    [parentId, userId]
  );
  
  logger.info(`🔄 CASCADE FUNCTION: Parent ${parentId} has ${children.rows.length} children to update to is_active=${isActive}`);
  
  for (const child of children.rows) {
    logger.info(`🔄 CASCADE UPDATING: Child "${child.name}" (${child.id}) to is_active=${isActive}`);
    
    // Update child's active status
    await db.query(
      'UPDATE categories SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
      [isActive, child.id, userId]
    );
    
    // Recursively update grandchildren
    await cascadeActiveStatus(child.id, isActive, userId);
  }
  
  logger.info(`🔄 CASCADE FUNCTION COMPLETED: Updated ${children.rows.length} children of parent ${parentId}`);
};

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
    const { type, active, includeChildren, level, parentId } = req.query;
    
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
    
    if (level) {
      query += ` AND level = $${params.length + 1}`;
      params.push(parseInt(level));
    }
    
    if (parentId) {
      query += ` AND parent_id = $${params.length + 1}`;
      params.push(parentId);
    }
    
    query += ' ORDER BY path ASC';
    
    const result = await db.query(query, params);
    
    let categories = result.rows;
    
    // If includeChildren is true, return hierarchical structure
    if (includeChildren === 'true') {
      categories = buildCategoryTree(result.rows);
    }
    
    res.json({
      categories,
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
    
    const { name, description, color, icon, type, is_active, parent_id } = value;
    
    // Check if category name already exists for user under the same parent
    const existingCategory = await db.query(
      'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND (parent_id = $3 OR (parent_id IS NULL AND $3 IS NULL))',
      [req.user.userId, name, parent_id]
    );
    
    if (existingCategory.rows.length > 0) {
      return res.status(409).json({ error: 'Category with this name already exists under the same parent' });
    }
    
    // 🚫 CRITICAL VALIDATION: Check if parent category has expenses/income (cannot add children to leaf categories)
    if (parent_id) {
      const parentCategoryCheck = await db.query(
        'SELECT id, name FROM categories WHERE id = $1 AND user_id = $2',
        [parent_id, req.user.userId]
      );
      
      if (parentCategoryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
      
      // Check if parent category has any expenses or income
      const parentUsageCheck = await db.query(
        'SELECT COUNT(*) as usage_count FROM (SELECT category_id FROM expenses WHERE category_id = $1 UNION ALL SELECT category_id FROM income WHERE category_id = $1) as usage',
        [parent_id]
      );
      
      const parentUsageCount = parseInt(parentUsageCheck.rows[0].usage_count);
      
      if (parentUsageCount > 0) {
        logger.warn(`🚫 BLOCKED: User ${req.user.userId} tried to add subcategory "${name}" to category "${parentCategoryCheck.rows[0].name}" (${parent_id}) which has ${parentUsageCount} transactions`);
        return res.status(400).json({ 
          error: 'Cannot add subcategory to category with transactions',
          message: `Cannot add subcategories to "${parentCategoryCheck.rows[0].name}" because it has ${parentUsageCount} existing transaction(s). Categories with transactions must remain as leaf categories. Please remove all transactions first if you want to create subcategories.`,
          categoryName: parentCategoryCheck.rows[0].name,
          transactionCount: parentUsageCount
        });
      }
    }
    
    // Calculate hierarchical fields
    const path = await calculateCategoryPath(parent_id, name);
    const pathIds = await calculateCategoryPathIds(parent_id);
    const level = await calculateCategoryLevel(parent_id);
    
    // Create category
    const result = await db.query(
      `INSERT INTO categories (user_id, name, description, color, icon, type, is_active, parent_id, level, path, path_ids) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [req.user.userId, name, description, color, icon, type, is_active, parent_id, level, path, pathIds]
    );
    
    const category = result.rows[0];
    
    logger.info(`Category created: ${name} (level ${level}) by user ${req.user.userId}`);
    
    res.status(201).json({
      message: 'Category created successfully',
      category
    });
    
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category - FIXED to support partial updates and cascade operations
app.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { cascade } = req.query;
    
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
    
    const currentCategory = existingCategory.rows[0];
    
    // Check if name already exists for user under the same parent (only if name is being updated)
    if (value.name) {
      const nameCheck = await db.query(
        'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3 AND (parent_id = $4 OR (parent_id IS NULL AND $4 IS NULL))',
        [req.user.userId, value.name, id, currentCategory.parent_id]
      );
      
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Category with this name already exists under the same parent' });
      }
    }
    
    // Check if parent_id is being changed and validate it
    if (value.parent_id !== undefined && value.parent_id !== currentCategory.parent_id) {
      // Prevent setting parent to self or descendant
      if (value.parent_id === id) {
        return res.status(400).json({ error: 'Category cannot be its own parent' });
      }
      
      // Check if new parent exists and belongs to user
      if (value.parent_id) {
        const parentCheck = await db.query(
          'SELECT id, name, path_ids FROM categories WHERE id = $1 AND user_id = $2',
          [value.parent_id, req.user.userId]
        );
        
        if (parentCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Parent category not found' });
        }
        
        // Check if new parent is a descendant of current category
        const parentPathIds = parentCheck.rows[0].path_ids;
        if (parentPathIds.includes(id)) {
          return res.status(400).json({ error: 'Cannot set parent to a descendant category' });
        }
        
        // 🚫 CRITICAL VALIDATION: Check if new parent category has expenses/income
        const parentUsageCheck = await db.query(
          'SELECT COUNT(*) as usage_count FROM (SELECT category_id FROM expenses WHERE category_id = $1 UNION ALL SELECT category_id FROM income WHERE category_id = $1) as usage',
          [value.parent_id]
        );
        
        const parentUsageCount = parseInt(parentUsageCheck.rows[0].usage_count);
        
        if (parentUsageCount > 0) {
          logger.warn(`🚫 BLOCKED: User ${req.user.userId} tried to move category "${currentCategory.name}" (${id}) under "${parentCheck.rows[0].name}" (${value.parent_id}) which has ${parentUsageCount} transactions`);
          return res.status(400).json({ 
            error: 'Cannot move category under a category with transactions',
            message: `Cannot move this category under "${parentCheck.rows[0].name}" because it has ${parentUsageCount} existing transaction(s). Categories with transactions must remain as leaf categories.`,
            parentCategoryName: parentCheck.rows[0].name,
            transactionCount: parentUsageCount
          });
        }
      }
    }
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;
    
    // Only update fields that are provided
    Object.keys(value).forEach(key => {
      if (value[key] !== undefined && key !== 'parent_id') {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(value[key]);
      }
    });
    
    // Handle parent_id change separately to recalculate hierarchical fields
    if (value.parent_id !== undefined && value.parent_id !== currentCategory.parent_id) {
      const newPath = await calculateCategoryPath(value.parent_id, value.name || currentCategory.name);
      const newPathIds = await calculateCategoryPathIds(value.parent_id);
      const newLevel = await calculateCategoryLevel(value.parent_id);
      
      updateFields.push(`parent_id = $${++paramCount}`);
      updateFields.push(`path = $${++paramCount}`);
      updateFields.push(`path_ids = $${++paramCount}`);
      updateFields.push(`level = $${++paramCount}`);
      
      values.push(value.parent_id, newPath, newPathIds, newLevel);
    }
    
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
    
    // If parent_id changed, update all children paths
    if (value.parent_id !== undefined && value.parent_id !== currentCategory.parent_id) {
      await updateChildrenPaths(id, category.path, category.path_ids, category.level);
    }
    
    // If cascade is enabled and is_active is being updated, cascade to children
    if (cascade === 'true' && value.is_active !== undefined && value.is_active !== currentCategory.is_active) {
      logger.info(`🔄 BACKEND CASCADE STARTING: Category "${category.name}" (${id}) changing from is_active=${currentCategory.is_active} to is_active=${value.is_active} - cascading to children`);
      await cascadeActiveStatus(id, value.is_active, req.user.userId);
      logger.info(`🔄 BACKEND CASCADE COMPLETED: Cascaded active status ${value.is_active} to all children of category: ${category.name} by user ${req.user.userId}`);
    } else {
      logger.info(`🔄 BACKEND NO CASCADE: Category "${category.name}" (${id}) - cascade=${cascade}, is_active change=${value.is_active !== undefined ? 'yes' : 'no'}, changed=${value.is_active !== currentCategory.is_active ? 'yes' : 'no'}`);
    }
    
    logger.info(`Category updated: ${category.name} (level ${category.level}) by user ${req.user.userId}`);
    
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
    const { deleteChildren } = req.query;
    
    // Check if category exists and belongs to user
    const existingCategory = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const category = existingCategory.rows[0];
    
    // Check if category has children
    const childrenCheck = await db.query(
      'SELECT COUNT(*) as children_count FROM categories WHERE parent_id = $1',
      [id]
    );
    
    const childrenCount = parseInt(childrenCheck.rows[0].children_count);
    
    if (childrenCount > 0 && deleteChildren !== 'true') {
      return res.status(409).json({ 
        error: 'Category has sub-categories. Use deleteChildren=true to delete with all sub-categories',
        children_count: childrenCount
      });
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
    
    // If deleting with children, check if any child categories are being used
    if (deleteChildren === 'true') {
      const childUsageCheck = await db.query(
        `SELECT COUNT(*) as child_usage_count FROM (
          SELECT category_id FROM expenses WHERE category_id IN (
            SELECT id FROM categories WHERE path_ids @> ARRAY[$1]::uuid[]
          )
          UNION ALL
          SELECT category_id FROM income WHERE category_id IN (
            SELECT id FROM categories WHERE path_ids @> ARRAY[$1]::uuid[]
          )
        ) as child_usage`,
        [id]
      );
      
      const childUsageCount = parseInt(childUsageCheck.rows[0].child_usage_count);
      
      if (childUsageCount > 0) {
        return res.status(409).json({ 
          error: 'Cannot delete category tree that contains categories being used in transactions',
          child_usage_count: childUsageCount
        });
      }
    }
    
    // Delete category (CASCADE will handle children if deleteChildren=true)
    await db.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    logger.info(`Category deleted: ${category.name} (${childrenCount} children) by user ${req.user.userId}`);
    
    res.json({ 
      message: 'Category deleted successfully',
      deleted_children: childrenCount
    });
    
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move category to different parent
app.put('/categories/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_parent_id } = req.body;
    
    // Validate new_parent_id if provided
    if (new_parent_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(new_parent_id)) {
      return res.status(400).json({ error: 'Invalid parent ID format' });
    }
    
    // Check if category exists and belongs to user
    const existingCategory = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const category = existingCategory.rows[0];
    
    // Prevent moving to self
    if (new_parent_id === id) {
      return res.status(400).json({ error: 'Category cannot be moved to itself' });
    }
    
    // Check if new parent exists and belongs to user (if provided)
    if (new_parent_id) {
      const parentCheck = await db.query(
        'SELECT id, name, path_ids FROM categories WHERE id = $1 AND user_id = $2',
        [new_parent_id, req.user.userId]
      );
      
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
      
      // Check if new parent is a descendant of current category
      const parentPathIds = parentCheck.rows[0].path_ids;
      if (parentPathIds.includes(id)) {
        return res.status(400).json({ error: 'Cannot move category to a descendant' });
      }
      
      // 🚫 CRITICAL VALIDATION: Check if new parent category has expenses/income
      const parentUsageCheck = await db.query(
        'SELECT COUNT(*) as usage_count FROM (SELECT category_id FROM expenses WHERE category_id = $1 UNION ALL SELECT category_id FROM income WHERE category_id = $1) as usage',
        [new_parent_id]
      );
      
      const parentUsageCount = parseInt(parentUsageCheck.rows[0].usage_count);
      
      if (parentUsageCount > 0) {
        logger.warn(`🚫 BLOCKED: User ${req.user.userId} tried to move category "${category.name}" (${id}) under "${parentCheck.rows[0].name}" (${new_parent_id}) which has ${parentUsageCount} transactions`);
        return res.status(400).json({ 
          error: 'Cannot move category under a category with transactions',
          message: `Cannot move this category under "${parentCheck.rows[0].name}" because it has ${parentUsageCount} existing transaction(s). Categories with transactions must remain as leaf categories.`,
          parentCategoryName: parentCheck.rows[0].name,
          transactionCount: parentUsageCount
        });
      }
    }
    
    // Calculate new hierarchical fields
    const newPath = await calculateCategoryPath(new_parent_id, category.name);
    const newPathIds = await calculateCategoryPathIds(new_parent_id);
    const newLevel = await calculateCategoryLevel(new_parent_id);
    
    // Update category
    await db.query(
      'UPDATE categories SET parent_id = $1, path = $2, path_ids = $3, level = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
      [new_parent_id, newPath, newPathIds, newLevel, id]
    );
    
    // Update all children paths
    await updateChildrenPaths(id, newPath, newPathIds, newLevel);
    
    // Get updated category
    const updatedCategory = await db.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );
    
    logger.info(`Category moved: ${category.name} to parent ${new_parent_id || 'root'} by user ${req.user.userId}`);
    
    res.json({
      message: 'Category moved successfully',
      category: updatedCategory.rows[0]
    });
    
  } catch (error) {
    logger.error('Move category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check category usage (expenses/income transactions)
app.get('/categories/:id/usage', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists and belongs to user
    const categoryCheck = await db.query(
      'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category is being used in expenses or income
    const usageCheck = await db.query(
      'SELECT COUNT(*) as usage_count FROM (SELECT category_id FROM expenses WHERE category_id = $1 UNION ALL SELECT category_id FROM income WHERE category_id = $1) as usage',
      [id]
    );
    
    const usageCount = parseInt(usageCheck.rows[0].usage_count);
    
    // Check if category has children
    const childrenCheck = await db.query(
      'SELECT COUNT(*) as children_count FROM categories WHERE parent_id = $1',
      [id]
    );
    
    const childrenCount = parseInt(childrenCheck.rows[0].children_count);
    
    logger.info(`Category usage check: ${id} - expenses: ${usageCount}, children: ${childrenCount} by user ${req.user.userId}`);
    
    res.json({
      hasExpenses: usageCount > 0,
      hasChildren: childrenCount > 0,
      expenseCount: usageCount,
      childrenCount: childrenCount
    });
    
  } catch (error) {
    logger.error('Category usage check error:', error);
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