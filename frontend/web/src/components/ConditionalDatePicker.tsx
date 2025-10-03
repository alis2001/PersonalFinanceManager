import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import PersianDatePicker from './PersianDatePicker';
import dateSystemService from '../services/dateSystemService';

interface ConditionalDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showTime?: boolean;
  className?: string;
  type?: 'date' | 'datetime-local';
}

const ConditionalDatePicker: React.FC<ConditionalDatePickerProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder,
  showTime = true,
  className = '',
  type = 'datetime-local'
}) => {
  // Use currency-based date system instead of language
  const shouldUsePersianCalendar = dateSystemService.shouldUsePersianCalendar();

  // Use Persian date picker only for users with Iranian Rial currency
  if (shouldUsePersianCalendar) {
    return (
      <PersianDatePicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        showTime={showTime}
        className={className}
      />
    );
  }

  // Use regular HTML date/datetime-local input for all other currencies
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
};

export default ConditionalDatePicker;
