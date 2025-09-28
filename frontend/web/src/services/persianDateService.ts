// Persian Date Service - Handles Persian (Jalali) calendar operations
import moment from 'moment-jalaali';

export interface PersianDate {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export type PersianDatePickerValue = string; // YYYY/MM/DD HH:mm

class PersianDateService {
  // Converts Gregorian date string (YYYY-MM-DDTHH:MM) to Persian date object
  toPersianDateObject(gregorianDateTime: string): PersianDate {
    const m = moment(gregorianDateTime);
    return {
      year: m.jYear(),
      month: m.jMonth() + 1, // moment-jalaali months are 0-11
      day: m.jDate(),
      hour: m.hour(),
      minute: m.minute(),
    };
  }

  // Converts Persian date object to Gregorian date string (YYYY-MM-DDTHH:MM)
  toGregorianDateTimeString(persianDate: PersianDate): string {
    const m = moment()
      .jYear(persianDate.year)
      .jMonth(persianDate.month - 1) // moment-jalaali months are 0-11
      .jDate(persianDate.day)
      .hour(persianDate.hour)
      .minute(persianDate.minute);
    return m.format('YYYY-MM-DDTHH:mm');
  }

  // Formats a Persian date object to a display string (e.g., "۱۴۰۲/۰۷/۲۸ ۱۲:۳۰")
  formatPersianDateTime(persianDate: PersianDate): string {
    const m = moment()
      .jYear(persianDate.year)
      .jMonth(persianDate.month - 1)
      .jDate(persianDate.day)
      .hour(persianDate.hour)
      .minute(persianDate.minute);
    return m.format('jYYYY/jMM/jDD HH:mm');
  }

  // Formats a Persian date object to a display date string (e.g., "۱۴۰۲/۰۷/۲۸")
  formatPersianDate(persianDate: PersianDate): string {
    const m = moment()
      .jYear(persianDate.year)
      .jMonth(persianDate.month - 1)
      .jDate(persianDate.day);
    return m.format('jYYYY/jMM/jDD');
  }

  // Parses a Persian date string (e.g., "1402/07/28 12:30") to a PersianDate object
  parsePersianDateTimeString(persianDateTimeString: string): PersianDate {
    const m = moment(persianDateTimeString, 'jYYYY/jMM/jDD HH:mm');
    return {
      year: m.jYear(),
      month: m.jMonth() + 1,
      day: m.jDate(),
      hour: m.hour(),
      minute: m.minute(),
    };
  }

  // Parses a Persian date string (e.g., "1402/07/28") to a PersianDate object
  parsePersianDateString(persianDateString: string): PersianDate {
    const m = moment(persianDateString, 'jYYYY/jMM/jDD');
    return {
      year: m.jYear(),
      month: m.jMonth() + 1,
      day: m.jDate(),
      hour: 0,
      minute: 0,
    };
  }

  // Get current Persian date and time
  getCurrentPersianDateTime(): PersianDate {
    const m = moment();
    return {
      year: m.jYear(),
      month: m.jMonth() + 1,
      day: m.jDate(),
      hour: m.hour(),
      minute: m.minute(),
    };
  }

  // Get current Persian date
  getCurrentPersianDate(): PersianDate {
    const m = moment();
    return {
      year: m.jYear(),
      month: m.jMonth() + 1,
      day: m.jDate(),
      hour: 0,
      minute: 0,
    };
  }
}

export default new PersianDateService();