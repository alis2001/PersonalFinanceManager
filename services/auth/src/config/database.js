const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// PostgreSQL connection with proper timeouts
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000 to 10000
  statement_timeout: 15000, // Add query timeout of 15 seconds
  query_timeout: 15000, // Additional query timeout
});

// Redis connection with proper timeout handling
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    connectTimeout: 10000, // 10 second connection timeout
    commandTimeout: 5000   // 5 second command timeout
  },
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis connected'));

const connectDatabase = async () => {
  try {
    // Test database connection with timeout
    const client = await db.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL connected');
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }
};

const connectRedis = async () => {
  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

module.exports = {
  db,
  redisClient,
  connectDatabase,
  connectRedis
};