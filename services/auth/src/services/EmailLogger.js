const { db } = require('../config/database');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

class EmailLogger {
  constructor() {
    this.emailTypes = {
      EMAIL_VERIFICATION: 'email_verification',
      WELCOME: 'welcome',
      PASSWORD_RESET: 'password_reset',
      LOGIN_VERIFICATION: 'login_verification',
      SECURITY_ALERT: 'security_alert'
    };

    this.emailStatuses = {
      PENDING: 'pending',
      SENT: 'sent',
      FAILED: 'failed',
      DELIVERED: 'delivered'
    };
  }

  async logEmailAttempt(userId, email, emailType, subject, status = 'pending', errorMessage = null) {
    try {
      const result = await db.query(
        `INSERT INTO email_logs (user_id, email, email_type, subject, status, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         RETURNING id`,
        [userId, email, emailType, subject, status, errorMessage]
      );

      const emailLogId = result.rows[0].id;

      logger.info('Email attempt logged', {
        emailLogId,
        userId,
        email,
        emailType,
        status
      });

      return emailLogId;
    } catch (error) {
      logger.error('Failed to log email attempt:', error);
      throw new Error('Email logging failed');
    }
  }

  async updateEmailStatus(emailLogId, status, messageId = null, errorMessage = null) {
    try {
      const updateFields = ['status = $2'];
      const values = [emailLogId, status];
      let paramCount = 2;

      if (status === this.emailStatuses.SENT && messageId) {
        updateFields.push(`sent_at = CURRENT_TIMESTAMP`);
        updateFields.push(`error_message = $${++paramCount}`);
        values.push(messageId);
      }

      if ((status === this.emailStatuses.FAILED) && errorMessage) {
        updateFields.push(`error_message = $${++paramCount}`);
        values.push(errorMessage);
      }

      const query = `UPDATE email_logs SET ${updateFields.join(', ')} WHERE id = $1`;
      await db.query(query, values);

      logger.info('Email status updated', { emailLogId, status });
      return true;
    } catch (error) {
      logger.error('Failed to update email status:', error);
      return false;
    }
  }

  async checkEmailRateLimit(userId, emailType, windowMinutes = 60, maxEmails = 5) {
    try {
      const windowStart = new Date(Date.now() - (windowMinutes * 60 * 1000));
      
      const result = await db.query(
        `SELECT COUNT(*) as count
         FROM email_logs 
         WHERE user_id = $1 
           AND email_type = $2 
           AND created_at >= $3
           AND status IN ($4, $5)`,
        [userId, emailType, windowStart, this.emailStatuses.SENT, this.emailStatuses.PENDING]
      );

      const currentCount = parseInt(result.rows[0].count);
      const isLimitExceeded = currentCount >= maxEmails;

      return {
        isLimitExceeded,
        currentCount,
        maxEmails,
        windowMinutes,
        resetTime: new Date(Date.now() + (windowMinutes * 60 * 1000))
      };
    } catch (error) {
      logger.error('Failed to check email rate limit:', error);
      return { isLimitExceeded: false, currentCount: 0 };
    }
  }

  async getEmailHistory(userId, options = {}) {
    const {
      emailType,
      status,
      limit = 50,
      offset = 0,
      dateFrom,
      dateTo
    } = options;

    try {
      let query = 'SELECT * FROM email_logs WHERE user_id = $1';
      const values = [userId];
      let paramCount = 1;

      if (emailType) {
        query += ` AND email_type = $${++paramCount}`;
        values.push(emailType);
      }

      if (status) {
        query += ` AND status = $${++paramCount}`;
        values.push(status);
      }

      if (dateFrom) {
        query += ` AND created_at >= $${++paramCount}`;
        values.push(dateFrom);
      }

      if (dateTo) {
        query += ` AND created_at <= $${++paramCount}`;
        values.push(dateTo);
      }

      query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      values.push(limit, offset);

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get email history:', error);
      throw new Error('Failed to retrieve email history');
    }
  }

  async getEmailStats(userId, dateFrom, dateTo) {
    try {
      const result = await db.query(
        `SELECT 
          email_type,
          status,
          COUNT(*) as count,
          MAX(created_at) as last_sent
         FROM email_logs 
         WHERE user_id = $1 
           AND created_at >= $2 
           AND created_at <= $3
         GROUP BY email_type, status
         ORDER BY email_type, status`,
        [userId, dateFrom, dateTo]
      );

      const stats = {};
      result.rows.forEach(row => {
        if (!stats[row.email_type]) {
          stats[row.email_type] = {
            total: 0,
            sent: 0,
            failed: 0,
            pending: 0,
            lastSent: null
          };
        }

        stats[row.email_type][row.status] = parseInt(row.count);
        stats[row.email_type].total += parseInt(row.count);
        
        if (row.status === this.emailStatuses.SENT && row.last_sent) {
          stats[row.email_type].lastSent = row.last_sent;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get email stats:', error);
      throw new Error('Failed to retrieve email statistics');
    }
  }

  async getFailedEmails(retryAfterMinutes = 30, maxRetries = 3) {
    try {
      const retryAfter = new Date(Date.now() - (retryAfterMinutes * 60 * 1000));
      
      const result = await db.query(
        `SELECT * FROM email_logs
         WHERE status = $1 
           AND created_at <= $2
         ORDER BY created_at ASC
         LIMIT 100`,
        [this.emailStatuses.FAILED, retryAfter]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get failed emails:', error);
      return [];
    }
  }

  getEmailTypes() {
    return this.emailTypes;
  }

  getEmailStatuses() {
    return this.emailStatuses;
  }
}

module.exports = new EmailLogger();