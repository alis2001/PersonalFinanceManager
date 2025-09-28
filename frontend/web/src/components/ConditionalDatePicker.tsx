import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import PersianDatePicker from './PersianDatePicker';

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
  const { currentLanguage } = useTranslation();

  // Use Persian date picker only for Persian language
  if (currentLanguage === 'fa') {
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

  // Use regular HTML date/datetime-local input for other languages
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
