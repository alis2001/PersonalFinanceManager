// Date System Service - Currency-based date system detection
// This service determines whether a user should use Persian or Gregorian calendar
// based on their selected currency (IRR = Persian, all others = Gregorian)

import authService from './authService';

export type DateSystem = 'persian' | 'gregorian';

class DateSystemService {
  /**
   * Get user's date system based on their currency
   * IRR (Iranian Rial) users get Persian calendar
   * All other currencies get Gregorian calendar
   */
  getUserDateSystem(): DateSystem {
    try {
      const user = authService.getUser();
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
  getUserDefaultLanguage(): string {
    try {
      const user = authService.getUser();
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
   * Check if current user should use Persian calendar
   */
  shouldUsePersianCalendar(): boolean {
    return this.getUserDateSystem() === 'persian';
  }

  /**
   * Check if current user should use Gregorian calendar
   */
  shouldUseGregorianCalendar(): boolean {
    return this.getUserDateSystem() === 'gregorian';
  }

  /**
   * Get user's currency code
   */
  getUserCurrency(): string {
    try {
      const user = authService.getUser();
      return user?.defaultCurrency || 'USD';
    } catch (error) {
      console.warn('Error getting user currency, defaulting to USD:', error);
      return 'USD';
    }
  }

  /**
   * Check if user is using Iranian Rial
   */
  isUsingIranianRial(): boolean {
    return this.getUserCurrency() === 'IRR';
  }
}

// Export singleton instance
const dateSystemService = new DateSystemService();
export default dateSystemService;
