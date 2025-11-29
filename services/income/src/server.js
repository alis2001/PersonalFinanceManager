const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const winston = require('winston');
const Joi = require('joi');
const axios = require('axios');
const moment = require('moment-jalaali');
const cron = require('node-cron');
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

// Validation schemas
// DYNAMIC CURRENCY LIMITS: Support all currencies (same as expense)
const incomeSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  amount: Joi.number().positive().max(10000000000).required(), // 10 billion - supports IRR (10B), USD (100M), etc
  description: Joi.string().max(500).required(), // REQUIRED for income (NOT NULL in DB)
  transactionDate: Joi.date().required(),
  userDate: Joi.date().required(),  // User's local date (timezone-independent)
  userTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).required(),  // HH:MM:SS format
  // SIMPLIFIED FIELDS (matching frontend):
  location: Joi.string().max(255).optional().allow(''),  // Changed from 'source' to 'location' to match expenses
  isRecurring: Joi.boolean().optional().default(false),
  frequency: Joi.string().valid('one_time', 'daily', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'bi_monthly', 'quarterly', 'semi_annually', 'yearly').optional().default('one_time'),
  nextExpectedDate: Joi.date().optional().allow(null),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  notes: Joi.string().max(1000).optional().allow('')
});

const incomeUpdateSchema = Joi.object({
  categoryId: Joi.string().uuid().optional(),
  amount: Joi.number().positive().max(10000000000).optional(),
  description: Joi.string().max(500).optional(),
  transactionDate: Joi.date().optional(),
  userDate: Joi.date().optional(),
  userTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional(),
  location: Joi.string().max(255).optional().allow(''),  // Changed from 'source' to 'location'
  isRecurring: Joi.boolean().optional(),
  frequency: Joi.string().valid('one_time', 'daily', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'bi_monthly', 'quarterly', 'semi_annually', 'yearly').optional(),
  nextExpectedDate: Joi.date().optional().allow(null),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  notes: Joi.string().max(1000).optional().allow('')
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
      service: 'Income Service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'Income Service',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Income Service',
    version: '1.0.0',
    endpoints: {
      income: {
        list: 'GET /income',
        create: 'POST /income',
        get: 'GET /income/:id',
        update: 'PUT /income/:id',
        delete: 'DELETE /income/:id'
      },
      stats: 'GET /stats',
      health: 'GET /health'
    }
  });
});

