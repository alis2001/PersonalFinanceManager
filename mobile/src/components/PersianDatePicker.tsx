import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import moment from 'moment-jalaali';
import { formatPersianDate, formatPersianDateForInput } from '../utils/persianDateFormatter';
import { toPersianDigits } from '../utils/persianNumbers';

interface PersianDatePickerProps {
  visible: boolean;
  mode: 'date' | 'datetime';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  visible,
  mode,
  value,
  onConfirm,
  onCancel,
  minimumDate = new Date(2020, 0, 1),
  maximumDate = new Date()
}) => {
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [selectedDate, setSelectedDate] = useState(value);
  const [selectedTime, setSelectedTime] = useState({
    hour: value.getHours(),
    minute: value.getMinutes()
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      // Initialize with current Iranian date/time or provided value
      const initialDate = value || new Date();
      const initialMoment = moment(initialDate);
      
      setCurrentMonth(initialMoment);
      setSelectedDate(initialDate);
      setSelectedTime({
        hour: initialDate.getHours(),
        minute: initialDate.getMinutes()
      });
      setShowTimePicker(false); // Always start with date picker
    }
  }, [visible, value]);

  const handleDateSelect = (day: number) => {
    const year = currentMonth.jYear();
    const month = currentMonth.jMonth();
    
    // Create Persian date and convert to Gregorian
    const persianMoment = moment().jYear(year).jMonth(month).jDate(day);
    
    // Set current time as default
    const now = new Date();
    persianMoment.hour(now.getHours()).minute(now.getMinutes());
    
    setSelectedDate(persianMoment.toDate());
    setSelectedTime({
      hour: now.getHours(),
      minute: now.getMinutes()
    });
    
    // If datetime mode, show time picker after date selection
    if (mode === 'datetime') {
      setShowTimePicker(true);
    }
  };

  const handleTimeChange = (type: 'hour' | 'minute', value: number) => {
    console.log(`Time change: ${type} = ${value}`);
    setSelectedTime(prev => {
      const newTime = {
        ...prev,
        [type]: value
      };
      console.log('New time state:', newTime);
      return newTime;
    });
  };

  const handleConfirm = () => {
    let finalDate = selectedDate;
    
    if (mode === 'datetime') {
      finalDate = new Date(selectedDate);
      finalDate.setHours(selectedTime.hour, selectedTime.minute, 0, 0);
      console.log('Final date with time:', finalDate);
      console.log('Selected time:', selectedTime);
    }
    
    onConfirm(finalDate);
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev: any) => prev.clone().subtract(1, 'jMonth'));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev: any) => prev.clone().add(1, 'jMonth'));
  };

  const renderDays = () => {
    const year = currentMonth.jYear();
    const month = currentMonth.jMonth();
    
    // Get first day of the month
    const firstDay = moment().jYear(year).jMonth(month).jDate(1);
    const firstDayOfWeek = firstDay.day(); // 0 for Saturday, 6 for Friday
    
    // Get days in month
    let daysInMonth = 30;
    const testDay = moment().jYear(year).jMonth(month).jDate(30);
    if (!testDay.isValid() || testDay.jMonth() !== month) {
      daysInMonth = 29;
    }

    const days = [];
    
    // Fill leading empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<View key={`empty-start-${i}`} style={styles.dayEmpty} />);
    }

    // Fill days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayMoment = moment().jYear(year).jMonth(month).jDate(i);
      const isSelected = moment(selectedDate).isSame(dayMoment, 'day');
      const isToday = dayMoment.isSame(moment(), 'day');
      
      days.push(
        <TouchableOpacity
          key={`day-${i}`}
          style={[
            styles.day,
            isSelected && styles.daySelected,
            isToday && styles.dayToday
          ]}
          onPress={() => handleDateSelect(i)}
        >
          <Text style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            isToday && styles.dayTextToday
          ]}>
            {toPersianDigits(i.toString())}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const renderTimeSelector = () => {
    if (mode !== 'datetime' || !showTimePicker) return null;

    return (
      <View style={styles.timeSelector}>
        <TouchableOpacity 
          style={styles.backToDateButton}
          onPress={() => setShowTimePicker(false)}
        >
          <Text style={styles.backToDateButtonText}>← بازگشت به تقویم</Text>
        </TouchableOpacity>
        
        <Text style={styles.timeLabel}>انتخاب زمان</Text>
        <Text style={styles.selectedDateText}>
          {toPersianDigits(moment(selectedDate).format('jYYYY/jMM/jDD'))}
        </Text>
        
        <View style={styles.timeInputs}>
          <View style={styles.timeInput}>
            <Text style={styles.timeInputLabel}>ساعت</Text>
            <ScrollView 
              style={styles.timeScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.timeOption,
                    selectedTime.hour === i && styles.timeOptionSelected
                  ]}
                  onPress={() => {
                    console.log('Hour selected:', i);
                    handleTimeChange('hour', i);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timeOptionText,
                    selectedTime.hour === i && styles.timeOptionTextSelected
                  ]}>
                    {toPersianDigits(i.toString().padStart(2, '0'))}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.timeInput}>
            <Text style={styles.timeInputLabel}>دقیقه</Text>
            <ScrollView 
              style={styles.timeScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {Array.from({ length: 60 }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.timeOption,
                    selectedTime.minute === i && styles.timeOptionSelected
                  ]}
                  onPress={() => {
                    console.log('Minute selected:', i);
                    handleTimeChange('minute', i);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timeOptionText,
                    selectedTime.minute === i && styles.timeOptionTextSelected
                  ]}>
                    {toPersianDigits(i.toString().padStart(2, '0'))}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        
        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTimeLabel}>زمان انتخاب شده:</Text>
          <Text style={styles.currentTimeText}>
            {toPersianDigits(`${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>لغو</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {toPersianDigits(currentMonth.format('jMMMM jYYYY'))}
            </Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
              <Text style={styles.confirmButtonText}>تأیید</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!showTimePicker ? (
              <>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                    <Text style={styles.navButtonText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.monthYear}>
                    {toPersianDigits(currentMonth.format('jMMMM jYYYY'))}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                    <Text style={styles.navButtonText}>›</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdays}>
                  {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(day => (
                    <Text key={day} style={styles.weekday}>{day}</Text>
                  ))}
                </View>

                <View style={styles.days}>
                  {renderDays()}
                </View>
              </>
            ) : null}

            {renderTimeSelector()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  confirmButton: {
    padding: 8,
  },
  confirmButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  navButton: {
    padding: 10,
  },
  navButtonText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 8,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  day: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayEmpty: {
    width: '14.28%',
    aspectRatio: 1,
    marginBottom: 4,
  },
  daySelected: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  dayToday: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  dayTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  dayTextToday: {
    color: '#007AFF',
    fontWeight: '600',
  },
  timeSelector: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  backToDateButton: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 15,
  },
  backToDateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  selectedDateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  timeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeInput: {
    alignItems: 'center',
  },
  timeInputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  timeScrollView: {
    height: 150,
    width: 80,
    maxHeight: 150,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeOptionSelected: {
    backgroundColor: '#007AFF',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  currentTimeContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  currentTimeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  currentTimeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

export default PersianDatePicker;
