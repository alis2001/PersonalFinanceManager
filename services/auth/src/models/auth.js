const Joi = require('joi');

// Enhanced registration schema with company name and account type
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, lowercase letter, number and special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords must match',
      'any.required': 'Password confirmation is required'
    }),
  
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z\\s\\-\']+$'))
    .required()
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
  
  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z\\s\\-\']+$'))
    .required()
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
  
  accountType: Joi.string()
    .valid('personal', 'business')
    .default('personal')
    .messages({
      'any.only': 'Account type must be either personal or business'
    }),
  
  companyName: Joi.string()
    .min(2)
    .max(100)
    .pattern(new RegExp('^[a-zA-Z0-9\\s\\-\\.&,\']+$'))
    .when('accountType', {
      is: 'business',
      then: Joi.required(),
      otherwise: Joi.optional().allow('', null)
    })
    .messages({
      'string.pattern.base': 'Company name contains invalid characters',
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 100 characters',
      'any.required': 'Company name is required for business accounts'
    }),
  
  defaultCurrency: Joi.string()
    .length(3)
    .pattern(new RegExp('^[A-Z]{3}$'))
    .default('USD')
    .messages({
      'string.length': 'Currency code must be exactly 3 characters',
      'string.pattern.base': 'Currency code must be 3 uppercase letters (e.g., USD, EUR)'
    }),
  
  acceptTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions',
      'any.required': 'Terms and conditions acceptance is required'
    }),
  
  marketingConsent: Joi.boolean()
    .default(false)
    .optional()
});

// Login schema with optional verification code
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  
  verificationCode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must contain only numbers'
    }),
  
  rememberMe: Joi.boolean()
    .default(false)
    .optional()
});

// Email verification schema
const emailVerificationSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Verification token is required'
    }),
  
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must contain only numbers'
    })
}).or('token', 'code').messages({
  'object.missing': 'Either verification token or code is required'
});

// Login verification schema
const loginVerificationSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  verificationCode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must contain only numbers',
      'any.required': 'Verification code is required'
    }),
  
  sessionToken: Joi.string()
    .optional()
    .messages({
      'string.base': 'Invalid session token'
    })
});

// Password reset request schema
const passwordResetRequestSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

// Password reset schema
const passwordResetSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, lowercase letter, number and special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required'
    }),
  
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords must match',
      'any.required': 'Password confirmation is required'
    })
});

// Change password schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
    .invalid(Joi.ref('currentPassword'))
    .required()
    .messages({
      'string.pattern.base': 'New password must contain at least one uppercase letter, lowercase letter, number and special character',
      'string.min': 'New password must be at least 8 characters long',
      'string.max': 'New password cannot exceed 128 characters',
      'any.invalid': 'New password must be different from current password',
      'any.required': 'New password is required'
    }),
  
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Password confirmation must match new password',
      'any.required': 'Password confirmation is required'
    })
});

// Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

// Resend verification email schema
const resendVerificationSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

// Update profile schema
const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z\\s\\-\']+$'))
    .optional()
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  
  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z\\s\\-\']+$'))
    .optional()
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  
  companyName: Joi.string()
    .min(2)
    .max(100)
    .pattern(new RegExp('^[a-zA-Z0-9\\s\\-\\.&,\']+$'))
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Company name contains invalid characters',
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 100 characters'
    })
});

// Account type constants
const ACCOUNT_TYPES = {
  PERSONAL: 'personal',
  BUSINESS: 'business'
};

// User status constants
const USER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_VERIFICATION: 'pending_verification'
};

// Verification type constants
const VERIFICATION_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  LOGIN_VERIFICATION: 'login_verification'
};

// Rate limiting constants
const RATE_LIMITS = {
  LOGIN_ATTEMPTS: {
    window: 15 * 60 * 1000, // 15 minutes
    max: 5
  },
  EMAIL_VERIFICATION: {
    window: 60 * 60 * 1000, // 1 hour
    max: 3
  },
  PASSWORD_RESET: {
    window: 60 * 60 * 1000, // 1 hour
    max: 3
  },
  REGISTRATION: {
    window: 60 * 60 * 1000, // 1 hour
    max: 3
  }
};

// Security constants
// BANKING APP PATTERN: Long-lived sessions for mobile users
const SECURITY_SETTINGS = {
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_DURATION: 30 * 60 * 1000, // 30 minutes
  PASSWORD_HISTORY_COUNT: 5,
  SESSION_TIMEOUT: 180 * 24 * 60 * 60 * 1000, // 180 days (6 months) - mobile banking pattern
  REFRESH_TOKEN_EXPIRY: 180 * 24 * 60 * 60 * 1000, // 180 days (like Revolut/Poste Italiane)
  EMAIL_VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  LOGIN_VERIFICATION_EXPIRY: 10 * 60 * 1000, // 10 minutes
  PASSWORD_RESET_EXPIRY: 2 * 60 * 60 * 1000 // 2 hours
};

// Helper functions for validation
const validateAccountType = (accountType, companyName) => {
  if (accountType === ACCOUNT_TYPES.BUSINESS && !companyName) {
    return 'Company name is required for business accounts';
  }
  return null;
};

const validatePasswordStrength = (password) => {
  const minLength = 8;
  const maxLength = 128;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (password.length > maxLength) {
    errors.push(`Password cannot exceed ${maxLength} characters`);
  }
  
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }
  
  return errors;
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .slice(0, 1000); // Limit length to prevent DoS
};

const normalizeEmail = (email) => {
  return email.toLowerCase().trim();
};

module.exports = {
  registerSchema,
  loginSchema,
  emailVerificationSchema,
  loginVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  changePasswordSchema,
  refreshTokenSchema,
  resendVerificationSchema,
  updateProfileSchema,
  ACCOUNT_TYPES,
  USER_STATUSES,
  VERIFICATION_TYPES,
  RATE_LIMITS,
  SECURITY_SETTINGS,
  validateAccountType,
  validatePasswordStrength,
  sanitizeInput,
  normalizeEmail
};