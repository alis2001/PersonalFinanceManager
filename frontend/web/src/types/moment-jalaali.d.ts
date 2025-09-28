declare module 'moment-jalaali' {
  import moment from 'moment';
  
  interface MomentJalaali extends moment.Moment {
    jYear(): number;
    jMonth(): number;
    jDate(): number;
    jDay(): number;
    jDaysInMonth(): number;
    jWeek(): number;
    jWeekYear(): number;
    jYear(y: number): MomentJalaali;
    jMonth(m: number): MomentJalaali;
    jDate(d: number): MomentJalaali;
    jDay(d: number): MomentJalaali;
    jWeek(w: number): MomentJalaali;
    jWeekYear(y: number): MomentJalaali;
    startOf(unit: 'jMonth' | 'jYear' | string): MomentJalaali;
    endOf(unit: 'jMonth' | 'jYear' | string): MomentJalaali;
    subtract(amount: number, unit: 'jMonth' | 'jYear' | string): MomentJalaali;
    add(amount: number, unit: 'jMonth' | 'jYear' | string): MomentJalaali;
    clone(): MomentJalaali;
    isSame(other: moment.Moment, unit?: string): boolean;
    format(format: string): string;
    isValid(): boolean;
    hour(): number;
    minute(): number;
    hour(h: number): MomentJalaali;
    minute(m: number): MomentJalaali;
  }
  
  interface MomentJalaaliStatic {
    (): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string, strict?: boolean): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, strict?: boolean): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string): MomentJalaali;
    (inp?: moment.MomentInput, format?: moment.MomentFormatSpecification): MomentJalaali;
    (inp?: moment.MomentInput): MomentJalaali;
    jalaali(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): MomentJalaali;
    jalaali(year: number, month: number, day: number, hour?: number, minute?: number): MomentJalaali;
    jalaali(year: number, month: number, day: number, hour?: number): MomentJalaali;
    jalaali(year: number, month: number, day: number): MomentJalaali;
  }
  
  const momentJalaali: MomentJalaaliStatic;
  export = momentJalaali;
}
