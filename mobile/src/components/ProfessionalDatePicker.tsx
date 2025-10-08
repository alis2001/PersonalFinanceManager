import React from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTranslation } from '../hooks/useTranslation';

interface ProfessionalDatePickerProps {
  visible: boolean;
  mode: 'date' | 'datetime';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

const ProfessionalDatePicker: React.FC<ProfessionalDatePickerProps> = ({
  visible,
  mode,
  value,
  onConfirm,
  onCancel,
  minimumDate = new Date(2020, 0, 1),
  maximumDate = new Date()
}) => {
  const { t } = useTranslation();

  const buttonTexts = {
    confirm: t('common.save'),
    cancel: t('common.cancel')
  };

  return (
    <DateTimePickerModal
      isVisible={visible}
      mode={mode}
      date={value}
      onConfirm={onConfirm}
      onCancel={onCancel}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      display="spinner"
      textColor="#1a1a1a"
      themeVariant="light"
      headerTextIOS={mode === 'datetime' ? t('expenses.dateTime') : t('expenses.date')}
      confirmTextIOS={buttonTexts.confirm}
      cancelTextIOS={buttonTexts.cancel}
    />
  );
};

export default ProfessionalDatePicker;