const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Finance Gateway...');

// Load service URLs from environment variables (AWS ECS will set these, docker-compose has defaults)
const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth:3000',
  category: process.env.CATEGORY_SERVICE_URL || 'http://category:3000',
  expense: process.env.EXPENSE_SERVICE_URL || 'http://expense:3000',
  income: process.env.INCOME_SERVICE_URL || 'http://income:3000',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics:8000'
};

// Security middleware
app.use(helmet());
app.use(cors());

// Health check (no body needed)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Finance Gateway',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint (no body needed)
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Gateway',
    version: '1.0.0',
    routes: {
      auth: '/api/auth/*',
      categories: '/api/categories/*',
      expenses: '/api/expenses/*',
      income: '/api/income/*',
      analytics: '/api/analytics/*'
    }
  });
});

// Auth Service Proxy
app.use('/api/auth', createProxyMiddleware({
  target: serviceUrls.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Auth: ${req.method} ${req.originalUrl} → ${serviceUrls.auth}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Auth Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Auth Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Auth service unavailable' });
    }
  }
}));

// Category Service Proxy
app.use('/api/categories', createProxyMiddleware({
  target: serviceUrls.category,
  changeOrigin: true,
  pathRewrite: { '^/api/categories': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Categories: ${req.method} ${req.originalUrl} → ${serviceUrls.category}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Categories Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Categories Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Category service unavailable' });
    }
  }
}));

// Expense Service Proxy
app.use('/api/expenses', createProxyMiddleware({
  target: serviceUrls.expense,
  changeOrigin: true,
  pathRewrite: { '^/api/expenses': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Expenses: ${req.method} ${req.originalUrl} → ${serviceUrls.expense}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Expenses Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Expenses Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Expense service unavailable' });
    }
  }
}));

// Income Service Proxy
app.use('/api/income', createProxyMiddleware({
  target: serviceUrls.income,
  changeOrigin: true,
  pathRewrite: { '^/api/income': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Income: ${req.method} ${req.originalUrl} → ${serviceUrls.income}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Income Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Income Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Income service unavailable' });
    }
  }
}));

// *** NEW: Analytics Service Proxy (Python FastAPI) ***
app.use('/api/analytics', createProxyMiddleware({
  target: serviceUrls.analytics,
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  logLevel: 'info',
  timeout: 30000, // 30s timeout for analytics queries
  onProxyReq: (proxyReq, req, res) => {
    console.log(`📊 Analytics: ${req.method} ${req.originalUrl} → ${serviceUrls.analytics}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📊 Analytics Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Analytics Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analytics service unavailable' });
    }
  }
}));

// Body parsing AFTER proxy middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    available: [
      '/api/auth/*', 
      '/api/categories/*', 
      '/api/expenses/*', 
      '/api/income/*',
      '/api/analytics/*',
      '/health'
    ]
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Finance Gateway running on port ${port}`);
  console.log(`✅ Auth proxy: /api/auth/* → ${serviceUrls.auth}`);
  console.log(`✅ Categories proxy: /api/categories/* → ${serviceUrls.category}`);
  console.log(`✅ Expenses proxy: /api/expenses/* → ${serviceUrls.expense}`);
  console.log(`✅ Income proxy: /api/income/* → ${serviceUrls.income}`);
  console.log(`📊 Analytics proxy: /api/analytics/* → ${serviceUrls.analytics}`);
});