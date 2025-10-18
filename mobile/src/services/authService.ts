import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithTimeout } from '../utils/NetworkUtils';
import secureStorage from './SecureStorage';

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  defaultCurrency: string;
  acceptTerms: boolean;
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
  // Use API URL from environment variable (works in both dev and production)
  // EXPO_PUBLIC_API_URL is set during build for production, uses local IP in dev
  private baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.123:8080/api';

  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseURL}/auth${endpoint}`;
    
    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        timeout: 30000, // 30 second timeout
      });

      return response;
    } catch (error) {
      console.error('Network error:', error);
      throw new Error('Network error occurred');
    }
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    
    return data;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      const data = await this.handleResponse(response);
      
      return {
        success: true,
        user: data.user,
        tokens: data.tokens,
        requiresVerification: data.requiresVerification,
        verificationSent: data.verificationSent,
        message: data.message,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password,
          rememberMe: true  // BANKING APP PATTERN: Always remember mobile users (180 days)
        }),
      });

      const data = await this.handleResponse(response);
      
      return {
        success: true,
        user: data.user,
        tokens: data.tokens,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  async logout(): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
        },
      });

      await this.handleResponse(response);
      
      // Clear stored tokens
      await this.clearTokens();
      
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, clear local tokens
      await this.clearTokens();
      return {
        success: true,
        message: 'Logged out locally',
      };
    }
  }

  async getProfile(): Promise<any> {
    try {
      const response = await this.makeRequest('/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
        },
      });

      const data = await this.handleResponse(response);
      return data.user;
    } catch (error) {
      console.error('Get profile error:', error);
      
      // If 401 error, try to refresh token and retry
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          try {
            const retryResponse = await this.makeRequest('/profile', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${await this.getAccessToken()}`,
              },
            });
            const retryData = await this.handleResponse(retryResponse);
            return retryData.user;
          } catch (retryError) {
            console.error('Get profile retry error:', retryError);
            return null;
          }
        }
      }
      
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        console.log('No access token found');
        return false;
      }

      // Verify token is still valid by making a request
      // This will automatically refresh the token if it's expired
      const profile = await this.getProfile();
      return profile !== null;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await secureStorage.getItem('accessToken');
    } catch (error) {
      console.error('Get access token error:', error);
      return null;
    }
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await secureStorage.setItem('accessToken', accessToken);
      await secureStorage.setItem('refreshToken', refreshToken);
    } catch (error) {
      console.error('Set tokens error:', error);
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await secureStorage.removeItem('accessToken');
      await secureStorage.removeItem('refreshToken');
      console.log('✅ All tokens cleared');
    } catch (error) {
      console.error('Clear tokens error:', error);
    }
  }

  /**
   * Force clear all authentication data (for debugging)
   */
  async forceLogout(): Promise<void> {
    try {
      await this.clearTokens();
      await AsyncStorage.removeItem('userData');
      console.log('✅ Force logout completed - all data cleared');
    } catch (error) {
      console.error('Force logout error:', error);
    }
  }

  /**
   * Get current user data from AsyncStorage
   * This is a fallback method - the main user data should come from AuthContext
   */
  async getUser(): Promise<any> {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  /**
   * Store user data in AsyncStorage
   * This is used to persist user data for the date system service
   */
  async setUser(userData: any): Promise<void> {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.error('Set user error:', error);
    }
  }

  /**
   * Clear user data from AsyncStorage
   */
  async clearUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Clear user error:', error);
    }
  }

  /**
   * Refresh access token using refresh token
   * This is the key method that keeps users logged in
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await secureStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        console.log('❌ No refresh token available');
        return false;
      }

      console.log('🔄 Attempting to refresh access token...');
      
      const response = await this.makeRequest('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Validate that we received valid tokens
        if (!data.accessToken) {
          console.log('❌ Token refresh failed: No access token in response');
          return false;
        }
        
        // Update stored tokens
        await secureStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          await secureStorage.setItem('refreshToken', data.refreshToken);
        }
        
        console.log('✅ Access token refreshed successfully');
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Token refresh failed:', response.status, errorData);
        
        // Only clear tokens if it's a permanent failure (not a temporary network issue)
        if (response.status === 401 || response.status === 403) {
          console.log('❌ Refresh token invalid/expired - clearing tokens');
          await this.clearTokens();
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      // Don't clear tokens on network errors - might be temporary
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
