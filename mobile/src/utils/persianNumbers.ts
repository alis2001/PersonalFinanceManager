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
