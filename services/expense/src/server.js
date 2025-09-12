const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Expense Service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Expense Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      expenses: 'GET /expenses (coming soon)',
      create: 'POST /expenses (coming soon)'
    }
  });
});

// Coming soon endpoints
app.get('/expenses', (req, res) => {
  res.json({ 
    message: 'Expense endpoints coming soon!',
    mock_expenses: [
      { id: 1, amount: 45.67, description: 'Grocery shopping', date: '2024-01-15' },
      { id: 2, amount: 12.50, description: 'Coffee', date: '2024-01-14' }
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Expense Service listening on port ${port}`);
});