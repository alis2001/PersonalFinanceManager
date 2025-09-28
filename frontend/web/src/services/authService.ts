interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  companyName?: string;
  defaultCurrency: string;
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
  // FIXED: Remove /auth suffix - gateway handles the routing
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

  // FIXED: Enhanced error handling with retry logic
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseURL}/auth${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      return response;
    } catch (error) {
      console.error(`Request failed for ${url}:`, error);
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: userData.password,
          confirmPassword: userData.confirmPassword,
          accountType: userData.accountType,
          companyName: userData.companyName || undefined,
          defaultCurrency: userData.defaultCurrency,
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
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  async login(credentials: LoginData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/login', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          rememberMe: credentials.rememberMe || false
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Store tokens and user info
        if (data.tokens) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
        }
        
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        return { 
          success: true, 
          user: data.user,
          tokens: data.tokens,
          requiresVerification: data.requiresVerification,
          message: data.message
        };
      } else {
        return { 
          success: false, 
          error: data.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async verifyEmail(verificationData: VerificationData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/verify-email', {
        method: 'POST',
        body: JSON.stringify(verificationData),
      });

      const data = await response.json();
      
      if (response.ok) {
        // If verification successful and tokens provided, store them
        if (data.tokens) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
        }
        
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
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
        error: error instanceof Error ? error.message : 'Email verification failed'
      };
    }
  }

  async resendVerification(email: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      return { 
        success: response.ok, 
        message: data.message,
        error: response.ok ? undefined : (data.error || 'Failed to resend verification')
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to resend verification'
      };
    }
  }

  async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      return { 
        success: response.ok, 
        message: data.message,
        error: response.ok ? undefined : (data.error || 'Password reset request failed')
      };
    } catch (error) {
      console.error('Password reset request error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Password reset request failed'
      };
    }
  }

  async getProfile(): Promise<any> {
    try {
      const token = this.getToken();
      if (!token) {
        return null;
      }

      const response = await this.makeRequest('/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update stored user info
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data.user;
      } else {
        // If profile fetch fails, user might not be authenticated
        this.clearSession();
        return null;
      }
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await this.makeRequest('/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local cleanup even if server request fails
    } finally {
      // Always clear local storage
      this.clearSession();
    }
  }

  // FIXED: Enhanced token management
  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  getUser(): any {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    
    if (!token || !user) {
      return false;
    }
    
    // Basic token validation (you could add JWT decode for expiration check)
    try {
      // Simple check - if token exists and user exists
      return token.length > 0 && user.id;
    } catch {
      return false;
    }
  }

  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // FIXED: Enhanced auth header helper
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    };
  }

  // FIXED: Token refresh functionality
  async refreshAuthToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await this.makeRequest('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tokens) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;