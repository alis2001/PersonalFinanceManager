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
    this.config = this.getEmailConfig();
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
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY) || 5000,
        rateLimitWindow: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW) || 60,
        rateLimitMax: parseInt(process.env.EMAIL_RATE_LIMIT_MAX) || 10
      },
      urls: {
        frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
        api: process.env.API_URL || 'http://localhost:8080'
      },
      branding: {
        appName: process.env.APP_NAME || 'Finance Tracker',
        companyName: process.env.COMPANY_NAME || 'Finance Tracker Inc',
        supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_USERNAME,
        brandColor: process.env.BRAND_COLOR || '#1a1a1a',
        logoUrl: process.env.LOGO_URL || null
      }
    };
  }

  validateConfiguration() {
    const errors = [];

    if (!this.config.smtp.auth.user) {
      errors.push('SMTP_USERNAME is required');
    }

    if (!this.config.smtp.auth.pass) {
      errors.push('SMTP_PASSWORD is required');
    }

    if (!this.config.urls.frontend) {
      errors.push('FRONTEND_URL is required for email verification links');
    }

    if (errors.length > 0) {
      logger.error('Email configuration validation failed:', errors);
      throw new Error(`Email configuration errors: ${errors.join(', ')}`);
    }

    return true;
  }

  getConfig() {
    return this.config;
  }

  getSmtpConfig() {
    return this.config.smtp;
  }

  getFromAddress() {
    return `"${this.config.from.name}" <${this.config.from.email}>`;
  }

  getBrandingConfig() {
    return this.config.branding;
  }

  getUrlConfig() {
    return this.config.urls;
  }

  getSettingsConfig() {
    return this.config.settings;
  }

  // Helper methods for common email operations
  getVerificationUrl(token) {
    return `${this.config.urls.frontend}/verify-email?token=${token}`;
  }

  getPasswordResetUrl(token) {
    return `${this.config.urls.frontend}/reset-password?token=${token}`;
  }

  getDashboardUrl() {
    return `${this.config.urls.frontend}/dashboard`;
  }

  getLoginUrl() {
    return `${this.config.urls.frontend}/login`;
  }

  // Rate limiting configuration
  getEmailRateLimit(emailType) {
    const rateLimits = {
      email_verification: {
        window: this.config.settings.rateLimitWindow,
        max: 3 // Max 3 verification emails per window
      },
      password_reset: {
        window: this.config.settings.rateLimitWindow,
        max: 3 // Max 3 password reset emails per window
      },
      welcome: {
        window: this.config.settings.rateLimitWindow,
        max: 1 // Only 1 welcome email per window
      },
      default: {
        window: this.config.settings.rateLimitWindow,
        max: this.config.settings.rateLimitMax
      }
    };

    return rateLimits[emailType] || rateLimits.default;
  }

  // Email type priority configuration
  getEmailPriority(emailType) {
    const highPriorityTypes = [
      'email_verification',
      'password_reset',
      'login_verification',
      'security_alert'
    ];

    return highPriorityTypes.includes(emailType) ? 'high' : 'normal';
  }
}

module.exports = new EmailConfig();