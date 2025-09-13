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
      LOGIN_VERIFICATION: 'login_verification',
      PASSWORD_RESET: 'password_reset',
      WELCOME: 'welcome',
      ACCOUNT_LOCKED: 'account_locked',
      PASSWORD_CHANGED: 'password_changed',
      SECURITY_ALERT: 'security_alert',
      NOTIFICATION: 'notification'
    };

    this.emailStatuses = {
      PENDING: 'pending',
      SENDING: 'sending',
      SENT: 'sent',
      FAILED: 'failed',
      BOUNCED: 'bounced',
      DELIVERED: 'delivered',
      OPENED: 'opened',
      CLICKED: 'clicked'
    };
  }

  async logEmailAttempt(emailData) {
    const {
      userId,
      email,
      emailType,
      subject,
      status = this.emailStatuses.PENDING,
      errorMessage = null,
      metadata = {}
    } = emailData;

    try {
      const result = await db.query(
        `INSERT INTO email_logs (user_id, email, email_type, subject, status, error_message, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          userId,
          email,
          emailType,
          subject,
          status,
          errorMessage,
          status === this.emailStatuses.SENT ? new Date() : null
        ]
      );

      const emailLogId = result.rows[0].id;

      // Store additional metadata if provided
      if (Object.keys(metadata).length > 0) {
        await this.logEmailMetadata(emailLogId, metadata);
      }

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

  async updateEmailStatus(emailLogId, status, metadata = {}) {
    try {
      const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const values = [emailLogId, status];
      let paramCount = 2;

      // Add sent_at timestamp if status is sent or delivered
      if (status === this.emailStatuses.SENT || status === this.emailStatuses.DELIVERED) {
        updateFields.push(`sent_at = $${++paramCount}`);
        values.push(new Date());
      }

      // Add error message if status is failed or bounced
      if ((status === this.emailStatuses.FAILED || status === this.emailStatuses.BOUNCED) && metadata.errorMessage) {
        updateFields.push(`error_message = $${++paramCount}`);
        values.push(metadata.errorMessage);
      }

      const query = `UPDATE email_logs SET ${updateFields.join(', ')} WHERE id = $1`;
      await db.query(query, values);

      // Store additional metadata
      if (Object.keys(metadata).length > 0) {
        await this.logEmailMetadata(emailLogId, metadata);
      }

      logger.info('Email status updated', { emailLogId, status });
      return true;
    } catch (error) {
      logger.error('Failed to update email status:', error);
      throw new Error('Email status update failed');
    }
  }

  async logEmailMetadata(emailLogId, metadata) {
    try {
      // Create a simple metadata table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS email_metadata (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email_log_id UUID NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
          key VARCHAR(100) NOT NULL,
          value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert metadata
      for (const [key, value] of Object.entries(metadata)) {
        await db.query(
          'INSERT INTO email_metadata (email_log_id, key, value) VALUES ($1, $2, $3)',
          [emailLogId, key, typeof value === 'object' ? JSON.stringify(value) : String(value)]
        );
      }
    } catch (error) {
      logger.error('Failed to log email metadata:', error);
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
      const result = await db.query(`
        SELECT 
          email_type,
          status,
          COUNT(*) as count,
          MAX(created_at) as last_sent
        FROM email_logs 
        WHERE user_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
        GROUP BY email_type, status
        ORDER BY email_type, status
      `, [userId, dateFrom, dateTo]);

      // Organize stats by email type
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

  async checkEmailRateLimit(userId, emailType, windowMinutes = 60, maxEmails = 5) {
    try {
      const windowStart = new Date(Date.now() - (windowMinutes * 60 * 1000));
      
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM email_logs 
        WHERE user_id = $1 
          AND email_type = $2 
          AND created_at >= $3
          AND status IN ($4, $5)
      `, [userId, emailType, windowStart, this.emailStatuses.SENT, this.emailStatuses.PENDING]);

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

  async getFailedEmails(retryAfterMinutes = 30, maxRetries = 3) {
    try {
      const retryAfter = new Date(Date.now() - (retryAfterMinutes * 60 * 1000));
      
      const result = await db.query(`
        SELECT el.*, em.value as retry_count
        FROM email_logs el
        LEFT JOIN email_metadata em ON el.id = em.email_log_id AND em.key = 'retryCount'
        WHERE el.status = $1 
          AND el.created_at <= $2
          AND COALESCE(CAST(em.value AS INTEGER), 0) < $3
        ORDER BY el.created_at ASC
        LIMIT 100
      `, [this.emailStatuses.FAILED, retryAfter, maxRetries]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get failed emails:', error);
      return [];
    }
  }

  async markEmailForRetry(emailLogId, retryCount = 0) {
    try {
      await this.updateEmailStatus(emailLogId, this.emailStatuses.PENDING, {
        retryCount: retryCount + 1,
        retryTime: new Date()
      });

      logger.info('Email marked for retry', { emailLogId, retryCount: retryCount + 1 });
      return true;
    } catch (error) {
      logger.error('Failed to mark email for retry:', error);
      return false;
    }
  }

  getEmailTypes() {
    return this.emailTypes;
  }

  getEmailStatuses() {
    return this.emailStatuses;
  }
}

module.exports = EmailLogger;