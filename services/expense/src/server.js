const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const winston = require('winston');
const Joi = require('joi');
const axios = require('axios');
const moment = require('moment-jalaali');
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
const expenseSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  amount: Joi.number().positive().max(999999.99).required(),
  description: Joi.string().max(500).optional().allow(''),
  transactionDate: Joi.date().required(),
  userDate: Joi.date().optional(),  // User's local date (timezone-independent)
  userTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional(),  // HH:MM:SS format
  location: Joi.string().max(255).optional().allow(''),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  notes: Joi.string().max(1000).optional().allow('')
});

const expenseUpdateSchema = expenseSchema.keys({
  categoryId: Joi.string().uuid().optional(),
  amount: Joi.number().positive().max(999999.99).optional(),
  transactionDate: Joi.date().optional(),
  userDate: Joi.date().optional(),
  userTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional()
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
      service: 'Expense Service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'Expense Service',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Expense Service',
    version: '1.0.0',
    endpoints: {
      expenses: {
        list: 'GET /expenses',
        create: 'POST /expenses',
        get: 'GET /expenses/:id',
        update: 'PUT /expenses/:id',
        delete: 'DELETE /expenses/:id'
      },
      stats: 'GET /stats',
      health: 'GET /health'
    }
  });
});

// Get expense statistics
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
    
    // Use Persian calendar calculations for IRR users
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
    
    // Get total expense for period - using user_date for timezone-independent filtering
    const totalQuery = `SELECT COALESCE(SUM(amount), 0) as total 
       FROM expenses 
       WHERE user_id = $1 AND ${dateFilter}`;
    
    logger.info(`[STATS] Period: ${period}, Currency: ${userCurrency}`);
    logger.info(`[STATS] Query: ${totalQuery}`);
    
    const totalResult = await db.query(totalQuery, [req.user.userId]);
    
    logger.info(`[STATS] Result: ${totalResult.rows[0].total}`);
    
    // Get category breakdown
    const categoryResult = await db.query(
      `SELECT c.name, c.color, c.icon, COALESCE(SUM(e.amount), 0) as amount
       FROM categories c
       LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = $1 AND ${dateFilter}
       WHERE c.user_id = $1 AND c.type IN ('expense', 'both')
       GROUP BY c.id, c.name, c.color, c.icon
       HAVING SUM(e.amount) > 0
       ORDER BY amount DESC
       LIMIT 5`,
      [req.user.userId]
    );
    
    // Get recent expenses count
    const countResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM expenses 
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
    logger.error('Get expense stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all expenses for user
app.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      categoryId, 
      dateFrom, 
      dateTo,
      search,  // NEW: Add search parameter
      sortBy = 'transaction_date',
      sortOrder = 'desc'
    } = req.query;
    
    let query = `
      SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `;
    
    const params = [req.user.userId];
    let paramCount = 1;
    
    if (categoryId) {
      query += ` AND e.category_id = $${++paramCount}`;
      params.push(categoryId);
    }
    
    if (dateFrom) {
      query += ` AND e.transaction_date >= $${++paramCount}`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND e.transaction_date <= $${++paramCount}`;
      // Add time to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      params.push(endDate.toISOString());
    }

    // NEW: Add search functionality for description and notes
    if (search && search.trim()) {
      query += ` AND (
        LOWER(e.description) LIKE LOWER($${++paramCount}) OR 
        LOWER(e.notes) LIKE LOWER($${++paramCount})
      )`;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }
    
    const validSortFields = ['transaction_date', 'amount', 'created_at'];
    const validSortOrders = ['asc', 'desc'];
    
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'transaction_date';
    const finalSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';
    
    query += ` ORDER BY e.${finalSortBy} ${finalSortOrder}`;
    
    const offset = (page - 1) * limit;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Update count query to include search filter
    let countQuery = `
      SELECT COUNT(*) 
      FROM expenses e 
      WHERE e.user_id = $1
    `;
    
    const countParams = [req.user.userId];
    let countParamCount = 1;
    
    if (categoryId) {
      countQuery += ` AND e.category_id = $${++countParamCount}`;
      countParams.push(categoryId);
    }
    
    if (dateFrom) {
      countQuery += ` AND e.transaction_date >= $${++countParamCount}`;
      countParams.push(dateFrom);
    }
    
    if (dateTo) {
      countQuery += ` AND e.transaction_date <= $${++countParamCount}`;
      // Add time to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      countParams.push(endDate.toISOString());
    }

    // NEW: Add search to count query
    if (search && search.trim()) {
      countQuery += ` AND (
        LOWER(e.description) LIKE LOWER($${++countParamCount}) OR 
        LOWER(e.notes) LIKE LOWER($${++countParamCount})
      )`;
      const searchPattern = `%${search.trim()}%`;
      countParams.push(searchPattern, searchPattern);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      expenses: result.rows.map(row => ({
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
        location: row.location,
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
    logger.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get expense by ID
app.get('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.id = $1 AND e.user_id = $2`,
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const row = result.rows[0];
    
    res.json({
      expense: {
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
        location: row.location,
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Get expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new expense
app.post('/expenses', authenticateToken, async (req, res) => {
  try {
    const { error, value } = expenseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { categoryId, amount, description, transactionDate, userDate, userTime, location, tags, notes } = value;
    
    // Verify category exists and belongs to user
    const categoryCheck = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type IN ($3, $4)',
      [categoryId, req.user.userId, 'expense', 'both']
    );
    
    if (categoryCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category or category not found' });
    }
    
    // Validate that user_date and user_time are provided (required from frontend)
    if (!userDate || !userTime) {
      return res.status(400).json({ 
        error: 'user_date and user_time are required. Please update your app.' 
      });
    }
    
    const finalUserDate = userDate;
    const finalUserTime = userTime;
    
    // Create expense
    const result = await db.query(
      `INSERT INTO expenses (user_id, category_id, amount, description, transaction_date, user_date, user_time, location, tags, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [req.user.userId, categoryId, amount, description, transactionDate, finalUserDate, finalUserTime, location, tags, notes]
    );
    
    // Get expense with category info
    const expenseResult = await db.query(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.id = $1`,
      [result.rows[0].id]
    );
    
    const row = expenseResult.rows[0];
    
    logger.info(`Expense created: ${amount} by user ${req.user.userId}`);
    
    res.status(201).json({
      message: 'Expense created successfully',
      expense: {
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
        location: row.location,
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Create expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update expense
app.put('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error, value } = expenseUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    // Check if expense exists and belongs to user
    const existingExpense = await db.query(
      'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (existingExpense.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    // If categoryId is being updated, verify it exists and belongs to user
    if (value.categoryId) {
      const categoryCheck = await db.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type IN ($3, $4)',
        [value.categoryId, req.user.userId, 'expense', 'both']
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
      'location': 'location',
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
      UPDATE expenses 
      SET ${updateFields.join(', ')} 
      WHERE id = $${++paramCount} AND user_id = $${++paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    // Get updated expense with category info
    const expenseResult = await db.query(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.id = $1`,
      [result.rows[0].id]
    );
    
    const row = expenseResult.rows[0];
    
    logger.info(`Expense updated: ${id} by user ${req.user.userId}`);
    
    res.json({
      message: 'Expense updated successfully',
      expense: {
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
        location: row.location,
        tags: row.tags,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
    
  } catch (error) {
    logger.error('Update expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense
app.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    logger.info(`Expense deleted: ${id} by user ${req.user.userId}`);
    
    res.json({ message: 'Expense deleted successfully' });
    
  } catch (error) {
    logger.error('Delete expense error:', error);
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
  logger.info(`Expense Service listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});