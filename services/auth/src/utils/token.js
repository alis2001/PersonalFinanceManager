const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      verified: user.email_verified 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );
  
  // BANKING APP PATTERN: Long-lived refresh token for mobile
  // 180 days = ~6 months (like Revolut, Poste Italiane)
  // Access token stays short (1h) for security
  // User only needs PIN after that, no re-login needed
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '180d' }
  );
  
  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const formatUserResponse = (user) => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    status: user.status,
    createdAt: user.created_at,
    lastLogin: user.last_login,
    emailVerified: user.email_verified,
    defaultCurrency: user.default_currency,
    preferredLanguage: user.preferred_language
  };
};

module.exports = {
  generateTokens,
  verifyToken,
  hashPassword,
  comparePassword,
  formatUserResponse
};