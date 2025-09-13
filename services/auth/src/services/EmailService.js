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

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    try {
      if (!process.env.SMTP_USERNAME || !process.env.SMTP_PASSWORD) {
        logger.warn('SMTP credentials not provided, email service disabled');
        return false;
      }

      // Debug SMTP configuration
      logger.info('SMTP Configuration:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USERNAME,
        passwordLength: process.env.SMTP_PASSWORD.length
      });

      this.transporter = nodemailer.createTransport({
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
      });

      await this.verifyConnection();
      this.initialized = true;
      logger.info('Email service initialized successfully');
      return true;
    } catch (error) {
      // ENHANCED ERROR LOGGING
      logger.error('Failed to initialize email service:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack
      });
      this.initialized = false;
      return false;
    }
  }

  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Transporter not initialized');
    }
    
    try {
      logger.info('Verifying SMTP connection...');
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      throw error;
    }
  }

  async sendEmailVerification(user, verificationToken, verificationCode) {
    const initialized = await this.initialize();
    if (!initialized) {
      logger.warn('Email service not initialized, skipping verification email');
      return { success: false, error: 'Email service not available' };
    }

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify Your Email - ${process.env.APP_NAME || 'Finance Tracker'}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .code { background: white; border: 2px dashed #1a1a1a; padding: 20px; text-align: center; margin: 20px 0; }
            .code-text { font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #1a1a1a; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${process.env.APP_NAME || 'Finance Tracker'}</h1>
                <p>Email Verification Required</p>
            </div>
            <div class="content">
                <h2>Welcome ${user.first_name}!</h2>
                <p>Thank you for creating your ${user.account_type || 'personal'} account. Please verify your email address to activate your account.</p>
                
                ${user.company_name ? `<p><strong>Company:</strong> ${user.company_name}</p>` : ''}
                
                <p><strong>Click the button below to verify your email:</strong></p>
                <p style="text-align: center;">
                    <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </p>
                
                <p>Or use this verification code:</p>
                <div class="code">
                    <div class="code-text">${verificationCode}</div>
                </div>
                
                <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
                
                <hr>
                <p><small>If you didn't create this account, please ignore this email.</small></p>
            </div>
        </div>
    </body>
    </html>`;

    const textContent = `
    Welcome to ${process.env.APP_NAME || 'Finance Tracker'}!
    
    Hi ${user.first_name},
    
    Thank you for creating your ${user.account_type || 'personal'} account. Please verify your email address to activate your account.
    
    ${user.company_name ? `Company: ${user.company_name}` : ''}
    
    Verification Link: ${verificationUrl}
    
    Or use this verification code: ${verificationCode}
    
    This verification link will expire in 24 hours.
    
    If you didn't create this account, please ignore this email.
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Verify Your Email - ${process.env.APP_NAME || 'Finance Tracker'}`,
      html: htmlContent,
      text: textContent
    });
  }

  async sendWelcomeEmail(user) {
    const initialized = await this.initialize();
    if (!initialized) {
      logger.warn('Email service not initialized, skipping welcome email');
      return { success: false, error: 'Email service not available' };
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome - ${process.env.APP_NAME || 'Finance Tracker'}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to ${process.env.APP_NAME || 'Finance Tracker'}!</h1>
            </div>
            <div class="content">
                <h2>Hello ${user.first_name}!</h2>
                <p>Your email has been verified successfully and your account is now active.</p>
                
                ${user.company_name ? `<p>Your ${user.account_type} account for <strong>${user.company_name}</strong> is ready to use.</p>` : ''}
                
                <p>You can now start managing your finances with our powerful tools:</p>
                <ul>
                    <li>Track daily expenses</li>
                    <li>Manage income sources</li>
                    <li>Organize categories</li>
                    <li>Generate reports</li>
                </ul>
                
                <p style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;

    const textContent = `
    Welcome to ${process.env.APP_NAME || 'Finance Tracker'}!
    
    Hello ${user.first_name}!
    
    Your email has been verified successfully and your account is now active.
    
    ${user.company_name ? `Your ${user.account_type} account for ${user.company_name} is ready to use.` : ''}
    
    You can now start managing your finances with our powerful tools:
    - Track daily expenses
    - Manage income sources  
    - Organize categories
    - Generate reports
    
    Visit your dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Welcome to ${process.env.APP_NAME || 'Finance Tracker'}!`,
      html: htmlContent,
      text: textContent
    });
  }

  async sendPasswordReset(user, resetToken) {
    const initialized = await this.initialize();
    if (!initialized) {
      logger.warn('Email service not initialized, skipping password reset email');
      return { success: false, error: 'Email service not available' };
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Password Reset - ${process.env.APP_NAME || 'Finance Tracker'}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <h2>Hello ${user.first_name},</h2>
                <p>You requested a password reset for your account. Click the button below to reset your password:</p>
                
                <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </p>
                
                <div class="warning">
                    <p><strong>Important:</strong> This reset link will expire in 2 hours for security reasons.</p>
                </div>
                
                <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.</p>
            </div>
        </div>
    </body>
    </html>`;

    const textContent = `
    Password Reset Request
    
    Hello ${user.first_name},
    
    You requested a password reset for your account. Use this link to reset your password:
    
    ${resetUrl}
    
    Important: This reset link will expire in 2 hours for security reasons.
    
    If you didn't request this password reset, please ignore this email or contact support.
    `;

    return await this.sendEmail({
      to: user.email,
      subject: `Password Reset - ${process.env.APP_NAME || 'Finance Tracker'}`,
      html: htmlContent,
      text: textContent
    });
  }

  async sendEmail({ to, subject, html, text }) {
    const initialized = await this.initialize();
    if (!initialized) {
      return { success: false, error: 'Email service not available' };
    }

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Finance Tracker'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
        to,
        subject,
        html,
        text
      };

      logger.info('Attempting to send email:', { to, subject });
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId,
        response: result.response
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      logger.error('Failed to send email:', {
        to,
        subject,
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();