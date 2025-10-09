import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import ConditionalDatePicker from './ConditionalDatePicker';
import expenseService from '../services/expenseService';
import categoryService, { Category } from '../services/categoryService';
import { Expense } from '../services/expenseService';
import { useTranslation } from '../hooks/useTranslation';
import { formatDateForDisplay, formatDateForInput, parseDateFromInput } from '../utils/dateFormatter';

interface EditExpenseProps {
  isOpen: boolean;
  expense: Expense;
  onClose: () => void;
  onExpenseUpdated: () => void;
  userCurrency?: string;
}

const EditExpense: React.FC<EditExpenseProps> = ({ 
  isOpen, 
  expense, 
  onClose, 
  onExpenseUpdated, 
  userCurrency = 'USD' 
}) => {
  const { t } = useTranslation();
  
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: '',
    location: '',
    notes: ''
  });

  // Load categories and populate form when component mounts or expense changes
  useEffect(() => {
    if (isOpen && expense) {
      loadCategories();
      populateForm();
    }
  }, [isOpen, expense]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const result = await categoryService.getExpenseCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        setError(t('expenses.failedToLoadCategories'));
      }
    } catch (err) {
      setError('Failed to load categories');
    }
    setCategoriesLoading(false);
  };

  const populateForm = async () => {
    // Convert expense data to form format
    const transactionDate = new Date(expense.transactionDate);
    setSelectedDate(transactionDate);

    const formattedDateTime = await formatDateTimeForInput(transactionDate);
    setFormData({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      description: expense.description || '',
      transactionDate: formattedDateTime,
      location: expense.location || '',
      notes: expense.notes || ''
    });
  };

  const handleDateConfirm = async (date: Date) => {
    setSelectedDate(date);
    const formattedDateTime = await formatDateTimeForInput(date);
    setFormData(prev => ({
      ...prev,
      transactionDate: formattedDateTime
    }));
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };


  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, amount: value }));
      if (error) setError('');
    }
  };

  const validateForm = (): string | null => {
    if (!formData.categoryId.trim()) {
      return t('expenses.pleaseSelectCategory');
    }
    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) {
      return t('expenses.pleaseEnterValidAmount');
    }
    if (!formData.transactionDate.trim()) {
      return t('expenses.pleaseSelectDateTime');
    }
    return null;
  };

  const handleUpdate = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsedDate = await parseDateTimeFromInput(formData.transactionDate);
      console.log('EditExpense - Form transactionDate string:', formData.transactionDate);
      console.log('EditExpense - Parsed date:', parsedDate);
      console.log('EditExpense - ISO string being sent:', parsedDate.toISOString());
      
      // Extract user's LOCAL date and time (before converting to UTC)
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const hours = String(parsedDate.getHours()).padStart(2, '0');
      const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
      const seconds = String(parsedDate.getSeconds()).padStart(2, '0');
      
      const userDate = `${year}-${month}-${day}`;  // User's local date
      const userTime = `${hours}:${minutes}:${seconds}`;  // User's local time
      
      const updateData = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || undefined,
        transactionDate: parsedDate.toISOString(),
        userDate: userDate,
        userTime: userTime,
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const result = await expenseService.updateExpense(expense.id, updateData);
      
      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || t('expenses.failedToUpdateExpenseTryAgain'));
      }
    } catch (err: any) {
      setError(err.message || t('expenses.failedToUpdateExpenseTryAgain'));
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await expenseService.deleteExpense(expense.id);
      
      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || t('expenses.failedToDeleteExpenseTryAgain'));
      }
    } catch (err: any) {
      setError(err.message || t('expenses.failedToDeleteExpenseTryAgain'));
    }

    setLoading(false);
  };

  const handleCancel = () => {
    setShowDeleteConfirm(false);
    setError('');
    onClose();
  };


  return (
    <>
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('expenses.editExpense')}</Text>
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.category')} *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.categoryId}
                onValueChange={(value) => handleInputChange('categoryId', value)}
                style={styles.picker}
                enabled={!loading && !categoriesLoading}
              >
                {categories.map((category) => (
                  <Picker.Item 
                    key={category.id} 
                    label={`${category.icon} ${getTranslatedCategoryName(category.name)}`} 
                    value={category.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.amount')} *</Text>
            <TextInput
              style={styles.input}
              value={formData.amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="numeric"
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.description')}</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder={t('expenses.whatDidYouSpendOn')}
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={200}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.dateTime')} *</Text>
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
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('expenses.location')}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
              placeholder={t('expenses.whereDidYouMakePurchase')}
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={100}
            />
          </View>

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
              maxLength={500}
            />
          </View>

          <View style={styles.formActions}>
            <View style={styles.topButtonsRow}>
              <TouchableOpacity
                style={[styles.deleteButton]}
                onPress={handleDelete}
                disabled={loading}
              >
                <Text style={styles.deleteButtonText}>
                  🗑️ {t('common.delete')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={loading}
            >
              <Text style={styles.updateButtonText}>
                {loading ? t('expenses.updating') : t('expenses.updateExpense')}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </SafeAreaView>
        
      </Modal>
      
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
      
      
      {showDeleteConfirm && (
        <Modal
          visible={showDeleteConfirm}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.deleteConfirmOverlay}>
            <View style={styles.deleteConfirmModal}>
              <View style={styles.deleteConfirmHeader}>
                <Text style={styles.deleteConfirmTitle}>{t('expenses.deleteExpense')}</Text>
              </View>
              
              <View style={styles.deleteConfirmBody}>
                <Text style={styles.deleteConfirmMessage}>
                  {t('expenses.deleteConfirm')} {t('expenses.deleteWarning')}
                </Text>
                
                <View style={styles.expensePreview}>
                  <View style={styles.expensePreviewItem}>
                    <Text style={styles.expensePreviewLabel}>{t('expenses.amount')}:</Text>
                    <Text style={styles.expensePreviewValue}>
                      {expense.amount.toFixed(2)} {userCurrency}
                    </Text>
                  </View>
                  <View style={styles.expensePreviewItem}>
                    <Text style={styles.expensePreviewLabel}>{t('expenses.category')}:</Text>
                    <Text style={styles.expensePreviewValue}>{getTranslatedCategoryName(expense.category.name)}</Text>
                  </View>
                  {expense.description && (
                    <View style={styles.expensePreviewItem}>
                      <Text style={styles.expensePreviewLabel}>{t('expenses.description')}:</Text>
                      <Text style={styles.expensePreviewValue}>{expense.description}</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.deleteWarning}>
                  This will permanently remove the transaction from your records.
                </Text>
              </View>
              
              <View style={styles.deleteConfirmActions}>
                <TouchableOpacity
                  style={styles.cancelDeleteButton}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                >
                  <Text style={styles.cancelDeleteButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.confirmDeleteButton}
                  onPress={handleDelete}
                  disabled={loading}
                >
                  <Text style={styles.confirmDeleteButtonText}>
                    {loading ? t('expenses.deleting') : t('expenses.deleteExpense')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
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
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  errorMessageText: {
    color: '#e53e3e',
    fontSize: 14,
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
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#1a1a1a',
  },
  formActions: {
    marginTop: 40,
    marginBottom: 100,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  topButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#feb2b2',
    backgroundColor: '#fed7d7',
  },
  deleteButtonText: {
    color: '#c53030',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f7fafc',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  updateButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Delete Confirmation Modal Styles
  deleteConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteConfirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteConfirmHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  deleteConfirmTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  deleteConfirmBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  deleteConfirmMessage: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  expensePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  expensePreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expensePreviewLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  expensePreviewValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  deleteWarning: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    fontWeight: '500',
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cancelDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f7fafc',
  },
  cancelDeleteButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c53030',
    backgroundColor: '#c53030',
  },
  confirmDeleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
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

export default EditExpense;
