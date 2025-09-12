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
    service: 'Income Service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker Income Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      income: 'GET /income (coming soon)',
      create: 'POST /income (coming soon)'
    }
  });
});

// Coming soon endpoints
app.get('/income', (req, res) => {
  res.json({ 
    message: 'Income endpoints coming soon!',
    mock_income: [
      { id: 1, amount: 4500.00, description: 'Monthly salary', date: '2024-01-01', frequency: 'monthly' },
      { id: 2, amount: 850.00, description: 'Freelance project', date: '2024-01-10', frequency: 'one_time' }
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Income Service listening on port ${port}`);
});