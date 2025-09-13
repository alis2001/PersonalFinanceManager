interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  companyName?: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}

interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface VerificationData {
  token?: string;
  code?: string;
}

interface AuthResponse {
  success: boolean;
  user?: any;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
  requiresVerification?: boolean;
  verificationSent?: boolean;
  message?: string;
}

class AuthService {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/auth';

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: userData.password,
          confirmPassword: userData.confirmPassword,
          accountType: userData.accountType,
          companyName: userData.companyName || undefined,
          acceptTerms: userData.acceptTerms,
          marketingConsent: userData.marketingConsent || false
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { 
          success: true, 
          user: data.user,
          requiresVerification: data.requiresVerification,
          verificationSent: data.verificationSent,
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async login(loginData: LoginData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password,
          rememberMe: loginData.rememberMe || false
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        this.setTokens(data.tokens);
        return { 
          success: true, 
          user: data.user,
          tokens: data.tokens,
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Login failed',
          requiresVerification: data.requiresVerification,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async verifyEmail(verificationData: VerificationData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Auto-login after successful verification
        if (data.tokens) {
          this.setTokens(data.tokens);
        }
        
        return { 
          success: true, 
          user: data.user,
          tokens: data.tokens,
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Email verification failed'
        };
      }
    } catch (error) {
      console.error('Email verification error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async resendVerification(email: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { 
          success: true, 
          message: data.message,
          verificationSent: data.verificationSent
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Failed to resend verification email'
        };
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { 
          success: true, 
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Failed to send password reset email'
        };
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async resetPassword(token: string, password: string, confirmPassword: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();
      
      if (response.ok) {
        return { 
          success: true, 
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Password reset failed'
        };
      }
    } catch (error) {
      console.error('Password reset error:', error);
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  async logout(): Promise<void> {
    const token = this.getAccessToken();
    
    if (token) {
      try {
        await fetch(`${this.baseURL}/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Logout failed:', err);
      }
    }

    this.clearTokens();
  }

  async getProfile(): Promise<any | null> {
    const token = this.getAccessToken();
    
    if (!token) return null;

    try {
      const response = await fetch(`${this.baseURL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          return this.getProfile(); // Retry with new token
        } else {
          this.clearTokens();
          return null;
        }
      }
    } catch (err) {
      console.error('Get profile failed:', err);
    }

    return null;
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.tokens);
        return true;
      } else {
        this.clearTokens();
        return false;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      this.clearTokens();
      return false;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  private setTokens(tokens: any): void {
    if (tokens.accessToken) {
      localStorage.setItem('accessToken', tokens.accessToken);
    }
    if (tokens.refreshToken) {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Helper method to check if user needs email verification
  isEmailVerificationError(error: string): boolean {
    return error.includes('Email verification required') || 
           error.includes('verify your email') ||
           error.includes('verification');
  }

  // Helper method to extract email from error response (if available)
  extractEmailFromError(errorData: any): string | null {
    return errorData?.email || null;
  }
}

export default new AuthService();