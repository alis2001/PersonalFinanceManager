// Persian Date Formatter Utility
// This utility handles formatting dates for display in Persian calendar format

// Import moment-jalaali using require for better React Native compatibility
const moment = require('moment-jalaali');
import { toPersianDigits } from './persianNumbers';

/**
 * Format a date for display in Persian calendar format
 * @param date - The date to format
 * @param includeTime - Whether to include time in the format
 * @returns Formatted Persian date string
 */
export const formatPersianDate = (date: Date, includeTime: boolean = false): string => {
  try {
    const persianMoment = moment(date);
    if (typeof persianMoment.jYear === 'function') {
      const persianDate = persianMoment.format('jYYYY/jMM/jDD');
      const persianDigits = toPersianDigits(persianDate);
      
      if (includeTime) {
        const time = persianMoment.format('HH:mm');
        const persianTime = toPersianDigits(time);
        return `${persianDigits} ${persianTime}`;
      }
      
      return persianDigits;
    } else {
      // Fallback to Gregorian format with Persian digits
      const gregorianDate = persianMoment.format('YYYY/MM/DD');
      const persianDigits = toPersianDigits(gregorianDate);
      
      if (includeTime) {
        const time = persianMoment.format('HH:mm');
        const persianTime = toPersianDigits(time);
        return `${persianDigits} ${persianTime}`;
      }
      
      return persianDigits;
    }
  } catch (error) {
    console.warn('Error formatting Persian date:', error);
    // Fallback to Gregorian format
    return date.toLocaleDateString('fa-IR');
  }
};

/**
 * Format a date for input field display in Persian calendar format
 * @param date - The date to format
 * @param includeTime - Whether to include time in the format
 * @returns Formatted Persian date string for input fields
 */
export const formatPersianDateForInput = (date: Date, includeTime: boolean = false): string => {
  try {
    const persianMoment = moment(date);
    if (typeof persianMoment.jYear === 'function') {
      const persianDate = persianMoment.format('jYYYY/jMM/jDD');
      const persianDigits = toPersianDigits(persianDate);
      
      if (includeTime) {
        const time = persianMoment.format('HH:mm');
        const persianTime = toPersianDigits(time);
        return `${persianDigits} - ${persianTime}`;
      }
      
      return persianDigits;
    } else {
      // Fallback to Gregorian format with Persian digits
      const gregorianDate = persianMoment.format('YYYY/MM/DD');
      const persianDigits = toPersianDigits(gregorianDate);
      
      if (includeTime) {
        const time = persianMoment.format('HH:mm');
        const persianTime = toPersianDigits(time);
        return `${persianDigits} - ${persianTime}`;
      }
      
      return persianDigits;
    }
  } catch (error) {
    console.warn('Error formatting Persian date for input:', error);
    // Fallback to Gregorian format
    return date.toLocaleDateString('fa-IR');
  }
};

/**
 * Get current Persian date
 * @returns Current date in Persian calendar format
 */
export const getCurrentPersianDate = (): string => {
  return formatPersianDate(new Date());
};

/**
 * Get current Persian date and time
 * @returns Current date and time in Persian calendar format
 */
export const getCurrentPersianDateTime = (): string => {
  return formatPersianDate(new Date(), true);
};
