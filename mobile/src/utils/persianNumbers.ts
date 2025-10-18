// Persian Numbers Utility
// Converts between Latin and Persian digits with formatting support

/**
 * Convert Latin digits to Persian digits
 * @param text - Text containing Latin digits
 * @returns Text with Persian digits
 */
export const toPersianDigits = (text: string): string => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return text.replace(/[0-9]/g, (digit) => persianDigits[parseInt(digit)]);
};

/**
 * Convert Persian digits to Latin digits
 * @param text - Text containing Persian digits
 * @returns Text with Latin digits
 */
export const toLatinDigits = (text: string): string => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return text.replace(/[۰-۹]/g, (digit) => {
    const index = persianDigits.indexOf(digit);
    return index !== -1 ? index.toString() : digit;
  });
};

/**
 * Convert Arabic digits to Latin digits
 * @param text - Text containing Arabic digits
 * @returns Text with Latin digits
 */
export const toLatinDigitsFromArabic = (text: string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return text.replace(/[٠-٩]/g, (digit) => {
    const index = arabicDigits.indexOf(digit);
    return index !== -1 ? index.toString() : digit;
  });
};

/**
 * Convert any digit format (Latin, Persian, Arabic) to Latin digits
 * @param text - Text containing any digit format
 * @returns Text with Latin digits
 */
export const normalizeDigits = (text: string): string => {
  return toLatinDigitsFromArabic(toLatinDigits(text));
};

/**
 * Format number input with commas and Persian digits for display
 * @param value - Input value (can be Latin or Persian digits)
 * @param usePersian - Whether to convert to Persian digits
 * @returns Formatted string for display
 */
export const formatNumberInput = (value: string, usePersian: boolean = false): string => {
  if (!value) return '';
  
  // First convert any Persian/Arabic to Latin for processing
  const latinValue = normalizeDigits(value);
  
  // Remove all non-numeric characters except decimal point
  const cleaned = latinValue.replace(/[^\d.]/g, '');
  
  // Handle decimal point
  const parts = cleaned.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? parts[1] : '';
  
  // Add commas to integer part
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Combine parts
  let formatted = integerPart;
  if (decimalPart !== '' || cleaned.includes('.')) {
    formatted += '.' + decimalPart;
  }
  
  // Convert to Persian digits if needed
  if (usePersian) {
    formatted = toPersianDigits(formatted);
  }
  
  return formatted;
};

/**
 * Format a number with commas for display (for all currencies)
 * @param amount - Numeric amount
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @param usePersian - Whether to convert to Persian digits
 * @returns Formatted number string with commas
 */
export const formatNumberWithCommas = (amount: number, decimalPlaces: number = 2, usePersian: boolean = false): string => {
  if (isNaN(amount)) return '0';
  
  // Format with proper decimal places
  const formatted = amount.toFixed(decimalPlaces);
  
  // Split into integer and decimal parts
  const parts = formatted.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Add commas to integer part
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Combine parts
  let result = integerPart;
  if (decimalPart && decimalPlaces > 0) {
    result += '.' + decimalPart;
  }
  
  // Convert to Persian digits if needed
  if (usePersian) {
    result = toPersianDigits(result);
  }
  
  return result;
};

/**
 * Format currency amount with proper commas and Persian digits
 * @param amount - Numeric amount
 * @param currencyCode - Currency code (e.g., 'USD', 'IRR')
 * @param language - Language code ('fa' for Persian)
 * @returns Formatted currency string
 */
export const formatCurrencyWithCommas = (amount: number, currencyCode: string = 'USD', language?: string): string => {
  if (isNaN(amount)) return '0';
  
  // Determine decimal places based on currency
  const decimalPlaces = getCurrencyDecimalPlaces(currencyCode);
  const usePersian = language === 'fa' || currencyCode === 'IRR';
  
  // Format the number with commas
  const formattedNumber = formatNumberWithCommas(amount, decimalPlaces, usePersian);
  
  // Get currency symbol
  const symbol = getCurrencySymbol(currencyCode);
  
  // Combine symbol and formatted number
  return `${symbol}${formattedNumber}`;
};

/**
 * Get decimal places for a currency
 * @param currencyCode - Currency code
 * @returns Number of decimal places
 */
