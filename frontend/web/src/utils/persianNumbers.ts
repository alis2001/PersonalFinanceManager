// Persian Number Utilities
// Converts between Latin and Persian digits

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const LATIN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Latin digits to Persian digits
 * @param text - Text containing Latin digits
 * @returns Text with Persian digits
 */
export function toPersianDigits(text: string): string {
  if (!text) return text;
  
  return text.replace(/[0-9]/g, (digit) => {
    const index = LATIN_DIGITS.indexOf(digit);
    return index !== -1 ? PERSIAN_DIGITS[index] : digit;
  });
}

/**
 * Convert Persian digits to Latin digits
 * @param text - Text containing Persian digits
 * @returns Text with Latin digits
 */
export function toLatinDigits(text: string): string {
  if (!text) return text;
  
  return text.replace(/[۰-۹]/g, (digit) => {
    const index = PERSIAN_DIGITS.indexOf(digit);
    return index !== -1 ? LATIN_DIGITS[index] : digit;
  });
}

/**
 * Format a number with Persian digits
 * @param num - Number to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted number with Persian digits
 */
export function formatPersianNumber(num: number, options?: Intl.NumberFormatOptions): string {
  const formatter = new Intl.NumberFormat('fa-IR', options);
  return toPersianDigits(formatter.format(num));
}

/**
 * Format currency with Persian digits
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'IRR')
 * @returns Formatted currency with Persian digits
 */
export function formatPersianCurrency(amount: number, currency: string = 'IRR'): string {
  const formatter = new Intl.NumberFormat('fa-IR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return toPersianDigits(formatter.format(amount));
}

/**
 * Parse Persian number string to number
 * @param persianNumber - String with Persian digits
 * @returns Parsed number
 */
export function parsePersianNumber(persianNumber: string): number {
  const latinNumber = toLatinDigits(persianNumber);
  return parseFloat(latinNumber);
}

/**
 * Check if text contains Persian digits
 * @param text - Text to check
 * @returns True if contains Persian digits
 */
export function hasPersianDigits(text: string): boolean {
  return /[۰-۹]/.test(text);
}

/**
 * Check if text contains Latin digits
 * @param text - Text to check
 * @returns True if contains Latin digits
 */
export function hasLatinDigits(text: string): boolean {
  return /[0-9]/.test(text);
}

/**
 * Convert mixed digits to Persian (for display)
 * @param text - Text that may contain both digit types
 * @returns Text with all digits converted to Persian
 */
export function normalizeToPersianDigits(text: string): string {
  return toPersianDigits(text);
}

/**
 * Convert mixed digits to Latin (for processing)
 * @param text - Text that may contain both digit types
 * @returns Text with all digits converted to Latin
 */
export function normalizeToLatinDigits(text: string): string {
  return toLatinDigits(text);
}
