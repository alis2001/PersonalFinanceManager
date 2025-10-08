import React, { useState, useEffect } from 'react';
import moment from 'moment-jalaali';
import dateConversionService from '../services/dateConversionService';
import { toPersianDigits, toLatinDigits } from '../utils/persianNumbers';
import '../styles/PersianDatePicker.css';

interface PersianDatePickerProps {
  value: string; // datetime-local format value (Gregorian)
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showTime?: boolean;
  className?: string;
  type?: 'date' | 'datetime-local';
}

const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = '',
  showTime = true,
  className = '',
  type = 'datetime-local',
}) => {
  const [persianValue, setPersianValue] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(moment()); // Moment object for current view

  useEffect(() => {
    if (value) {
      const m = moment(value);
      if (m.isValid()) {
        const formatted = m.format(type === 'date' ? 'jYYYY/jMM/jDD' : 'jYYYY/jMM/jDD HH:mm');
        setPersianValue(toPersianDigits(formatted));
        setCurrentMonth(m);
      } else {
        setPersianValue('');
      }
    } else {
      setPersianValue('');
    }
  }, [value, type]);

  const handlePersianInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setPersianValue(input);

    // Convert Persian digits to Latin for processing
    const latinInput = toLatinDigits(input);
    
    // For Persian language, store as Persian date format
    const result = dateConversionService.inputToStorage(latinInput, 'fa', showTime);
    
    if (result.isValid) {
      onChange(result.gregorianDate); // This will be Persian format for Persian language
    } else {
      // If input is invalid, clear the value
      onChange('');
    }
  };

  const handleDateSelect = (day: number) => {
    const year = (currentMonth as any).jYear();
    const month = (currentMonth as any).jMonth();
    
    // Create Persian date string for display
    const persianDateString = type === 'date'
      ? `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`
      : `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')} ${moment().format('HH:mm')}`;
    
    setPersianValue(toPersianDigits(persianDateString));
    
    // For Persian language, store as Persian date format
    const result = dateConversionService.inputToStorage(persianDateString, 'fa', showTime);
    if (result.isValid) {
      onChange(result.gregorianDate); // This will be Persian format for Persian language
    } else {
      // Fallback - create Persian format directly
      const fallbackFormat = type === 'date' 
        ? `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}T00:00`
        : `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}T${moment().format('HH:mm')}`;
      onChange(fallbackFormat);
    }
    setShowCalendar(false);
  };

  const renderDays = () => {
    const year = currentMonth.jYear();
    const month = currentMonth.jMonth();
    
    // Get first day of the month
    const firstDay = moment().jYear(year).jMonth(month).jDate(1);
    
    // moment.day(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    // Persian calendar starts on Saturday
    // Headers in LTR: ['ش (Sat)', 'ی (Sun)', 'د (Mon)', 'س (Tue)', 'چ (Wed)', 'پ (Thu)', 'ج (Fri)']
    // Position mapping: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    // Convert moment.day() to Persian grid position:
    // Sunday(0)→1, Monday(1)→2, Tuesday(2)→3, Wednesday(3)→4, Thursday(4)→5, Friday(5)→6, Saturday(6)→0
    const momentDay = firstDay.day();
    const firstDayOfWeek = (momentDay + 1) % 7;
    
    // Get days in month - Persian months have 29 or 30 days, except for the last month which can have 29 or 30
    // We'll use a simple approach: try to set day 30, if it's invalid, the month has 29 days
    let daysInMonth = 30;
    const testDay = moment().jYear(year).jMonth(month).jDate(30);
    if (!testDay.isValid() || testDay.jMonth() !== month) {
      daysInMonth = 29;
    }

    const days = [];
    // Fill leading empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-start-${i}`} className="day empty"></div>);
    }

    // Fill days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayMoment = moment().jYear(year).jMonth(month).jDate(i);
      const isSelected = moment(value).isSame(dayMoment as any, type === 'date' ? 'day' : 'minute');
      const isToday = (dayMoment as any).isSame(moment(), 'day');
      days.push(
        <div
          key={`day-${i}`}
          className={`day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateSelect(i)}
        >
          {toPersianDigits(i.toString())}
        </div>
      );
    }

    return days;
  };

  const handlePrevMonth = () => {
    const newMonth = currentMonth.clone().subtract(1, 'jMonth');
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = currentMonth.clone().add(1, 'jMonth');
    setCurrentMonth(newMonth);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeInput = e.target.value; // HH:mm
    const [hours, minutes] = timeInput.split(':').map(Number);

    const m = moment(value);
    if (m.isValid()) {
      m.hour(hours).minute(minutes);
      
      // Create Persian date string with new time
      const persianFormatted = (m as any).format('jYYYY/jMM/jDD HH:mm');
      setPersianValue(toPersianDigits(persianFormatted));
      
      // Use date conversion service for proper Gregorian conversion
      const result = dateConversionService.persianToGregorian(persianFormatted, true);
      if (result.isValid) {
        onChange(result.gregorianDate);
      } else {
        // Fallback to direct moment conversion
        onChange(m.format('YYYY-MM-DDTHH:mm'));
      }
    }
  };

  const handleNowClick = () => {
    const now = moment();
    const persianFormatted = type === 'date' ? (now as any).format('jYYYY/jMM/jDD') : (now as any).format('jYYYY/jMM/jDD HH:mm');
    setPersianValue(toPersianDigits(persianFormatted));
    
    // For Persian language, store as Persian date format
    const result = dateConversionService.inputToStorage(persianFormatted, 'fa', showTime);
    if (result.isValid) {
      onChange(result.gregorianDate); // This will be Persian format for Persian language
    } else {
      // Fallback - create Persian format directly
      const fallbackFormat = type === 'date' 
        ? (now as any).format('jYYYY/jMM/jDDT00:00')
        : (now as any).format('jYYYY/jMM/jDDTHH:mm');
      onChange(fallbackFormat);
    }
    setShowCalendar(false);
  };

  return (
    <div className="persian-date-picker-container">
      <input
        type="text"
        value={persianValue}
        onChange={handlePersianInputChange}
        onFocus={() => setShowCalendar(true)}
        onBlur={(e) => {
          // Only hide if focus moves outside the picker, not to calendar elements
          if (!e.relatedTarget || !e.relatedTarget.closest('.persian-calendar')) {
            setShowCalendar(false);
          }
        }}
        disabled={disabled}
        placeholder={placeholder || toPersianDigits(showTime ? 'YYYY/MM/DD HH:mm' : 'YYYY/MM/DD')}
        className={`persian-date-input ${className}`}
      />
      {showCalendar && (
        <div className="persian-calendar" onMouseDown={(e) => e.preventDefault()}> {/* Prevent blur on click */}
          <div className="calendar-header">
            <button type="button" onClick={handlePrevMonth}>&lt;</button>
            <span>{toPersianDigits(currentMonth.format('jMMMM jYYYY'))}</span>
            <button type="button" onClick={handleNextMonth}>&gt;</button>
          </div>
          <div className="calendar-weekdays">
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {renderDays()}
          </div>
          {showTime && (
            <div className="calendar-time-selector">
              <input
                type="time"
                value={moment(value).isValid() ? moment(value).format('HH:mm') : '00:00'}
                onChange={handleTimeChange}
                disabled={disabled}
                style={{ direction: 'ltr' }}
              />
              <button type="button" onClick={handleNowClick} disabled={disabled}>
                اکنون
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PersianDatePicker;