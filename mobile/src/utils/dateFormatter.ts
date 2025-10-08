// Date Formatter Utility - Smart date formatting based on user's currency
// This utility provides consistent date formatting across the mobile app
// IRR users get Persian calendar formatting, others get Gregorian

import moment from 'moment-jalaali';
import { formatPersianDate, formatPersianDateForInput } from './persianDateFormatter';
import { toPersianDigits, toLatinDigits } from './persianNumbers';
import dateSystemService from '../services/dateSystemService';

/**
 * Format a date for display in the user's preferred calendar system
 * @param date - The date to format
 * @param includeTime - Whether to include time in the format
 * @returns Formatted date string
 */
export const formatDateForDisplay = async (date: Date, includeTime: boolean = false): Promise<string> => {
  const shouldUsePersian = await dateSystemService.shouldUsePersianCalendar();
  
  if (shouldUsePersian) {
    return formatPersianDate(date, includeTime);
  }
  
  // Gregorian formatting
  if (includeTime) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date for input field display
 * @param date - The date to format
 * @param includeTime - Whether to include time in the format
 * @returns Formatted date string for input fields
 */
export const formatDateForInput = async (date: Date, includeTime: boolean = false): Promise<string> => {
  const shouldUsePersian = await dateSystemService.shouldUsePersianCalendar();
  
  if (shouldUsePersian) {
    return formatPersianDateForInput(date, includeTime);
  }
  
  // Gregorian formatting for input
  if (includeTime) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date string from input field
 * @param dateString - The date string to parse
 * @returns Parsed Date object
 */
export const parseDateFromInput = async (dateString: string): Promise<Date> => {
  const shouldUsePersian = await dateSystemService.shouldUsePersianCalendar();
  
  if (shouldUsePersian) {
    // For Persian dates, convert Persian digits to Latin first
    console.log('Parsing Persian date (original):', dateString);
    const latinDateString = toLatinDigits(dateString);
    console.log('Parsing Persian date (latin digits):', latinDateString);
    
    // Try format: 1404/07/01 - 19:33
    if (latinDateString.includes(' - ')) {
      const [datePart, timePart] = latinDateString.split(' - ');
      const m = moment(datePart, 'jYYYY/jMM/jDD');
      if (m.isValid()) {
        const [hours, minutes] = timePart.split(':').map(Number);
        m.hour(hours).minute(minutes).second(0).millisecond(0);
        console.log('Parsed Persian date:', m.toDate());
        console.log('Parsed Persian date ISO:', m.toISOString());
        return m.toDate();
      }
    }
    
    // Try format: 1404/07/01
    const m = moment(latinDateString, 'jYYYY/jMM/jDD');
    if (m.isValid()) {
      console.log('Parsed Persian date (date only):', m.toDate());
      return m.toDate();
    }
    
    // Fallback to standard parsing
    console.log('Fallback to standard parsing');
    return new Date(dateString);
  }
  
  // For Gregorian dates, parse normally
  if (dateString.includes('T')) {
    const [datePart, timePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  
  return new Date(dateString);
};

/**
 * Format a date for database storage (always Gregorian ISO format)
 * @param date - The date to format
 * @returns ISO string for database storage
 */
export const formatDateForStorage = (date: Date): string => {
  return date.toISOString();
};

/**
 * Get current date in user's preferred format
 * @param includeTime - Whether to include time
 * @returns Current date formatted for display
 */
export const getCurrentDateFormatted = async (includeTime: boolean = false): Promise<string> => {
  return await formatDateForDisplay(new Date(), includeTime);
};

/**
 * Format time only (works for both Persian and Gregorian)
 * @param date - The date to extract time from
 * @returns Formatted time string
 */
export const formatTimeOnly = async (date: Date): Promise<string> => {
  const shouldUsePersian = await dateSystemService.shouldUsePersianCalendar();
  
  if (shouldUsePersian) {
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return toPersianDigits(time);
  }
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};
