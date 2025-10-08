import React, { useState, useEffect } from 'react';
import ProfessionalDatePicker from './ProfessionalDatePicker';
import PersianDatePicker from './PersianDatePicker';
import dateSystemService from '../services/dateSystemService';

interface ConditionalDatePickerProps {
  visible: boolean;
  mode: 'date' | 'datetime';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

const ConditionalDatePicker: React.FC<ConditionalDatePickerProps> = ({
  visible,
  mode,
  value,
  onConfirm,
  onCancel,
  minimumDate,
  maximumDate
}) => {
  const [shouldUsePersianCalendar, setShouldUsePersianCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCalendarType = async () => {
      try {
        const usePersian = await dateSystemService.shouldUsePersianCalendar();
        setShouldUsePersianCalendar(usePersian);
      } catch (error) {
        console.warn('Error checking calendar type, defaulting to Gregorian:', error);
        setShouldUsePersianCalendar(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (visible) {
      checkCalendarType();
    }
  }, [visible]);

  // Show loading state or default to Gregorian while checking
  if (isLoading) {
    return (
      <ProfessionalDatePicker
        visible={visible}
        mode={mode}
        value={value}
        onConfirm={onConfirm}
        onCancel={onCancel}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }

  // Use Persian date picker only for users with Iranian Rial currency
  if (shouldUsePersianCalendar) {
    return (
      <PersianDatePicker
        visible={visible}
        mode={mode}
        value={value}
        onConfirm={onConfirm}
        onCancel={onCancel}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }

  // Use regular date picker for all other currencies
  return (
    <ProfessionalDatePicker
      visible={visible}
      mode={mode}
      value={value}
      onConfirm={onConfirm}
      onCancel={onCancel}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
};

export default ConditionalDatePicker;
