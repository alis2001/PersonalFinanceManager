const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Fixed Gateway...');

// Security middleware
app.use(helmet());
app.use(cors());

// ❌ DO NOT PUT express.json() HERE - it breaks proxy!
// Body parsing MUST come AFTER proxy middleware

// Health check (no body needed)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Fixed Gateway',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint (no body needed)
app.get('/', (req, res) => {
  res.json({
    service: 'Fixed Finance Gateway',
    version: '1.0.0',
    routes: {
      auth: '/api/auth/*',
      categories: '/api/categories/*'
    }
  });
});

// ✅ PROXY MIDDLEWARE FIRST (before body parsing)
app.use('/api/auth', createProxyMiddleware({
  target: 'http://auth:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Proxying ${req.method} ${req.originalUrl} → auth:3000${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response ${proxyRes.statusCode} from auth service`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy failed' });
    }
  }
}));

app.use('/api/categories', createProxyMiddleware({
  target: 'http://category:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/categories': '' },
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`✅ Proxying ${req.method} ${req.originalUrl} → category:3000${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response ${proxyRes.statusCode} from category service`);
  },
  onError: (err, req, res) => {
    console.error('❌ Categories Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy failed' });
    }
  }
}));

// ✅ BODY PARSING AFTER PROXY (for non-proxy routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    available: ['/api/auth/*', '/api/categories/*', '/health']
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Fixed Gateway running on port ${port}`);
  console.log(`✅ Auth proxy: /api/auth/* → http://auth:3000`);
  console.log(`✅ Categories proxy: /api/categories/* → http://category:3000`);
  console.log(`✅ Body parsing configured AFTER proxy middleware`);
});