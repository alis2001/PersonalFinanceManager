import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/VerifyEmail.css';

interface VerificationState {
  email?: string;
  message?: string;
}

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'manual'>('loading');
  const [message, setMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  const state = location.state as VerificationState;
  const token = searchParams.get('token');
  const email = state?.email || '';

  useEffect(() => {
    if (token) {
      // Auto-verify with token from email link
      verifyWithToken(token);
    } else if (!email) {
      // No token and no email - redirect to login
      navigate('/login');
    } else {
      // Show manual verification form
      setStatus('manual');
      setMessage(state?.message || 'Please enter the verification code sent to your email.');
    }
  }, [token, email, navigate, state]);

  useEffect(() => {
    // Cooldown timer for resend button
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const verifyWithToken = async (verificationToken: string) => {
    try {
      const result = await authService.verifyEmail({ token: verificationToken });
      
      if (result.success) {
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');
        
        // Auto-login with returned tokens
        if (result.tokens) {
          localStorage.setItem('accessToken', result.tokens.accessToken);
          localStorage.setItem('refreshToken', result.tokens.refreshToken);
        }
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Verification failed. The link may be expired or invalid.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Verification failed. Please try again or use the manual verification code.');
    }
  };

  const verifyWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setIsSubmitting(true);
    
    try {
      const result = await authService.verifyEmail({ code: manualCode.trim() });
      
      if (result.success) {
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');
        
        // Auto-login with returned tokens
        if (result.tokens) {
          localStorage.setItem('accessToken', result.tokens.accessToken);
          localStorage.setItem('refreshToken', result.tokens.refreshToken);
        }
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setMessage(result.error || 'Invalid verification code. Please try again.');
      }
    } catch (error) {
      setMessage('Verification failed. Please check your code and try again.');
    }
    
    setIsSubmitting(false);
  };

  const resendVerification = async () => {
    if (!canResend || !email) return;

    setCanResend(false);
    setResendCooldown(60); // 60 second cooldown
    
    try {
      const result = await authService.resendVerification(email);
      
      if (result.success) {
        setMessage('Verification email sent! Please check your inbox and spam folder.');
      } else {
        setMessage(result.error || 'Failed to resend verification email. Please try again.');
        setCanResend(true);
        setResendCooldown(0);
      }
    } catch (error) {
      setMessage('Failed to resend verification email. Please try again.');
      setCanResend(true);
      setResendCooldown(0);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="verify-content">
            <div className="loading-spinner"></div>
            <h2>Verifying your email...</h2>
            <p>Please wait while we verify your email address.</p>
          </div>
        );

      case 'success':
        return (
          <div className="verify-content success">
            <div className="success-icon">✓</div>
            <h2>Email Verified Successfully!</h2>
            <p>{message}</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="verify-content error">
            <div className="error-icon">✕</div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            
            {email && (
              <div className="error-actions">
                <button 
                  onClick={() => {
                    setStatus('manual');
                    setMessage('Enter the 6-digit code from your email:');
                  }}
                  className="btn-secondary"
                >
                  Enter Code Manually
                </button>
                
                <button 
                  onClick={resendVerification}
                  disabled={!canResend}
                  className="btn-primary"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                </button>
              </div>
            )}
            
            <div className="back-to-login">
              <button 
                onClick={() => navigate('/login')}
                className="link-button"
              >
                Back to Login
              </button>
            </div>
          </div>
        );

      case 'manual':
        return (
          <div className="verify-content">
            <div className="verify-icon">📧</div>
            <h2>Verify Your Email</h2>
            <p>{message}</p>
            
            {email && (
              <div className="email-info">
                <strong>Email:</strong> {email}
              </div>
            )}

            <form onSubmit={verifyWithCode} className="verification-form">
              <div className="form-group">
                <label htmlFor="code">Verification Code</label>
                <input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  disabled={isSubmitting}
                  className="code-input"
                />
                <small>Check your email for a 6-digit verification code</small>
              </div>

              <button 
                type="submit" 
                className="btn-primary"
                disabled={isSubmitting || manualCode.length !== 6}
              >
                {isSubmitting ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>

            <div className="resend-section">
              <p>Didn't receive the email?</p>
              <button 
                onClick={resendVerification}
                disabled={!canResend || !email}
                className="btn-secondary"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
              </button>
            </div>

            <div className="help-section">
              <p><strong>Tips:</strong></p>
              <ul>
                <li>Check your spam/junk folder</li>
                <li>Make sure you entered the correct email address</li>
                <li>The verification code expires after 24 hours</li>
              </ul>
            </div>

            <div className="back-to-login">
              <button 
                onClick={() => navigate('/login')}
                className="link-button"
              >
                Back to Login
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="verify-email">
      <div className="verify-container">
        <div className="verify-header">
          <h1>💰 Finance Tracker</h1>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default VerifyEmail;