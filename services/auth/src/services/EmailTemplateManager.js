const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class EmailTemplateManager {
  constructor() {
    this.templates = new Map();
    this.templatesPath = path.join(__dirname, '..', 'templates', 'emails');
    this.commonData = this.getCommonTemplateData();
    this.initializeHelpers();
  }

  getCommonTemplateData() {
    return {
      appName: process.env.APP_NAME || 'Finance Tracker',
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@financetracker.com',
      companyName: process.env.COMPANY_NAME || 'Finance Tracker',
      year: new Date().getFullYear(),
      brandColor: process.env.BRAND_COLOR || '#1a1a1a',
      logoUrl: process.env.LOGO_URL || null
    };
  }

  initializeHelpers() {
    // Register Handlebars helpers
    handlebars.registerHelper('formatDate', (date, format = 'long') => {
      if (!date) return '';
      const options = format === 'short' 
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(date).toLocaleDateString('en-US', options);
    });

    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('ne', (a, b) => a !== b);
    handlebars.registerHelper('or', (a, b) => a || b);
    handlebars.registerHelper('and', (a, b) => a && b);

    handlebars.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    handlebars.registerHelper('plural', (count, singular, plural) => {
      return count === 1 ? singular : (plural || singular + 's');
    });
  }

  async loadTemplate(templateName) {
    try {
      if (this.templates.has(templateName)) {
        return this.templates.get(templateName);
      }

      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(templateContent);
      
      this.templates.set(templateName, compiledTemplate);
      logger.info(`Email template loaded: ${templateName}`);
      
      return compiledTemplate;
    } catch (error) {
      logger.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Template ${templateName} not found or invalid`);
    }
  }

  async generateEmailContent(templateName, data = {}) {
    try {
      const template = await this.loadTemplate(templateName);
      const mergedData = { ...this.commonData, ...data };
      
      const html = template(mergedData);
      const text = this.generateTextVersion(html);
      
      return { html, text };
    } catch (error) {
      logger.error(`Failed to generate email content for template: ${templateName}`, error);
      throw error;
    }
  }

  generateTextVersion(html) {
    // Convert HTML to plain text
    return html
      .replace(/<style[^>]*>.*?<\/style>/gsi, '')
      .replace(/<script[^>]*>.*?<\/script>/gsi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async preloadCommonTemplates() {
    const commonTemplates = [
      'email-verification',
      'login-verification', 
      'password-reset',
      'welcome',
      'account-locked',
      'password-changed'
    ];

    for (const templateName of commonTemplates) {
      try {
        await this.loadTemplate(templateName);
      } catch (error) {
        logger.warn(`Failed to preload template: ${templateName}`, error);
      }
    }

    logger.info(`Preloaded ${this.templates.size} email templates`);
  }

  clearCache() {
    this.templates.clear();
    logger.info('Email template cache cleared');
  }

  getTemplateVariables(templateName) {
    const templateVariables = {
      'email-verification': [
        'firstName', 'lastName', 'email', 'verificationUrl', 'verificationCode', 
        'expiryHours', 'accountType', 'companyName'
      ],
      'login-verification': [
        'firstName', 'verificationCode', 'expiryMinutes', 'loginTime', 
        'ipAddress', 'userAgent', 'location'
      ],
      'password-reset': [
        'firstName', 'resetUrl', 'expiryHours', 'ipAddress', 'requestTime'
      ],
      'welcome': [
        'firstName', 'lastName', 'accountType', 'companyName', 'dashboardUrl'
      ],
      'account-locked': [
        'firstName', 'lockTime', 'unlockTime', 'failedAttempts', 'ipAddress'
      ],
      'password-changed': [
        'firstName', 'changeTime', 'ipAddress', 'userAgent'
      ]
    };

    return templateVariables[templateName] || [];
  }

  validateTemplateData(templateName, data) {
    const requiredVariables = this.getTemplateVariables(templateName);
    const missingVariables = [];

    for (const variable of requiredVariables) {
      if (!(variable in data) || data[variable] === null || data[variable] === undefined) {
        missingVariables.push(variable);
      }
    }

    if (missingVariables.length > 0) {
      throw new Error(`Missing required template variables for ${templateName}: ${missingVariables.join(', ')}`);
    }

    return true;
  }

  async renderTemplate(templateName, data = {}) {
    try {
      this.validateTemplateData(templateName, data);
      return await this.generateEmailContent(templateName, data);
    } catch (error) {
      logger.error(`Failed to render template ${templateName}:`, error);
      throw error;
    }
  }

  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  async templateExists(templateName) {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = EmailTemplateManager;