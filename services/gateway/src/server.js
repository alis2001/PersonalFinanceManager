const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Finance Gateway...');

// Load service URLs from environment variables
const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL || 'http://10.0.4.141:3000',
  category: process.env.CATEGORY_SERVICE_URL || 'http://10.0.4.238:3000',
  expense: process.env.EXPENSE_SERVICE_URL || 'http://10.0.4.7:3000',
  income: process.env.INCOME_SERVICE_URL || 'http://10.0.3.16:3000',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://10.0.3.165:8000'
};

// CORS configuration - FIXED for browser compatibility
const corsOptions = {
  origin: [
    'http://finance-tracker-alb-1958020418.eu-south-1.elb.amazonaws.com',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Apply CORS BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Finance Gateway',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
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

// Auth Service Proxy - FIXED CORS headers
app.use('/api/auth', createProxyMiddleware({
  target: serviceUrls.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Auth: ${req.method} ${req.originalUrl} → ${serviceUrls.auth}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers to proxy response
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
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
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
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
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
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
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    console.log(`✅ Income Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Income Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Income service unavailable' });
    }
  }
}));

// Analytics Service Proxy
app.use('/api/analytics', createProxyMiddleware({
  target: serviceUrls.analytics,
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  logLevel: 'info',
  timeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`📊 Analytics: ${req.method} ${req.originalUrl} → ${serviceUrls.analytics}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    console.log(`📊 Analytics Response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Analytics Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analytics service unavailable' });
    }
  }
}));

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