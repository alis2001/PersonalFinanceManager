// Persian Numbers Utility
// Converts between Latin and Persian digits

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
