import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import currencyService from '../services/currencyService';
import '../styles/Register.css';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  companyName: string;
  defaultCurrency: string;
  acceptTerms: boolean;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'personal',
    companyName: '',
    defaultCurrency: currencyService.getSuggestedCurrency(),
    acceptTerms: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popularCurrencies] = useState(currencyService.getPopularCurrencies());
  
  // Debug: Log the currencies to console
  console.log('Popular currencies:', popularCurrencies);
  console.log('Default currency:', formData.defaultCurrency);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const validateForm = (): string | null => {
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(formData.password)) {
      return 'Password must contain uppercase, lowercase, number and special character';
    }
    
    if (formData.accountType === 'business' && !formData.companyName.trim()) {
      return 'Company name is required for business accounts';
    }
    
    if (!formData.acceptTerms) {
      return 'You must accept the terms and conditions';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const result = await authService.register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      accountType: formData.accountType,
      companyName: formData.accountType === 'business' ? formData.companyName : undefined,
      defaultCurrency: formData.defaultCurrency,
      acceptTerms: formData.acceptTerms,
      marketingConsent: false
    });
    
    if (result.success) {
      if (result.requiresVerification) {
        navigate('/verify-email', { 
          state: { 
            email: formData.email,
            message: 'Please check your email for verification instructions.'
          }
        });
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Registration failed');
    }
    
    setLoading(false);
  };

  return (
    <div className="register">
      <div className="register-container">
        <div className="register-header">
          <h2>Create Account</h2>
          <p>Start your financial journey</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {error && <div className="error-message">{error}</div>}
          
          {/* Account Type Selection */}
          <div className="form-group">
            <label htmlFor="accountType">Account Type</label>
            <select
              id="accountType"
              name="accountType"
              value={formData.accountType}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value="personal">Personal Account</option>
              <option value="business">Business Account</option>
            </select>
          </div>

          {/* Company Name - Only for business accounts */}
          {formData.accountType === 'business' && (
            <div className="form-group">
              <input
                type="text"
                name="companyName"
                placeholder="Company Name"
                value={formData.companyName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Currency Selection */}
          <div className="form-group">
            <label htmlFor="defaultCurrency">Currency</label>
            <select
              id="defaultCurrency"
              name="defaultCurrency"
              value={formData.defaultCurrency}
              onChange={handleChange}
              required
              disabled={loading}
            >
              {popularCurrencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </option>
              ))}
            </select>
            <small className="form-help">
              All your transactions will be recorded in this currency
            </small>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password (8+ chars, uppercase, number, special)"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              minLength={8}
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          {/* Terms and Conditions */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <span className="checkmark"></span>
              I accept the <a href="/terms" target="_blank">Terms and Conditions</a>
            </label>
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <button 
              type="button"
              className="link-button"
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;