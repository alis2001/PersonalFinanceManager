const nodemailer = require('nodemailer');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class EmailConfig {
  constructor() {
    this.transporter = null;
    this.config = this.getEmailConfig();
    this.initializeTransporter();
  }

  getEmailConfig() {
    return {
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      },
      from: {
        name: process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'Finance Tracker',
        email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME
      },
      settings: {
        emailVerificationExpiry: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS) || 24,
        loginVerificationExpiry: parseInt(process.env.LOGIN_VERIFICATION_EXPIRY_MINUTES) || 10,
        passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS) || 2,
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY) || 5000
      },
      urls: {
        frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
        api: process.env.API_URL || 'http://localhost:8080'
      }
    };
  }

  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter(this.config.smtp);
      logger.info('Email transporter initialized successfully');
      
      // Test connection
      await this.verifyConnection();
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw new Error('Email service initialization failed');
    }
  }

  async verifyConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      return false;
    }
  }

  getTransporter() {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }
    return this.transporter;
  }

  getConfig() {
    return this.config;
  }

  getFromAddress() {
    return `"${this.config.from.name}" <${this.config.from.email}>`;
  }
}

module.exports = new EmailConfig();