// Get income statistics - EXACT PERSIAN CALENDAR LOGIC FROM EXPENSE SERVICE
app.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    // Get user's currency to determine date system
    const userResult = await db.query(
      'SELECT default_currency FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    const userCurrency = userResult.rows.length > 0 ? userResult.rows[0].default_currency : 'USD';
    
    let dateFilter = '';
    let periodName = '';
    
    // Use Persian calendar calculations for IRR users - EXACT SAME LOGIC
    if (userCurrency === 'IRR') {
      // Use proper Persian calendar with moment-jalaali
      const now = moment();
      
      switch(period) {
        case 'weekly':
          // Persian week starts on Saturday and ends on Friday
          // Calculate days since last Saturday
          const dayOfWeek = now.day(); // 0=Sunday, 1=Monday, ..., 6=Saturday
          let daysFromSaturday;
          if (dayOfWeek === 6) {
            daysFromSaturday = 0; // Today is Saturday
          } else {
            daysFromSaturday = (dayOfWeek + 1) % 7; // Days since last Saturday
          }
          
          const persianWeekStart = now.clone().subtract(daysFromSaturday, 'days').startOf('day');
          const persianWeekEnd = persianWeekStart.clone().add(6, 'days').endOf('day');
          dateFilter = `user_date >= '${persianWeekStart.format('YYYY-MM-DD')}' AND user_date <= '${persianWeekEnd.format('YYYY-MM-DD')}'`;
          periodName = 'This Week';
          break;
        case 'monthly':
          // Current Persian month - use user_date for timezone-independent filtering
          const persianMonthStart = now.clone().startOf('jMonth');
          const persianMonthEnd = now.clone().endOf('jMonth');
          dateFilter = `user_date >= '${persianMonthStart.format('YYYY-MM-DD')}' AND user_date <= '${persianMonthEnd.format('YYYY-MM-DD')}'`;
          periodName = 'This Month';
          break;
        case 'yearly':
          // Current Persian year - use user_date for timezone-independent filtering
          const persianYearStart = now.clone().startOf('jYear');
          const persianYearEnd = now.clone().endOf('jYear');
          dateFilter = `user_date >= '${persianYearStart.format('YYYY-MM-DD')}' AND user_date <= '${persianYearEnd.format('YYYY-MM-DD')}'`;
          periodName = 'This Year';
          break;
        default:
          const defaultMonthStart = now.clone().startOf('jMonth');
          const defaultMonthEnd = now.clone().endOf('jMonth');
          dateFilter = `user_date >= '${defaultMonthStart.format('YYYY-MM-DD')}' AND user_date <= '${defaultMonthEnd.format('YYYY-MM-DD')}'`;
          periodName = 'This Month';
      }
    } else {
      // Use Gregorian calendar for all other currencies
      switch(period) {
        case 'weekly':
          // Gregorian week starts on Monday (day 1)
          // Calculate Monday of current week and add 6 days for Sunday
          const weekStart = 'CURRENT_DATE - INTERVAL \'1 day\' * ((EXTRACT(DOW FROM CURRENT_DATE) + 6) % 7)';
          const weekEnd = weekStart + ' + INTERVAL \'6 days\'';
          dateFilter = `user_date >= (${weekStart}) AND user_date <= (${weekEnd})`;
          periodName = 'This Week';
          break;
        case 'monthly':
          // Current Gregorian month only - use user_date for timezone-independent filtering
          dateFilter = 'user_date >= DATE_TRUNC(\'month\', CURRENT_DATE)::DATE AND user_date <= (DATE_TRUNC(\'month\', CURRENT_DATE) + INTERVAL \'1 month\' - INTERVAL \'1 day\')::DATE';
          periodName = 'This Month';
          break;
        case 'yearly':
          // Current Gregorian year only - use user_date for timezone-independent filtering
          dateFilter = 'user_date >= DATE_TRUNC(\'year\', CURRENT_DATE)::DATE AND user_date <= (DATE_TRUNC(\'year\', CURRENT_DATE) + INTERVAL \'1 year\' - INTERVAL \'1 day\')::DATE';
          periodName = 'This Year';
          break;
        default:
          // Default to current Gregorian month
          dateFilter = 'user_date >= DATE_TRUNC(\'month\', CURRENT_DATE)::DATE AND user_date <= (DATE_TRUNC(\'month\', CURRENT_DATE) + INTERVAL \'1 month\' - INTERVAL \'1 day\')::DATE';
          periodName = 'This Month';
      }
    }
    
    // Get total income for period - using user_date for timezone-independent filtering
    const totalQuery = `SELECT COALESCE(SUM(amount), 0) as total 
       FROM income 
       WHERE user_id = $1 AND ${dateFilter}`;
    
    logger.info(`[STATS] Period: ${period}, Currency: ${userCurrency}`);
    logger.info(`[STATS] Query: ${totalQuery}`);
    
    const totalResult = await db.query(totalQuery, [req.user.userId]);
    
    logger.info(`[STATS] Result: ${totalResult.rows[0].total}`);
    
    // Get category breakdown (top income sources)
    const categoryResult = await db.query(
      `SELECT c.name, c.color, c.icon, COALESCE(SUM(i.amount), 0) as amount
       FROM categories c
       LEFT JOIN income i ON c.id = i.category_id AND i.user_id = $1 AND ${dateFilter}
       WHERE c.user_id = $1 AND c.type IN ('income', 'both')
       GROUP BY c.id, c.name, c.color, c.icon
       HAVING SUM(i.amount) > 0
       ORDER BY amount DESC
       LIMIT 5`,
      [req.user.userId]
    );
    
    // Get recent income count
    const countResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM income 
       WHERE user_id = $1 AND ${dateFilter}`,
      [req.user.userId]
    );
    
    res.json({
      period: periodName,
      total: parseFloat(totalResult.rows[0].total),
      transactionCount: parseInt(countResult.rows[0].count),
      topCategories: categoryResult.rows.map(row => ({
        name: row.name,
        color: row.color,
        icon: row.icon,
        amount: parseFloat(row.amount)
      }))
    });
    
  } catch (error) {
    logger.error('Get income stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all income for user
app.get('/income', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      categoryId, 
      dateFrom, 
      dateTo,
      search,  // Search in description, source, notes
      sortBy = 'transaction_date',
      sortOrder = 'desc'
    } = req.query;
    
    let query = `
      SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM income i
      JOIN categories c ON i.category_id = c.id
      WHERE i.user_id = $1
    `;
    
    const params = [req.user.userId];
    let paramCount = 1;
    
    if (categoryId) {
      query += ` AND i.category_id = $${++paramCount}`;
      params.push(categoryId);
    }
    
    if (dateFrom) {
      query += ` AND i.transaction_date >= $${++paramCount}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND i.transaction_date <= $${++paramCount}`;
      // Add time to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      params.push(endDate.toISOString());
    }

    // Add search functionality for description, source, and notes
    if (search && search.trim()) {
      query += ` AND (
        LOWER(i.description) LIKE LOWER($${++paramCount}) OR 
        LOWER(i.source) LIKE LOWER($${++paramCount}) OR
        LOWER(i.notes) LIKE LOWER($${++paramCount})
      )`;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    const validSortFields = ['transaction_date', 'amount', 'created_at'];
    const validSortOrders = ['asc', 'desc'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'transaction_date';
    const finalSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';
    
    query += ` ORDER BY i.${finalSortBy} ${finalSortOrder}`;
    
    const offset = (page - 1) * limit;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Update count query to include search filter
    let countQuery = `
      SELECT COUNT(*) 
      FROM income i 
      WHERE i.user_id = $1
    `;
    
    const countParams = [req.user.userId];
    let countParamCount = 1;
    
    if (categoryId) {
      countQuery += ` AND i.category_id = $${++countParamCount}`;
      countParams.push(categoryId);
    }
    
    if (dateFrom) {
      countQuery += ` AND i.transaction_date >= $${++countParamCount}`;
      countParams.push(dateFrom);
    }
    
    if (dateTo) {
      countQuery += ` AND i.transaction_date <= $${++countParamCount}`;
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      countParams.push(endDate.toISOString());
    }

    // Add search to count query
    if (search && search.trim()) {
      countQuery += ` AND (
        LOWER(i.description) LIKE LOWER($${++countParamCount}) OR 
        LOWER(i.source) LIKE LOWER($${++countParamCount}) OR
        LOWER(i.notes) LIKE LOWER($${++countParamCount})
      )`;
      const searchPattern = `%${search.trim()}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      income: result.rows.map(row => ({
        id: row.id,
        categoryId: row.category_id,
        category: {
          name: row.category_name,
          color: row.category_color,
          icon: row.category_icon
        },
        amount: parseFloat(row.amount),
        description: row.description,
        transactionDate: row.transaction_date,
        userDate: row.user_date,
        userTime: row.user_time,
        location: row.source,  // Return as 'location' to frontend
        isRecurring: row.is_recurring,
        frequency: row.frequency,
        nextExpectedDate: row.next_expected_date,
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get income error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get income by ID
app.get('/income/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM income i
       JOIN categories c ON i.category_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    const row = result.rows[0];
    
    res.json({
      income: {
        id: row.id,
        categoryId: row.category_id,
        category: {
          name: row.category_name,
          color: row.category_color,
          icon: row.category_icon
        },
        amount: parseFloat(row.amount),
        description: row.description,
        transactionDate: row.transaction_date,
        userDate: row.user_date,
        userTime: row.user_time,
        location: row.source,  // Return as 'location' to frontend
        isRecurring: row.is_recurring,
        frequency: row.frequency,
        nextExpectedDate: row.next_expected_date,
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Get income error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new income
app.post('/income', authenticateToken, async (req, res) => {
  try {
    const { error, value } = incomeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { categoryId, amount, description, transactionDate, userDate, userTime, location, tags, notes } = value;
    
    // Verify category exists and belongs to user (income or both type)
    const categoryCheck = await db.query(
      'SELECT id, name FROM categories WHERE id = $1 AND user_id = $2 AND type IN ($3, $4)',
      [categoryId, req.user.userId, 'income', 'both']
    );
    
    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category or category not found' });
    }
    
    // 🚫 CRITICAL VALIDATION: Check if category is a leaf category (has no children)
    const childrenCheck = await db.query(
      'SELECT id FROM categories WHERE parent_id = $1 AND user_id = $2',
      [categoryId, req.user.userId]
    );
    
    if (childrenCheck.rows.length > 0) {
      logger.warn(`🚫 BLOCKED: User ${req.user.userId} tried to add income to parent category "${categoryCheck.rows[0].name}" (${categoryId}) which has ${childrenCheck.rows.length} subcategories`);
      return res.status(400).json({ 
        error: 'Cannot add income to parent category',
        message: 'Income can only be added to categories without subcategories. This category has subcategories.',
        categoryName: categoryCheck.rows[0].name,
        subcategoryCount: childrenCheck.rows.length
      });
    }
    
    // Handle recurring fields
    const isRecurring = req.body.isRecurring || false;
    const frequency = req.body.frequency || 'one_time';
    
    // Calculate initial next_expected_date if recurring  
    let nextExpectedDate = null;
    if (isRecurring && frequency !== 'one_time') {
      // Use helper function (defined later in the file)
      const date = new Date(userDate);
      switch (frequency) {
        case 'daily': date.setDate(date.getDate() + 1); break;
        case 'weekly': date.setDate(date.getDate() + 7); break;
        case 'bi_weekly': date.setDate(date.getDate() + 14); break;
        case 'semi_monthly': date.setDate(date.getDate() + 15); break;
        case 'monthly': date.setMonth(date.getMonth() + 1); break;
        case 'bi_monthly': date.setMonth(date.getMonth() + 2); break;
        case 'quarterly': date.setMonth(date.getMonth() + 3); break;
        case 'semi_annually': date.setMonth(date.getMonth() + 6); break;
        case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
      }
      nextExpectedDate = date.toISOString().split('T')[0];
    }
    
    // Create income
    // Store 'location' in 'source' column for now (DB column name)
    const result = await db.query(
      `INSERT INTO income (user_id, category_id, amount, description, transaction_date, user_date, user_time, source, is_recurring, frequency, next_expected_date, tags, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [req.user.userId, categoryId, amount, description, transactionDate, userDate, userTime, location, isRecurring, frequency, nextExpectedDate, tags, notes]
    );
    
    // Get income with category info
    const incomeResult = await db.query(
      `SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM income i
       JOIN categories c ON i.category_id = c.id
       WHERE i.id = $1`,
      [result.rows[0].id]
    );
    
    const row = incomeResult.rows[0];
    
    logger.info(`Income created: ${amount} by user ${req.user.userId}`);
    
    res.status(201).json({
      message: 'Income created successfully',
      income: {
        id: row.id,
        categoryId: row.category_id,
        category: {
          name: row.category_name,
          color: row.category_color,
          icon: row.category_icon
        },
        amount: parseFloat(row.amount),
        description: row.description,
        transactionDate: row.transaction_date,
        userDate: row.user_date,
        userTime: row.user_time,
        location: row.source,  // Return as 'location' to frontend
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Create income error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update income
app.put('/income/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error, value } = incomeUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Check if income exists and belongs to user
    const existingIncome = await db.query(
      'SELECT * FROM income WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingIncome.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    // If categoryId is being updated, verify it exists and belongs to user
    if (value.categoryId) {
      const categoryCheck = await db.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type IN ($3, $4)',
        [value.categoryId, req.user.userId, 'income', 'both']
      );
      
      if (categoryCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid category or category not found' });
      }
    }
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;
    
    // Map frontend field names to database column names
    const fieldMapping = {
      'categoryId': 'category_id',
      'transactionDate': 'transaction_date',
      'userDate': 'user_date',
      'userTime': 'user_time',
      'description': 'description',
      'amount': 'amount',
      'location': 'source',  // Frontend sends 'location', DB column is 'source'
      'isRecurring': 'is_recurring',
      'frequency': 'frequency',
      'nextExpectedDate': 'next_expected_date',
      'tags': 'tags',
      'notes': 'notes'
    };
    
    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        const dbColumn = fieldMapping[key] || key;
        updateFields.push(`${dbColumn} = $${++paramCount}`);
        values.push(value[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, req.user.userId);
    
    const updateQuery = `
      UPDATE income 
      SET ${updateFields.join(', ')} 
      WHERE id = $${++paramCount} AND user_id = $${++paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    // Get updated income with category info
    const incomeResult = await db.query(
      `SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM income i
       JOIN categories c ON i.category_id = c.id
       WHERE i.id = $1`,
      [result.rows[0].id]
    );
    
    const row = incomeResult.rows[0];
    
    logger.info(`Income updated: ${id} by user ${req.user.userId}`);
    
    res.json({
      message: 'Income updated successfully',
      income: {
        id: row.id,
        categoryId: row.category_id,
        category: {
          name: row.category_name,
          color: row.category_color,
          icon: row.category_icon
        },
        amount: parseFloat(row.amount),
        description: row.description,
        transactionDate: row.transaction_date,
        userDate: row.user_date,
        userTime: row.user_time,
        location: row.source,  // Return as 'location' to frontend
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Update income error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete income
app.delete('/income/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM income WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    logger.info(`Income deleted: ${id} by user ${req.user.userId}`);
    
    res.json({ message: 'Income deleted successfully' });
    
  } catch (error) {
    logger.error('Delete income error:', error);
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

// ========================================
// RECURRING INCOME SCHEDULER
// ========================================

// Helper function to calculate next expected date based on frequency
const calculateNextExpectedDate = (currentDate, frequency) => {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'bi_weekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'semi_monthly':
      date.setDate(date.getDate() + 15);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'bi_monthly':
      date.setMonth(date.getMonth() + 2);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'semi_annually':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return null;
  }
  
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

// Process recurring income - create new instances for due recurring income
const processRecurringIncome = async () => {
  try {
    logger.info('🔄 Processing recurring income...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Find all recurring income that are due (next_expected_date <= today)
    const dueIncome = await db.query(
      `SELECT * FROM income 
       WHERE is_recurring = true 
       AND next_expected_date IS NOT NULL 
       AND next_expected_date <= $1`,
      [today]
    );
    
    logger.info(`Found ${dueIncome.rows.length} recurring income due for processing`);
    
    for (const income of dueIncome.rows) {
      try {
        // Create a new income instance
        const newIncome = await db.query(
          `INSERT INTO income (user_id, category_id, amount, description, transaction_date, user_date, user_time, source, is_recurring, frequency, next_expected_date, tags, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
           RETURNING *`,
          [
            income.user_id,
            income.category_id,
            income.amount,
            income.description,
            new Date().toISOString(), // Current timestamp
            today, // Today's date
            new Date().toTimeString().split(' ')[0], // Current time HH:MM:SS
            income.source,
            false, // New instance is not recurring (only the template is)
            income.frequency,
            null, // New instance doesn't need next_expected_date
            income.tags,
            income.notes
          ]
        );
        
        // Update the original recurring income's next_expected_date
        const nextDate = calculateNextExpectedDate(income.next_expected_date, income.frequency);
        await db.query(
          'UPDATE income SET next_expected_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [nextDate, income.id]
        );
        
        logger.info(`✅ Created recurring income for user ${income.user_id}, next due: ${nextDate}`);
      } catch (error) {
        logger.error(`❌ Failed to process recurring income ${income.id}:`, error);
      }
    }
    
    logger.info('✅ Recurring income processing completed');
  } catch (error) {
    logger.error('❌ Error in processRecurringIncome:', error);
  }
};

// Schedule recurring transaction processor to run daily at 00:01 AM
cron.schedule('1 0 * * *', () => {
  logger.info('⏰ Running daily recurring income processor');
  processRecurringIncome();
});

// Also run on startup to catch any missed recurring income
setTimeout(() => {
  logger.info('🚀 Running initial recurring income check on startup');
  processRecurringIncome();
}, 10000); // Wait 10 seconds after startup for DB to be ready

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
  logger.info(`Income Service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  logger.info('📅 Recurring income scheduler initialized - runs daily at 00:01 AM');
});
