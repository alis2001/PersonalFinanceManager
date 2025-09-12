const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');
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

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.ENABLE_CORS === 'true' ? '*' : false,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Finance Gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Tracker API Gateway',
    version: '1.0.0',
    status: 'running',
    routes: {
      auth: '/api/auth/*',
      expenses: '/api/expenses/*',
      income: '/api/income/*',
      categories: '/api/categories/*',
      analytics: '/api/analytics/*',
      reports: '/api/reports/*',
      ml: '/api/ml/*'
    },
    endpoints: {
      health: '/health',
      status: '/status'
    }
  });
});

// Service status endpoint
app.get('/status', async (req, res) => {
  const services = {
    auth: process.env.AUTH_SERVICE_URL,
    expense: process.env.EXPENSE_SERVICE_URL,
    income: process.env.INCOME_SERVICE_URL,
    category: process.env.CATEGORY_SERVICE_URL,
    analytics: process.env.ANALYTICS_ENGINE_URL,
    reporting: process.env.REPORTING_ENGINE_URL,
    ml: process.env.ML_ENGINE_URL
  };

  const serviceStatus = {};
  
  for (const [name, url] of Object.entries(services)) {
    if (url) {
      try {
        const axios = require('axios');
        await axios.get(`${url}/health`, { timeout: 5000 });
        serviceStatus[name] = { status: 'healthy', url };
      } catch (error) {
        serviceStatus[name] = { status: 'unhealthy', url, error: error.message };
      }
    } else {
      serviceStatus[name] = { status: 'not_configured', url: null };
    }
  }

  res.json({
    gateway: 'healthy',
    services: serviceStatus,
    timestamp: new Date().toISOString()
  });
});

// Proxy configurations for Node.js services
const nodeServiceProxyOptions = {
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  onError: (err, req, res) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxying ${req.method} ${req.path} to ${proxyReq.path}`);
  }
};

// Proxy configurations for C++ engines
const cppEngineProxyOptions = {
  ...nodeServiceProxyOptions,
  timeout: 60000, // Longer timeout for C++ processing
  proxyTimeout: 60000
};

// Route proxying to Node.js services
if (process.env.AUTH_SERVICE_URL) {
  app.use('/api/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL,
    pathRewrite: { '^/api/auth': '' },
    ...nodeServiceProxyOptions
  }));
}

if (process.env.EXPENSE_SERVICE_URL) {
  app.use('/api/expenses', createProxyMiddleware({
    target: process.env.EXPENSE_SERVICE_URL,
    pathRewrite: { '^/api/expenses': '' },
    ...nodeServiceProxyOptions
  }));
}

if (process.env.INCOME_SERVICE_URL) {
  app.use('/api/income', createProxyMiddleware({
    target: process.env.INCOME_SERVICE_URL,
    pathRewrite: { '^/api/income': '' },
    ...nodeServiceProxyOptions
  }));
}

if (process.env.CATEGORY_SERVICE_URL) {
  app.use('/api/categories', createProxyMiddleware({
    target: process.env.CATEGORY_SERVICE_URL,
    pathRewrite: { '^/api/categories': '' },
    ...nodeServiceProxyOptions
  }));
}

// Route proxying to C++ engines
if (process.env.ANALYTICS_ENGINE_URL) {
  app.use('/api/analytics', createProxyMiddleware({
    target: process.env.ANALYTICS_ENGINE_URL,
    pathRewrite: { '^/api/analytics': '' },
    ...cppEngineProxyOptions
  }));
}

if (process.env.REPORTING_ENGINE_URL) {
  app.use('/api/reports', createProxyMiddleware({
    target: process.env.REPORTING_ENGINE_URL,
    pathRewrite: { '^/api/reports': '' },
    ...cppEngineProxyOptions
  }));
}

if (process.env.ML_ENGINE_URL) {
  app.use('/api/ml', createProxyMiddleware({
    target: process.env.ML_ENGINE_URL,
    pathRewrite: { '^/api/ml': '' },
    ...cppEngineProxyOptions
  }));
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: ['/api/auth', '/api/expenses', '/api/income', '/api/categories', '/api/analytics', '/api/reports', '/api/ml']
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`, { stack: error.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Finance Gateway listening on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS enabled: ${process.env.ENABLE_CORS || 'false'}`);
  
  // Log configured services
  const services = [
    { name: 'Auth', url: process.env.AUTH_SERVICE_URL },
    { name: 'Expense', url: process.env.EXPENSE_SERVICE_URL },
    { name: 'Income', url: process.env.INCOME_SERVICE_URL },
    { name: 'Category', url: process.env.CATEGORY_SERVICE_URL },
    { name: 'Analytics', url: process.env.ANALYTICS_ENGINE_URL },
    { name: 'Reporting', url: process.env.REPORTING_ENGINE_URL },
    { name: 'ML', url: process.env.ML_ENGINE_URL }
  ];
  
  logger.info('Configured services:');
  services.forEach(service => {
    if (service.url) {
      logger.info(`  ✅ ${service.name}: ${service.url}`);
    } else {
      logger.info(`  ⏸️  ${service.name}: not configured`);
    }
  });
});