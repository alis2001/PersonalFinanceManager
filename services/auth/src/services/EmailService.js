const { htmlToText } = require('html-to-text');
const winston = require('winston');
const emailConfig = require('../config/email');
const EmailTemplateManager = require('./EmailTemplateManager');
const EmailLogger = require('./EmailLogger');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class EmailService {
  constructor() {
    this.templateManager = new EmailTemplateManager();
    this.emailLogger = new EmailLogger();
    this.config = emailConfig.getConfig();
    this.transporter = emailConfig.getTransporter();
    
    // Initialize templates
    this.initializeService();
  }

  async initializeService() {
    try {
      await this.templateManager.preloadCommonTemplates();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendEmail(options) {
    const {
      to,
      subject,
      templateName,
      templateData = {},
      userId,
      emailType,
      priority = 'normal',
      attachments = [],
      customHtml,
      customText
    } = options;

    let emailLogId = null;

    try {
      // Check rate limiting
      const rateLimitCheck = await this.emailLogger.checkEmailRateLimit(
        userId, 
        emailType,
        this.config.settings.rateLimitWindow || 60,
        this.config.settings.rateLimitMax || 10
      );

      if (rateLimitCheck.isLimitExceeded) {
        throw new Error(`Email rate limit exceeded. Try again after ${rateLimitCheck.resetTime}`);
      }

      // Log email attempt
      emailLogId = await this.emailLogger.logEmailAttempt({
        userId,
        email: to,
        emailType,
        subject,
        status: this.emailLogger.getEmailStatuses().PENDING
      });

      // Generate email content
      let html, text;
      if (customHtml) {
        html = customHtml;
        text = customText || this.convertHtmlToText(html);
      } else if (templateName) {
        const emailContent = await this.templateManager.renderTemplate(templateName, templateData);
        html = emailContent.html;
        text = emailContent.text;
      } else {
        throw new Error('Either templateName or customHtml must be provided');
      }

      // Update status to sending
      await this.emailLogger.updateEmailStatus(
        emailLogId, 
        this.emailLogger.getEmailStatuses().SENDING
      );

      // Prepare mail options
      const mailOptions = {
        from: emailConfig.getFromAddress(),
        to,
        subject,
        html,
        text,
        priority,
        attachments
      };

      // Add custom headers
      mailOptions.headers = {
        'X-Email-Type': emailType,
        'X-User-ID': userId,
        'X-Email-Log-ID': emailLogId,
        ...this.getCustomHeaders(emailType)
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      // Update status to sent
      await this.emailLogger.updateEmailStatus(
        emailLogId, 
        this.emailLogger.getEmailStatuses().SENT,
        {
          messageId: result.messageId,
          response: result.response
        }
      );

      logger.info('Email sent successfully', {
        emailLogId,
        to,
        emailType,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId,
        emailLogId
      };

    } catch (error) {
      // Update status to failed if we have an email log ID
      if (emailLogId) {
        await this.emailLogger.updateEmailStatus(
          emailLogId,
          this.emailLogger.getEmailStatuses().FAILED,
          { errorMessage: error.message }
        );
      }

      logger.error('Failed to send email', {
        emailLogId,
        to,
        emailType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        emailLogId
      };
    }
  }

  async sendEmailVerification(user, verificationToken, verificationCode = null) {
    const templateData = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      accountType: user.account_type,
      companyName: user.company_name,
      verificationUrl: `${this.config.urls.frontend}/verify-email?token=${verificationToken}`,
      verificationCode,
      expiryHours: this.config.settings.emailVerificationExpiry
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Verify Your Email - ${this.config.from.name}`,
      templateName: 'email-verification',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().EMAIL_VERIFICATION,
      priority: 'high'
    });
  }

  async sendLoginVerification(user, verificationCode, loginDetails = {}) {
    const templateData = {
      firstName: user.first_name,
      verificationCode,
      expiryMinutes: this.config.settings.loginVerificationExpiry,
      loginTime: new Date().toLocaleString(),
      ipAddress: loginDetails.ip || 'Unknown',
      userAgent: loginDetails.userAgent || 'Unknown',
      location: loginDetails.location || 'Unknown'
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Login Verification Required - ${this.config.from.name}`,
      templateName: 'login-verification',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().LOGIN_VERIFICATION,
      priority: 'high'
    });
  }

  async sendPasswordReset(user, resetToken, requestDetails = {}) {
    const templateData = {
      firstName: user.first_name,
      resetUrl: `${this.config.urls.frontend}/reset-password?token=${resetToken}`,
      expiryHours: this.config.settings.passwordResetExpiry,
      ipAddress: requestDetails.ip || 'Unknown',
      requestTime: new Date().toLocaleString()
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Password Reset Request - ${this.config.from.name}`,
      templateName: 'password-reset',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().PASSWORD_RESET,
      priority: 'high'
    });
  }

  async sendWelcomeEmail(user) {
    const templateData = {
      firstName: user.first_name,
      lastName: user.last_name,
      accountType: user.account_type,
      companyName: user.company_name,
      dashboardUrl: `${this.config.urls.frontend}/dashboard`
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Welcome to ${this.config.from.name}!`,
      templateName: 'welcome',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().WELCOME,
      priority: 'normal'
    });
  }

  async sendAccountLockedEmail(user, lockDetails = {}) {
    const templateData = {
      firstName: user.first_name,
      lockTime: new Date().toLocaleString(),
      unlockTime: lockDetails.unlockTime ? new Date(lockDetails.unlockTime).toLocaleString() : 'Manual unlock required',
      failedAttempts: lockDetails.failedAttempts || 'Multiple',
      ipAddress: lockDetails.ip || 'Unknown'
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Account Security Alert - ${this.config.from.name}`,
      templateName: 'account-locked',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().ACCOUNT_LOCKED,
      priority: 'high'
    });
  }

  async sendPasswordChangedEmail(user, changeDetails = {}) {
    const templateData = {
      firstName: user.first_name,
      changeTime: new Date().toLocaleString(),
      ipAddress: changeDetails.ip || 'Unknown',
      userAgent: changeDetails.userAgent || 'Unknown'
    };

    return await this.sendEmail({
      to: user.email,
      subject: `Password Changed - ${this.config.from.name}`,
      templateName: 'password-changed',
      templateData,
      userId: user.id,
      emailType: this.emailLogger.getEmailTypes().PASSWORD_CHANGED,
      priority: 'normal'
    });
  }

  async retryFailedEmails() {
    try {
      const failedEmails = await this.emailLogger.getFailedEmails(
        this.config.settings.retryAfterMinutes || 30,
        this.config.settings.maxRetries || 3
      );

      let successCount = 0;
      let failureCount = 0;

      for (const emailLog of failedEmails) {
        try {
          // Mark for retry
          const retryCount = emailLog.retry_count ? parseInt(emailLog.retry_count) : 0;
          await this.emailLogger.markEmailForRetry(emailLog.id, retryCount);

          // Attempt to resend
          const result = await this.sendEmail({
            to: emailLog.email,
            subject: emailLog.subject,
            templateName: this.getTemplateNameFromEmailType(emailLog.email_type),
            templateData: {}, // Would need to reconstruct from metadata
            userId: emailLog.user_id,
            emailType: emailLog.email_type
          });

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }

        } catch (error) {
          logger.error('Failed to retry email:', error);
          failureCount++;
        }
      }

      logger.info(`Email retry completed: ${successCount} successful, ${failureCount} failed`);
      return { successCount, failureCount, totalAttempted: failedEmails.length };

    } catch (error) {
      logger.error('Failed to retry failed emails:', error);
      throw error;
    }
  }

  convertHtmlToText(html) {
    return htmlToText(html, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' }
      ]
    });
  }

  getCustomHeaders(emailType) {
    const headers = {
      'X-Mailer': 'Finance Tracker Email Service',
      'X-Priority': this.getPriorityForEmailType(emailType)
    };

    // Add tracking headers if needed
    if (process.env.EMAIL_TRACKING_ENABLED === 'true') {
      headers['X-Track-Opens'] = 'true';
      headers['X-Track-Clicks'] = 'true';
    }

    return headers;
  }

  getPriorityForEmailType(emailType) {
    const highPriorityTypes = [
      this.emailLogger.getEmailTypes().EMAIL_VERIFICATION,
      this.emailLogger.getEmailTypes().LOGIN_VERIFICATION,
      this.emailLogger.getEmailTypes().PASSWORD_RESET,
      this.emailLogger.getEmailTypes().ACCOUNT_LOCKED
    ];

    return highPriorityTypes.includes(emailType) ? '1' : '3';
  }

  getTemplateNameFromEmailType(emailType) {
    const mapping = {
      [this.emailLogger.getEmailTypes().EMAIL_VERIFICATION]: 'email-verification',
      [this.emailLogger.getEmailTypes().LOGIN_VERIFICATION]: 'login-verification',
      [this.emailLogger.getEmailTypes().PASSWORD_RESET]: 'password-reset',
      [this.emailLogger.getEmailTypes().WELCOME]: 'welcome',
      [this.emailLogger.getEmailTypes().ACCOUNT_LOCKED]: 'account-locked',
      [this.emailLogger.getEmailTypes().PASSWORD_CHANGED]: 'password-changed'
    };

    return mapping[emailType] || 'notification';
  }

  async getEmailHistory(userId, options = {}) {
    return await this.emailLogger.getEmailHistory(userId, options);
  }

  async getEmailStats(userId, dateFrom, dateTo) {
    return await this.emailLogger.getEmailStats(userId, dateFrom, dateTo);
  }

  async testEmailConnection() {
    return await emailConfig.verifyConnection();
  }

  getEmailTypes() {
    return this.emailLogger.getEmailTypes();
  }

  getEmailStatuses() {
    return this.emailLogger.getEmailStatuses();
  }
}

module.exports = new EmailService();