import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import ConditionalDatePicker from './ConditionalDatePicker';
import expenseService from '../services/expenseService';
import categoryService, { Category } from '../services/categoryService';
import currencyService from '../services/currencyService';
import { useAppRefresh } from '../services/AppRefreshContext';
import { logger } from '../services/Logger';
import { errorHandler } from '../services/ErrorHandler';
import { useTranslation } from '../hooks/useTranslation';
import { formatDateForDisplay, formatDateForInput, parseDateFromInput } from '../utils/dateFormatter';
import { formatNumberInput, getNumericValue, isValidNumericInput } from '../utils/persianNumbers';

interface AddExpenseProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded: () => void;
  prefilledData?: {
    amount?: number;
    description?: string;
    categoryId?: string;
    transactionDate?: string;
    location?: string;
    notes?: string;
  };
  title?: string;
  fromReceipt?: boolean;
  userCurrency?: string;
}

interface ExpenseFormData {
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
  location: string;
  notes: string;
}

const AddExpense: React.FC<AddExpenseProps> = ({ 
  isOpen, 
  onClose, 
  onExpenseAdded, 
  prefilledData,
  title,
  fromReceipt = false,
  userCurrency = 'USD'
}) => {
  const { t, currentLanguage } = useTranslation();
  const { triggerRefresh } = useAppRefresh();
  
  // Check if Persian formatting should be used
  const usePersianDigits = currentLanguage === 'fa' || userCurrency === 'IRR';
  
  // Function to translate category names
  const getTranslatedCategoryName = (categoryName: string): string => {
    const categoryMap: { [key: string]: string } = {
      'Bills & Utilities': t('categories.billsUtilities'),
      'Food & Dining': t('categories.foodDining'),
      'Transportation': t('categories.transportation'),
      'Shopping': t('categories.shopping'),
      'Entertainment': t('categories.entertainment'),
      'Healthcare': t('categories.healthcare'),
      'Education': t('categories.education'),
      'Travel': t('categories.travel'),
      'Groceries': t('categories.groceries'),
      'Gas': t('categories.gas'),
      'Insurance': t('categories.insurance'),
      'Other': t('categories.other'),
      'Business': t('categories.business'),
      'Business Income': t('categories.businessIncome'),
      'Freelance': t('categories.freelance'),
      'Gifts & Bonuses': t('categories.giftsBonuses'),
      'Gifts & Donations': t('categories.giftsDonations'),
      'Home & Garden': t('categories.homeGarden'),
      'Investment Returns': t('categories.investmentReturns'),
      'Other Expenses': t('categories.otherExpenses'),
      'Other Income': t('categories.otherIncome'),
      'Personal Care': t('categories.personalCare'),
      'Rental Income': t('categories.rentalIncome'),
    };
    return categoryMap[categoryName] || categoryName;
  };

  // Function to translate category types
  const getTranslatedCategoryType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'expense': t('categories.expense'),
      'income': t('categories.income'),
      'both': t('categories.both'),
    };
    return typeMap[type] || type;
  };

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formattedDate, setFormattedDate] = useState('');
  const [formattedTime, setFormattedTime] = useState('');
  
  // Date formatting functions - now using smart date formatter
  const formatDateTimeForInput = async (date: Date): Promise<string> => {
    return await formatDateForInput(date, true);
  };

  const parseDateTimeFromInput = async (dateTimeString: string): Promise<Date> => {
    return await parseDateFromInput(dateTimeString);
  };

  // Update formatted date when selectedDate changes
  useEffect(() => {
    const updateFormattedDate = async () => {
      const dateStr = await formatDateForDisplay(selectedDate, false);
      const timeStr = await formatDateForDisplay(selectedDate, true);
      setFormattedDate(dateStr);
      setFormattedTime(timeStr.split(' ').slice(-2).join(' '));
    };
    updateFormattedDate();
  }, [selectedDate]);
  
  // Form data
  const [formData, setFormData] = useState<ExpenseFormData>({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: '',
    location: '',
    notes: ''
  });

  // Load categories when component mounts
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Initialize date formatting and check date system
  useEffect(() => {
    const initDate = async () => {
      const formattedDate = await formatDateTimeForInput(new Date());
      setFormData(prev => ({ ...prev, transactionDate: formattedDate }));
    };
    initDate();
  }, []);

  // Initialize form with prefilled data from receipt
  useEffect(() => {
    const initializeFormData = async () => {
      if (isOpen && prefilledData) {
        const prefilledDate = prefilledData.transactionDate ? 
          await parseDateTimeFromInput(prefilledData.transactionDate) : new Date();
        setSelectedDate(prefilledDate);
        const formattedDate = await formatDateTimeForInput(prefilledDate);
        
        // Format amount with Persian digits and commas if needed
        const formattedAmount = prefilledData.amount 
          ? formatNumberInput(prefilledData.amount.toString(), usePersianDigits)
          : '';
        
        setFormData({
          categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
          amount: formattedAmount,
          description: prefilledData.description || '',
          transactionDate: formattedDate,
          location: prefilledData.location || '',
          notes: prefilledData.notes || ''
        });
      } else if (isOpen && !prefilledData) {
        // Reset to defaults for manual entry
        const now = new Date();
        setSelectedDate(now);
        const formattedDate = await formatDateTimeForInput(now);
        setFormData({
          categoryId: categories.length > 0 ? categories[0].id : '',
          amount: '',
          description: '',
          transactionDate: formattedDate,
          location: '',
          notes: ''
        });
      }
    };
    initializeFormData();
  }, [isOpen, prefilledData, categories]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const result = await categoryService.getExpenseCategories();
      if (result.success && result.categories) {
        const categoryList = result.categories;
        setCategories(categoryList);
        // Auto-select first category if none selected and categories exist
        if (!formData.categoryId && categoryList.length > 0) {
          setFormData(prev => ({ ...prev, categoryId: categoryList[0].id }));
        }
      } else {
        setError(t('expenses.failedToLoadCategories'));
      }
    } catch (err) {
        setError(t('expenses.failedToLoadCategories'));
    }
    setCategoriesLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleAmountChange = (value: string) => {
    // Validate input (allows Persian/Arabic/Latin digits, decimal, comma)
    if (!isValidNumericInput(value) && value !== '') {
      return; // Reject invalid characters
    }
    
    // Get clean numeric value (Latin digits, no commas)
    const numericValue = getNumericValue(value);
    
    // Validate it's a valid number format
    if (numericValue !== '' && !/^\d*\.?\d*$/.test(numericValue)) {
      return; // Reject if not valid after cleanup
    }
    
    // Format for display with commas and Persian digits if needed
    const formattedValue = formatNumberInput(numericValue, usePersianDigits);
    
    setFormData(prev => ({ ...prev, amount: formattedValue }));
    if (error) setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.categoryId) {
      return t('expenses.pleaseSelectCategory');
    }
    
    // Get clean numeric value for validation
    const cleanAmount = getNumericValue(formData.amount);
    const numericAmount = parseFloat(cleanAmount);
    
    if (!cleanAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return t('expenses.pleaseEnterValidAmount');
    }
    
    // Dynamic limit based on currency
    const maxLimit = currencyService.getMaxAmountLimit(userCurrency);
    if (numericAmount > maxLimit) {
      // Format limit for display
      const formattedLimit = formatNumberInput(maxLimit.toString(), usePersianDigits);
      return t('expenses.amountCannotExceed') + ` ${formattedLimit}`;
    }
    
    if (!formData.transactionDate) {
      return t('expenses.pleaseSelectDateTime');
    }
    
    return null;
  };

  const handleSubmit = async () => {
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const parsedDate = await errorHandler.safeAsync(
        () => parseDateTimeFromInput(formData.transactionDate)
      );
      
      if (!parsedDate) {
        setError(t('expenses.pleaseSelectDateTime'));
        return;
      }
      
      logger.log('Form transactionDate string:', formData.transactionDate);
      logger.log('Parsed date:', parsedDate);
      logger.log('ISO string being sent:', parsedDate.toISOString());
      
      // Extract user's LOCAL date and time (before converting to UTC)
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const hours = String(parsedDate.getHours()).padStart(2, '0');
      const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
      const seconds = String(parsedDate.getSeconds()).padStart(2, '0');
      
      const userDate = `${year}-${month}-${day}`;  // User's local date
      const userTime = `${hours}:${minutes}:${seconds}`;  // User's local time
      
      // Convert formatted amount to clean numeric value for database
      const cleanAmount = getNumericValue(formData.amount);
      
      const expenseData = {
        categoryId: formData.categoryId,
        amount: parseFloat(cleanAmount), // Store as Latin digits in database
        description: formData.description.trim() || undefined,
        transactionDate: parsedDate.toISOString(),
        userDate: userDate,
        userTime: userTime,
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined
      };

      const result = await expenseService.createExpense(expenseData);

      if (result.success) {
        // Reset form based on mode
        const now = new Date();
        const formattedDate = await formatDateTimeForInput(now);
        
        if (prefilledData) {
          // If from receipt, restore prefilled data for next transaction
          setFormData({
            categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
            amount: prefilledData.amount ? prefilledData.amount.toString() : '',
            description: prefilledData.description || '',
            transactionDate: prefilledData.transactionDate || formattedDate,
            location: prefilledData.location || '',
            notes: prefilledData.notes || ''
          });
        } else {
          // Manual entry - clear all fields
          setFormData({
            categoryId: categories.length > 0 ? categories[0].id : '',
            amount: '',
            description: '',
            transactionDate: formattedDate,
            location: '',
            notes: ''
          });
        }
        
        logger.log('✅ Expense added, triggering global refresh');
        triggerRefresh();
        onExpenseAdded();
        if (!fromReceipt) {
          onClose();
        }
      } else {
        setError(result.error || t('expenses.failedToCreateExpenseTryAgain'));
      }
    } catch (err) {
      logger.error('Error creating expense:', err);
      setError(t('expenses.failedToCreateExpenseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Reset form based on mode
    const now = new Date();
    const formattedDate = await formatDateTimeForInput(now);
    
    if (prefilledData) {
      // If from receipt, restore prefilled data
      setFormData({
        categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
        amount: prefilledData.amount ? prefilledData.amount.toString() : '',
        description: prefilledData.description || '',
        transactionDate: prefilledData.transactionDate || formattedDate,
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else {
      // Manual entry - clear all fields
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: formattedDate,
        location: '',
        notes: ''
      });
    }
    setError('');
    onClose();
  };

  const getCurrentDateTime = async () => {
    const now = new Date();
    const formattedDate = await formatDateTimeForInput(now);
    setSelectedDate(now);
    setFormData(prev => ({ 
      ...prev, 
      transactionDate: formattedDate
    }));
  };

  const handleDateConfirm = async (date: Date) => {
    console.log('Date confirmed:', date);
    console.log('Hours:', date.getHours());
    console.log('Minutes:', date.getMinutes());
    
    const formattedDate = await formatDateTimeForInput(date);
    console.log('Formatted date:', formattedDate);
    
    setSelectedDate(date);
    setFormData(prev => ({
      ...prev,
      transactionDate: formattedDate
    }));
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };



  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {title || t('expenses.addNewExpense')}{fromReceipt && ` 📄 ${t('expenses.fromReceipt')}`}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
          {error && (
            <View style={styles.errorMessage}>
              <Text style={styles.errorMessageText}>{error}</Text>
            </View>
          )}

          {/* Date & Time Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('expenses.dateTime')} <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
            >
              <View style={styles.datePickerButtonContent}>
                <View style={styles.datePickerTextContainer}>
                  <Text style={styles.datePickerDateText}>
                    {formattedDate}
                  </Text>
                  <Text style={styles.datePickerTimeText}>
                    {formattedTime}
                  </Text>
                </View>
                <View style={styles.datePickerIcon}>
                  <Text style={styles.calendarIcon}>📅</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.currentTimeButton} onPress={getCurrentDateTime}>
              <Text style={styles.currentTimeButtonText}>{t('expenses.now')}</Text>
            </TouchableOpacity>
          </View>

          {/* Category Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('expenses.category')} <Text style={styles.required}>*</Text>
            </Text>
            {categoriesLoading ? (
              <View style={styles.loadingCategories}>
                <Text style={styles.loadingCategoriesText}>{t('expenses.loadingCategories')}</Text>
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.categoryId}
                  onValueChange={(value) => handleInputChange('categoryId', value)}
                  style={styles.picker}
                  enabled={!loading}
                >
                  <Picker.Item label={t('expenses.selectCategory')} value="" />
                  {categories.map(category => (
                    <Picker.Item 
                      key={category.id} 
                      label={`${category.icon} ${getTranslatedCategoryName(category.name)}`} 
                      value={category.id} 
                    />
                  ))}
                </Picker>
              </View>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('expenses.amount')} <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>
                {currencyService.getCurrencyByCode(userCurrency)?.symbol || '$'}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={formData.amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#999"
                editable={!loading}
                keyboardType="decimal-pad"
                maxLength={20}
              />
            </View>
          </View>

          {/* Description Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.description')}</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder={t('expenses.whatDidYouSpendOn')}
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={500}
            />
          </View>

          {/* Location Input (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.location')}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
              placeholder={t('expenses.whereDidYouMakePurchase')}
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={255}
            />
          </View>

          {/* Notes Input (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(value) => handleInputChange('notes', value)}
              placeholder={t('expenses.additionalNotes')}
              placeholderTextColor="#999"
              editable={!loading}
              multiline
              numberOfLines={3}
              maxLength={1000}
            />
          </View>

          {/* Form Actions */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || categoriesLoading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? t('expenses.adding') : t('expenses.addExpense')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
      </SafeAreaView>
      
      {/* Smart Date Time Picker - Persian for IRR users, Gregorian for others */}
      <ConditionalDatePicker
        visible={showDatePicker}
        mode="datetime"
        value={selectedDate}
        onConfirm={handleDateConfirm}
        onCancel={handleDateCancel}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date()}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'System',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorMessageText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
    marginBottom: 8,
  },
  required: {
    color: '#e53e3e',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#1a1a1a',
  },
  loadingCategories: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f7fafc',
  },
  loadingCategoriesText: {
    color: '#a0aec0',
    fontSize: 16,
    fontStyle: 'italic',
  },
  amountInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    position: 'absolute',
    right: 18,
    top: '50%',
    transform: [{ translateY: -10 }],
    color: '#4a5568',
    fontWeight: '600',
    fontSize: 18,
    zIndex: 2,
    backgroundColor: 'white',
    paddingLeft: 4,
  },
  amountInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    paddingRight: 45,
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  datePickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  datePickerTextContainer: {
    flex: 1,
  },
  datePickerDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  datePickerTimeText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  datePickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 20,
  },
  currentTimeButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  currentTimeButtonText: {
    color: '#4a5568',
    fontSize: 14,
    fontWeight: '500',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 40,
    marginBottom: 100,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  cancelButton: {
    backgroundColor: '#f7fafc',
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Date Picker Styles
  dateInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  dateInputText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  dateInputTextDisabled: {
    color: '#a0aec0',
  },
  dateInputIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  datePickerContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  datePickerCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  datePickerCancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  datePickerDoneButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  datePickerDoneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AddExpense;