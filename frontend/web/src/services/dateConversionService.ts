// Date Conversion Service - Ensures consistent date handling across languages
import moment from 'moment-jalaali';
import { toPersianDigits } from '../utils/persianNumbers';

export interface DateConversionResult {
  gregorianDate: string; // YYYY-MM-DDTHH:mm format for database storage
  displayDate: string;   // Formatted date for display in user's language
  isValid: boolean;
  error?: string;
  isPersian?: boolean; // Whether this is a Persian date
  persianDate?: string; // Original Persian date string
}

class DateConversionService {
  /**
   * Converts a Persian date input to Gregorian for database storage
   * @param persianInput - Persian date string (e.g., "1403/09/07 12:30")
   * @param showTime - Whether time is included
   * @returns DateConversionResult
   */
  persianToGregorian(persianInput: string, showTime: boolean = true): DateConversionResult {
    try {
      const format = showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD';
      const m = moment(persianInput, format);
      
      if (!m.isValid()) {
        return {
          gregorianDate: '',
          displayDate: '',
          isValid: false,
          error: 'Invalid Persian date format'
        };
      }

      return {
        gregorianDate: m.format('YYYY-MM-DDTHH:mm'),
        displayDate: m.format(showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD'),
        isValid: true
      };
    } catch (error) {
      return {
        gregorianDate: '',
        displayDate: '',
        isValid: false,
        error: 'Error converting Persian date'
      };
    }
  }

  /**
   * Converts input date to storage format based on language
   * @param inputDate - Date string from user input
   * @param language - Current language ('fa' for Persian, others for Gregorian)
   * @param showTime - Whether time is included
   * @returns DateConversionResult with storage format
   */
  inputToStorage(inputDate: string, language: string, showTime: boolean = true): DateConversionResult {
    try {
      if (language === 'fa') {
        // For Persian language, convert to Gregorian for storage but mark as Persian
        const format = showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD';
        const m = moment(inputDate, format);
        
        if (!m.isValid()) {
          return {
            gregorianDate: '',
            displayDate: '',
            isValid: false,
            error: 'Invalid Persian date format'
          };
        }

        // Store as Gregorian format but with Persian metadata
        const gregorianFormat = m.format('YYYY-MM-DDTHH:mm');
        const persianDisplay = m.format(showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD');
        
        return {
          gregorianDate: gregorianFormat, // Store as Gregorian for database compatibility
          displayDate: persianDisplay,
          isValid: true,
          isPersian: true, // Mark as Persian for later processing
          persianDate: persianDisplay // Keep original Persian date
        };
      } else {
        // For other languages, store as Gregorian date
        const m = moment(inputDate);
        
        if (!m.isValid()) {
          return {
            gregorianDate: '',
            displayDate: '',
            isValid: false,
            error: 'Invalid date format'
          };
        }

        return {
          gregorianDate: m.format('YYYY-MM-DDTHH:mm'), // Store as Gregorian format
          displayDate: m.format(showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'),
          isValid: true,
          isPersian: false
        };
      }
    } catch (error) {
      return {
        gregorianDate: '',
        displayDate: '',
        isValid: false,
        error: 'Error converting date for storage'
      };
    }
  }

  /**
   * Converts a Gregorian date from database to display format based on language
   * @param gregorianDate - Gregorian date string from database (YYYY-MM-DDTHH:mm)
   * @param language - Current language ('fa' for Persian, others for Gregorian)
   * @param showTime - Whether to include time
   * @returns DateConversionResult
   */
  gregorianToDisplay(gregorianDate: string, language: string, showTime: boolean = true): DateConversionResult {
    try {
      const m = moment(gregorianDate);
      
      if (!m.isValid()) {
        return {
          gregorianDate,
          displayDate: '',
          isValid: false,
          error: 'Invalid Gregorian date format'
        };
      }

      let displayDate: string;
      if (language === 'fa') {
        // Persian display format
        displayDate = m.format(showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD');
      } else {
        // Gregorian display format
        displayDate = m.format(showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
      }

      return {
        gregorianDate,
        displayDate,
        isValid: true
      };
    } catch (error) {
      return {
        gregorianDate,
        displayDate: '',
        isValid: false,
        error: 'Error converting Gregorian date'
      };
    }
  }

  /**
   * Validates that a date conversion is consistent
   * @param originalInput - Original user input
   * @param convertedGregorian - Converted Gregorian date
   * @param language - User's language
   * @returns boolean indicating if conversion is consistent
   */
  validateConversion(originalInput: string, convertedGregorian: string, language: string): boolean {
    try {
      const m1 = moment(convertedGregorian);
      if (!m1.isValid()) return false;

      let m2: any;
      if (language === 'fa') {
        const format = originalInput.includes(':') ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD';
        m2 = moment(originalInput, format);
      } else {
        m2 = moment(originalInput);
      }

      if (!m2.isValid()) return false;

      // Check if the dates represent the same moment in time
      return m1.isSame(m2);
    } catch {
      return false;
    }
  }

  /**
   * Gets current date in Gregorian format for database storage
   * @returns string in YYYY-MM-DDTHH:mm format
   */
  getCurrentGregorianDate(): string {
    return moment().format('YYYY-MM-DDTHH:mm');
  }

  /**
   * Gets current date in display format based on language
   * @param language - Current language
   * @param showTime - Whether to include time
   * @returns string in appropriate display format
   */
  getCurrentDisplayDate(language: string, showTime: boolean = true): string {
    const m = moment();
    if (language === 'fa') {
      return m.format(showTime ? 'jYYYY/jMM/jDD HH:mm' : 'jYYYY/jMM/jDD');
    } else {
      return m.format(showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
    }
  }

  /**
   * Formats a Gregorian date for display in user's language
   * @param gregorianDate - Date from database
   * @param language - User's language
   * @param showTime - Whether to include time
   * @returns Formatted date string
   */
  formatForDisplay(gregorianDate: string, language: string, showTime: boolean = true): string {
    const result = this.gregorianToDisplay(gregorianDate, language, showTime);
    return result.isValid ? result.displayDate : gregorianDate;
  }

  /**
   * Ensures all dates in a list are consistently formatted
   * @param dates - Array of date strings
   * @param language - User's language
   * @returns Array of consistently formatted dates
   */
  normalizeDates(dates: string[], language: string): string[] {
    return dates.map(date => this.formatForDisplay(date, language));
  }

  /**
   * Format date for display in tables and lists (short format)
   * @param dateString - Date string from database
   * @param language - User's language
   * @returns Formatted date string
   */
  formatDateShort(dateString: string, language: string): string {
    const m = moment(dateString);
    if (!m.isValid()) return dateString;

    let formatted: string;
    if (language === 'fa') {
      // Persian short format: ۱۴۰۳/۰۷/۰۶
      formatted = m.format('jYYYY/jMM/jDD');
    } else {
      // English short format: Dec 28, 2024
      formatted = m.format('MMM DD, YYYY');
    }

    return language === 'fa' ? toPersianDigits(formatted) : formatted;
  }

  /**
   * Format time for display in tables and lists
   * @param dateString - Date string from database
   * @param language - User's language
   * @returns Formatted time string
   */
  formatTime(dateString: string, language: string): string {
    const m = moment(dateString);
    if (!m.isValid()) return dateString;

    const formatted = m.format('HH:mm');
    return language === 'fa' ? toPersianDigits(formatted) : formatted;
  }

  /**
   * Format date and time for display in tables and lists
   * @param dateString - Date string from database
   * @param language - User's language
   * @returns Formatted date and time string
   */
  formatDateTime(dateString: string, language: string): string {
    const m = moment(dateString);
    if (!m.isValid()) return dateString;

    let formatted: string;
    if (language === 'fa') {
      // Persian format: ۱۴۰۳/۰۷/۰۶ ۱۷:۳۲
      formatted = m.format('jYYYY/jMM/jDD HH:mm');
    } else {
      // English format: Dec 28, 2024 5:32 PM
      formatted = m.format('MMM DD, YYYY h:mm A');
    }

    return language === 'fa' ? toPersianDigits(formatted) : formatted;
  }

  /**
   * Format date for display in forms and inputs
   * @param dateString - Date string from database
   * @param language - User's language
   * @param showTime - Whether to include time
   * @returns Formatted date string for forms
   */
  formatDateForForm(dateString: string, language: string, showTime: boolean = false): string {
    const m = moment(dateString);
    if (!m.isValid()) return dateString;

    let formatted: string;
    if (language === 'fa') {
      formatted = showTime ? m.format('jYYYY/jMM/jDD HH:mm') : m.format('jYYYY/jMM/jDD');
    } else {
      formatted = showTime ? m.format('YYYY-MM-DD HH:mm') : m.format('YYYY-MM-DD');
    }

    return language === 'fa' ? toPersianDigits(formatted) : formatted;
  }

  /**
   * Get Persian calendar period for analytics
   * @param dateString - Date string from database
   * @returns Persian calendar period info
   */
  getPersianCalendarPeriod(dateString: string): {
    year: number;
    month: number;
    monthName: string;
    week: number;
    day: number;
  } {
    const m = moment(dateString);
    if (!m.isValid()) {
      return {
        year: 0,
        month: 0,
        monthName: '',
        week: 0,
        day: 0
      };
    }

    const jYear = (m as any).jYear();
    const jMonth = (m as any).jMonth() + 1; // moment-jalaali months are 0-11
    const jDate = (m as any).jDate();
    
    // Persian month names
    const persianMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];

    // Calculate week number in Persian month (rough approximation)
    const weekInMonth = Math.ceil(jDate / 7);

    return {
      year: jYear,
      month: jMonth,
      monthName: persianMonths[jMonth - 1],
      week: weekInMonth,
      day: jDate
    };
  }

  /**
   * Get date range for Persian calendar period
   * @param period - Period type ('monthly', 'weekly', 'yearly')
   * @param language - User's language
   * @returns Date range for the period
   */
  getPersianPeriodRange(period: string, language: string): { start: string; end: string } {
    const now = moment();
    
    if (language === 'fa') {
      // Persian calendar periods
      if (period === 'monthly') {
        const startOfMonth = moment().startOf('jMonth');
        const endOfMonth = moment().endOf('jMonth');
        return {
          start: (startOfMonth as any).format('YYYY-MM-DD'),
          end: (endOfMonth as any).format('YYYY-MM-DD')
        };
      } else if (period === 'weekly') {
        // Persian week (Saturday to Friday)
        const dayOfWeek = (now as any).day(); // 0 = Saturday, 6 = Friday
        const startOfWeek = (now as any).subtract(dayOfWeek, 'days');
        const endOfWeek = (startOfWeek as any).add(6, 'days');
        return {
          start: (startOfWeek as any).format('YYYY-MM-DD'),
          end: (endOfWeek as any).format('YYYY-MM-DD')
        };
      } else if (period === 'yearly') {
        const startOfYear = moment().startOf('jYear');
        const endOfYear = moment().endOf('jYear');
        return {
          start: (startOfYear as any).format('YYYY-MM-DD'),
          end: (endOfYear as any).format('YYYY-MM-DD')
        };
      }
    }
    
    // Default to Gregorian periods
    if (period === 'monthly') {
      const startOfMonth = moment().startOf('month');
      const endOfMonth = moment().endOf('month');
      return {
        start: startOfMonth.format('YYYY-MM-DD'),
        end: endOfMonth.format('YYYY-MM-DD')
      };
    } else if (period === 'weekly') {
      const startOfWeek = moment().startOf('week');
      const endOfWeek = moment().endOf('week');
      return {
        start: startOfWeek.format('YYYY-MM-DD'),
        end: endOfWeek.format('YYYY-MM-DD')
      };
    } else if (period === 'yearly') {
      const startOfYear = moment().startOf('year');
      const endOfYear = moment().endOf('year');
      return {
        start: startOfYear.format('YYYY-MM-DD'),
        end: endOfYear.format('YYYY-MM-DD')
      };
    }

    // Default to current month
    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('month');
    return {
      start: startOfMonth.format('YYYY-MM-DD'),
      end: endOfMonth.format('YYYY-MM-DD')
    };
  }

  /**
   * Format relative time (e.g., "2 hours ago", "3 days ago")
   * @param dateString - Date string from database
   * @param language - User's language
   * @returns Formatted relative time string
   */
  formatRelativeTime(dateString: string, language: string): string {
    const m = moment(dateString);
    if (!m.isValid()) return dateString;

    const relative = m.fromNow();
    
    if (language === 'fa') {
      // Convert common relative time phrases to Persian
      const persianRelative = relative
        .replace('a few seconds ago', 'چند ثانیه پیش')
        .replace('a minute ago', 'یک دقیقه پیش')
        .replace('minutes ago', 'دقیقه پیش')
        .replace('an hour ago', 'یک ساعت پیش')
        .replace('hours ago', 'ساعت پیش')
        .replace('a day ago', 'یک روز پیش')
        .replace('days ago', 'روز پیش')
        .replace('a month ago', 'یک ماه پیش')
        .replace('months ago', 'ماه پیش')
        .replace('a year ago', 'یک سال پیش')
        .replace('years ago', 'سال پیش')
        .replace('in a few seconds', 'در چند ثانیه')
        .replace('in a minute', 'در یک دقیقه')
        .replace('in minutes', 'در دقیقه')
        .replace('in an hour', 'در یک ساعت')
        .replace('in hours', 'در ساعت')
        .replace('in a day', 'در یک روز')
        .replace('in days', 'در روز')
        .replace('in a month', 'در یک ماه')
        .replace('in months', 'در ماه')
        .replace('in a year', 'در یک سال')
        .replace('in years', 'در سال');
      
      return toPersianDigits(persianRelative);
    }

    return relative;
  }
}

export default new DateConversionService();
