const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

const requestLogger = (req, res, next) => {
  const clientInfo = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  };
  
  logger.info('Request received', clientInfo);
  next();
};

const errorHandler = (error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`, { 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message 
      });
    }
    req.validatedData = value;
    next();
  };
};

module.exports = {
  requestLogger,
  errorHandler,
  validateRequest
};