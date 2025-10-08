// Date System Service - Currency-based date system detection
// This service determines whether a user should use Persian or Gregorian calendar
// based on their selected currency (IRR = Persian, all others = Gregorian)

import authService from './authService';

export type DateSystem = 'persian' | 'gregorian';

class DateSystemService {
  private cachedUserCurrency: string | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  /**
   * Get user's date system based on their currency
   * IRR (Iranian Rial) users get Persian calendar
   * All other currencies get Gregorian calendar
   */
  async getUserDateSystem(): Promise<DateSystem> {
    try {
      const user = await authService.getUser();
      if (!user || !user.defaultCurrency) {
        // Default to Gregorian if no user or currency info
        return 'gregorian';
      }
      
      // IRR users get Persian calendar, everyone else gets Gregorian
      return user.defaultCurrency === 'IRR' ? 'persian' : 'gregorian';
    } catch (error) {
      console.warn('Error getting user date system, defaulting to Gregorian:', error);
      return 'gregorian';
    }
  }

  /**
   * Get user's default language based on their currency
   * IRR users default to Persian (fa), others default to English (en)
   */
  async getUserDefaultLanguage(): Promise<string> {
    try {
      const user = await authService.getUser();
      if (!user || !user.defaultCurrency) {
        return 'en';
      }
      
      // IRR users default to Persian, everyone else defaults to English
      return user.defaultCurrency === 'IRR' ? 'fa' : 'en';
    } catch (error) {
      console.warn('Error getting user default language, defaulting to English:', error);
      return 'en';
    }
  }

  /**
   * Get user's currency code synchronously (with caching)
   */
  getUserCurrencySync(): string {
    // Return cached value if still valid
    if (this.cachedUserCurrency && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedUserCurrency;
    }
    
    // Try to get from AsyncStorage synchronously (this is a fallback)
    // In practice, this should be called after user login when currency is known
    return this.cachedUserCurrency || 'USD';
  }

  /**
   * Set user currency (call this after login)
   */
  setUserCurrency(currency: string): void {
    this.cachedUserCurrency = currency;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Check if current user should use Persian calendar (synchronous)
   */
  shouldUsePersianCalendar(): boolean {
    return this.getUserCurrencySync() === 'IRR';
  }

  /**
   * Check if current user should use Gregorian calendar (synchronous)
   */
  shouldUseGregorianCalendar(): boolean {
    return this.getUserCurrencySync() !== 'IRR';
  }

  /**
   * Check if user is using Iranian Rial (synchronous)
   */
  isUsingIranianRial(): boolean {
    return this.getUserCurrencySync() === 'IRR';
  }

  /**
   * Get user's currency code (async version)
   */
  async getUserCurrency(): Promise<string> {
    try {
      const user = await authService.getUser();
      const currency = user?.defaultCurrency || 'USD';
      this.setUserCurrency(currency); // Cache the result
      return currency;
    } catch (error) {
      console.warn('Error getting user currency, defaulting to USD:', error);
      return 'USD';
    }
  }
}

// Export singleton instance
const dateSystemService = new DateSystemService();
export default dateSystemService;
