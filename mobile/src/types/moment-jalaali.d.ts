declare module 'moment-jalaali' {
  import moment from 'moment';
  
  interface MomentJalaali extends moment.Moment {
    jYear(): number;
    jYear(year: number): MomentJalaali;
    jMonth(): number;
    jMonth(month: number): MomentJalaali;
    jDate(): number;
    jDate(date: number): MomentJalaali;
    jDayOfYear(): number;
    jDayOfYear(dayOfYear: number): MomentJalaali;
    jWeek(): number;
    jWeek(week: number): MomentJalaali;
    jWeekYear(): number;
    jWeekYear(weekYear: number): MomentJalaali;
    jDaysInMonth(): number;
    jIsLeapYear(): boolean;
    jIsLeapYear(year: number): boolean;
    jFormat(format: string): string;
    jFromArray(array: number[]): MomentJalaali;
    jToArray(): number[];
    jToMoment(): moment.Moment;
    jToGregorian(): { year: number; month: number; date: number };
    jToGregorianArray(): number[];
  }
  
  interface MomentJalaaliStatic extends moment.MomentStatic {
    (): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, strict?: boolean): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string, strict?: boolean): MomentJalaali;
    jIsLeapYear(year: number): boolean;
    jDaysInMonth(year: number, month: number): number;
    jFromArray(array: number[]): MomentJalaali;
    jToMoment(jalaaliMoment: MomentJalaali): moment.Moment;
    jToGregorian(year: number, month: number, date: number): { year: number; month: number; date: number };
    jToGregorianArray(year: number, month: number, date: number): number[];
  }
  
  const momentJalaali: MomentJalaaliStatic;
  export = momentJalaali;
}