const getCurrencyDecimalPlaces = (currencyCode: string): number => {
  const decimalPlacesMap: { [key: string]: number } = {
    'JPY': 0, 'KRW': 0, 'VND': 0, 'IDR': 0, 'IRR': 0, 'VUV': 0,
    'USD': 2, 'EUR': 2, 'GBP': 2, 'CAD': 2, 'AUD': 2, 'CHF': 2,
    'CNY': 2, 'INR': 2, 'BRL': 2, 'MXN': 2, 'SGD': 2, 'HKD': 2,
    'NZD': 2, 'SEK': 2, 'NOK': 2, 'DKK': 2, 'PLN': 2, 'CZK': 2,
    'HUF': 2, 'RUB': 2, 'TRY': 2, 'ZAR': 2, 'AED': 2, 'SAR': 2,
    'EGP': 2, 'ILS': 2, 'RON': 2, 'BGN': 2, 'HRK': 2, 'RSD': 2,
    'UAH': 2, 'BYN': 2, 'KZT': 2, 'UZS': 2, 'KGS': 2, 'TJS': 2,
    'TMT': 2, 'AFN': 2, 'PKR': 2, 'BDT': 2, 'LKR': 2, 'NPR': 2,
    'BTN': 2, 'MVR': 2, 'MMK': 2, 'LAK': 2, 'KHR': 2, 'BND': 2,
    'FJD': 2, 'PGK': 2, 'SBD': 2, 'WST': 2, 'TOP': 2, 'KID': 2,
    'TVD': 2, 'MYR': 2, 'THB': 2, 'PHP': 2
  };
  
  return decimalPlacesMap[currencyCode] || 2;
};

/**
 * Get currency symbol
 * @param currencyCode - Currency code
 * @returns Currency symbol
 */
const getCurrencySymbol = (currencyCode: string): string => {
  const symbolMap: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'C$',
    'AUD': 'A$', 'CHF': 'CHF', 'CNY': '¥', 'INR': '₹', 'IRR': '﷼',
    'BRL': 'R$', 'MXN': '$', 'SGD': 'S$', 'HKD': 'HK$', 'NZD': 'NZ$',
    'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'PLN': 'zł', 'CZK': 'Kč',
    'HUF': 'Ft', 'RUB': '₽', 'TRY': '₺', 'ZAR': 'R', 'KRW': '₩',
    'THB': '฿', 'MYR': 'RM', 'IDR': 'Rp', 'PHP': '₱', 'VND': '₫',
    'AED': 'د.إ', 'SAR': 'ر.س', 'EGP': '£', 'ILS': '₪', 'RON': 'lei',
    'BGN': 'лв', 'HRK': 'kn', 'RSD': 'дин', 'UAH': '₴', 'BYN': 'Br',
    'KZT': '₸', 'UZS': 'so\'m', 'KGS': 'с', 'TJS': 'SM', 'TMT': 'T',
    'AFN': '؋', 'PKR': '₨', 'BDT': '৳', 'LKR': '₨', 'NPR': '₨',
    'BTN': 'Nu.', 'MVR': '.ރ', 'MMK': 'K', 'LAK': '₭', 'KHR': '៛',
    'BND': 'B$', 'FJD': 'FJ$', 'PGK': 'K', 'SBD': 'SI$', 'VUV': 'Vt',
    'WST': 'WS$', 'TOP': 'T$', 'KID': '$', 'TVD': '$'
  };
  
  return symbolMap[currencyCode] || '$';
};

/**
 * Get clean numeric value from formatted input (for database storage)
 * @param value - Formatted value (may contain Persian digits, commas)
 * @returns Clean numeric string
 */
export const getNumericValue = (value: string): string => {
  if (!value) return '';
  
  // Convert to Latin digits and remove commas
  const latin = normalizeDigits(value);
  return latin.replace(/,/g, '');
};

/**
 * Validate numeric input (allows digits, decimal point, Persian/Arabic digits)
 * @param value - Input value to validate
 * @returns true if valid numeric input
 */
export const isValidNumericInput = (value: string): boolean => {
  if (!value) return true;
  
  // Allow Latin digits (0-9), Persian digits (۰-۹), Arabic digits (٠-٩), decimal point, and comma
  return /^[\d۰-۹٠-٩,.]*$/.test(value);
};
