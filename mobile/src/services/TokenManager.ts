// Token Manager Service
// Handles automatic token refresh to keep users logged in

import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';
import secureStorage from './SecureStorage';
import { logger } from './Logger';

class TokenManager {
  private static instance: TokenManager;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Start automatic token refresh
   * Refreshes token every 45 minutes (before 1-hour expiry)
   */
  startAutoRefresh(): void {
    if (this.refreshInterval) {
      this.stopAutoRefresh();
    }

    // Refresh every 45 minutes (2700000 ms)
    this.refreshInterval = setInterval(async () => {
      await this.refreshTokenIfNeeded();
    }, 45 * 60 * 1000);

    logger.log('🔄 Token auto-refresh started (every 45 minutes)');
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.log('⏹️ Token auto-refresh stopped');
    }
  }

  /**
   * Check if token needs refresh and refresh if needed
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    if (this.isRefreshing) {
      logger.log('🔄 Token refresh already in progress, skipping');
      return false;
    }

    try {
      const accessToken = await secureStorage.getItem('accessToken');
      const refreshToken = await secureStorage.getItem('refreshToken');

      if (!accessToken || !refreshToken) {
        logger.log('❌ No tokens available for refresh');
        return false;
      }

      // Check if access token is close to expiry (within 15 minutes)
      const tokenPayload = this.parseJWT(accessToken);
      if (!tokenPayload || !tokenPayload.exp) {
        logger.log('❌ Invalid access token format');
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = tokenPayload.exp - now;

      // If token expires in less than 15 minutes, refresh it
      if (expiresIn < 15 * 60) {
        logger.log(`🔄 Access token expires in ${Math.floor(expiresIn / 60)} minutes, refreshing...`);
        this.isRefreshing = true;
        
        try {
          const refreshed = await authService.refreshAccessToken();
          
          if (refreshed) {
            logger.log('✅ Token refreshed successfully');
            this.isRefreshing = false;
            return true;
          } else {
            logger.log('❌ Token refresh failed - checking if refresh token is still valid');
            
            // Check if refresh token is still valid
            const refreshPayload = this.parseJWT(refreshToken);
            if (refreshPayload && refreshPayload.exp) {
              const refreshExpiresIn = refreshPayload.exp - now;
              if (refreshExpiresIn > 0) {
                logger.log(`🔄 Refresh token still valid for ${Math.floor(refreshExpiresIn / 86400)} days, retrying...`);
                // Retry once more
                const retryRefreshed = await authService.refreshAccessToken();
                this.isRefreshing = false;
                return retryRefreshed;
              } else {
                logger.log('❌ Refresh token expired - user needs to login again');
                this.isRefreshing = false;
                return false;
              }
            } else {
              logger.log('❌ Invalid refresh token format');
              this.isRefreshing = false;
              return false;
            }
          }
        } catch (error) {
          logger.error('Token refresh error:', error);
          this.isRefreshing = false;
          return false;
        }
      } else {
        logger.log(`✅ Access token still valid for ${Math.floor(expiresIn / 60)} minutes`);
        return true;
      }
    } catch (error) {
      this.isRefreshing = false;
      logger.error('Token refresh check error:', error);
      return false;
    }
  }

  /**
   * Parse JWT token to get payload (React Native compatible)
   */
  private parseJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.error('Invalid JWT format: expected 3 parts, got', parts.length);
        return null;
      }
      
      // Use proper base64 decoding for React Native
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      
      // Decode base64 (React Native compatible)
      const decoded = atob(padded);
      
      return JSON.parse(decoded);
    } catch (error) {
      logger.error('JWT parse error:', error);
      return null;
    }
  }

  /**
   * Force refresh token (for immediate refresh)
   */
  async forceRefresh(): Promise<boolean> {
    logger.log('🔄 Force refreshing token...');
    this.isRefreshing = true;
    
    try {
      const refreshed = await authService.refreshAccessToken();
      this.isRefreshing = false;
      
      if (refreshed) {
        logger.log('✅ Force refresh successful');
        return true;
      } else {
        logger.log('❌ Force refresh failed');
        return false;
      }
    } catch (error) {
      this.isRefreshing = false;
      logger.error('Force refresh error:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated with valid tokens
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await secureStorage.getItem('accessToken');
      const refreshToken = await secureStorage.getItem('refreshToken');

      if (!accessToken || !refreshToken) {
        return false;
      }

      // Check if access token is expired
      const tokenPayload = this.parseJWT(accessToken);
      if (!tokenPayload || !tokenPayload.exp) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = tokenPayload.exp - now;

      // If token is expired, try to refresh
      if (expiresIn <= 0) {
        logger.log('🔄 Access token expired, attempting refresh...');
        return await this.refreshTokenIfNeeded();
      }

      return true;
    } catch (error) {
      logger.error('Authentication check error:', error);
      return false;
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.stopAutoRefresh();
  }
}

export const tokenManager = TokenManager.getInstance();
export default tokenManager;
