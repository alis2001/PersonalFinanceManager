const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Finance Gateway...');

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
      expenses: '/api/expenses/*'
    }
  });
});

// Auth Service Proxy
app.use('/api/auth', createProxyMiddleware({
  target: 'http://auth:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Auth: ${req.method} ${req.originalUrl} → auth:3000${proxyReq.path}`);
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
  target: 'http://category:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/categories': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Categories: ${req.method} ${req.originalUrl} → category:3000${proxyReq.path}`);
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
  target: 'http://expense:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/expenses': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Expenses: ${req.method} ${req.originalUrl} → expense:3000${proxyReq.path}`);
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

// Body parsing AFTER proxy middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    available: ['/api/auth/*', '/api/categories/*', '/api/expenses/*', '/health']
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Finance Gateway running on port ${port}`);
  console.log(`✅ Auth proxy: /api/auth/* → http://auth:3000`);
  console.log(`✅ Categories proxy: /api/categories/* → http://category:3000`);
  console.log(`✅ Expenses proxy: /api/expenses/* → http://expense:3000`);
});