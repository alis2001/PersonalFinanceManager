const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Finance Gateway...');

// FIXED: Load service URLs from environment variables with Docker service names as defaults
const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth:3000',
  category: process.env.CATEGORY_SERVICE_URL || 'http://category:3000',
  expense: process.env.EXPENSE_SERVICE_URL || 'http://expense:3000',
  income: process.env.INCOME_SERVICE_URL || 'http://income:3000',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics:8000'
};

// FIXED: Dynamic CORS configuration based on environment
const getAllowedOrigins = () => {
  const origins = ['http://localhost:3000', 'http://localhost:8080'];
  
  // Add production origins based on environment
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.API_URL) {
    origins.push(process.env.API_URL);
  }
  if (process.env.PUBLIC_IP) {
    origins.push(`http://${process.env.PUBLIC_IP}:3000`);
    origins.push(`http://${process.env.PUBLIC_IP}:8080`);
  }
  
  // Development wildcard if specified
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_CORS === 'true') {
    origins.push('*');
  }
  
  return origins;
};

const corsOptions = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

console.log('🔒 CORS Origins:', corsOptions.origin);

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

// Enhanced health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Finance Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serviceUrls: serviceUrls
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Finance Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    routes: {
      auth: '/api/auth/*',
      categories: '/api/categories/*',
      expenses: '/api/expenses/*',
      income: '/api/income/*',
      analytics: '/api/analytics/*'
    },
    serviceHealth: {
      auth: serviceUrls.auth,
      category: serviceUrls.category,
      expense: serviceUrls.expense,
      income: serviceUrls.income,
      analytics: serviceUrls.analytics
    }
  });
});

// Enhanced proxy middleware with better error handling
const createEnhancedProxy = (path, target, pathRewrite) => {
  return createProxyMiddleware({
    target: target,
    changeOrigin: true,
    pathRewrite: pathRewrite,
    logLevel: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
    timeout: 30000,
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`✅ ${path}: ${req.method} ${req.originalUrl} → ${target}${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add CORS headers to proxy response
      proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      console.log(`✅ ${path} Response: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ ${path} Proxy Error:`, err.message);
      if (!res.headersSent) {
        res.status(503).json({ 
          error: `${path} service unavailable`,
          message: `Unable to connect to ${target}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
};

// Service Proxies with enhanced error handling
app.use('/api/auth', createEnhancedProxy('Auth', serviceUrls.auth, { '^/api/auth': '' }));
app.use('/api/categories', createEnhancedProxy('Categories', serviceUrls.category, { '^/api/categories': '' }));
app.use('/api/expenses', createEnhancedProxy('Expenses', serviceUrls.expense, { '^/api/expenses': '' }));
app.use('/api/income', createEnhancedProxy('Income', serviceUrls.income, { '^/api/income': '' }));
app.use('/api/analytics', createEnhancedProxy('Analytics', serviceUrls.analytics, { '^/api/analytics': '' }));

// Enhanced 404 handler
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    available: [
      'GET  /health',
      'GET  /',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET  /api/categories',
      'GET  /api/expenses',
      'GET  /api/income',
      'GET  /api/analytics/*'
    ],
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handler
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({
    error: 'Internal gateway error',
    timestamp: new Date().toISOString()
  });
});

// Start server with enhanced logging
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Finance Gateway running on port ${port}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS enabled for: ${corsOptions.origin.join(', ')}`);
  console.log(`✅ Service mappings:`);
  console.log(`   📡 Auth proxy: /api/auth/* → ${serviceUrls.auth}`);
  console.log(`   📁 Categories proxy: /api/categories/* → ${serviceUrls.category}`);
  console.log(`   💰 Expenses proxy: /api/expenses/* → ${serviceUrls.expense}`);
  console.log(`   📈 Income proxy: /api/income/* → ${serviceUrls.income}`);
  console.log(`   📊 Analytics proxy: /api/analytics/* → ${serviceUrls.analytics}`);
  console.log(`🌐 Gateway ready at http://localhost:${port}`);
});