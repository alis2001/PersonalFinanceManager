import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import expenseService from '../services/expenseService';
import categoryService, { Category } from '../services/categoryService';
import currencyService from '../services/currencyService';

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
  title = 'Add New Expense',
  fromReceipt = false,
  userCurrency = 'USD'
}) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Date formatting functions (matching web version)
  const formatDateTimeForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateTimeFromInput = (dateTimeString: string): Date => {
    return new Date(dateTimeString);
  };
  
  // Form data
  const [formData, setFormData] = useState<ExpenseFormData>({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: formatDateTimeForInput(new Date()),
    location: '',
    notes: ''
  });

  // Load categories when component mounts
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Initialize form with prefilled data from receipt
  useEffect(() => {
    if (isOpen && prefilledData) {
      const prefilledDate = prefilledData.transactionDate ? 
        parseDateTimeFromInput(prefilledData.transactionDate) : new Date();
      setSelectedDate(prefilledDate);
      setFormData({
        categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
        amount: prefilledData.amount ? prefilledData.amount.toString() : '',
        description: prefilledData.description || '',
        transactionDate: formatDateTimeForInput(prefilledDate),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else if (isOpen && !prefilledData) {
      // Reset to defaults for manual entry
      const now = new Date();
      setSelectedDate(now);
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: formatDateTimeForInput(now),
        location: '',
        notes: ''
      });
    }
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
        setError('Failed to load categories');
      }
    } catch (err) {
        setError('Failed to load categories');
    }
    setCategoriesLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
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
    if (!formData.categoryId) {
      return 'Please select a category';
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      return 'Please enter a valid amount';
    }
    
    if (parseFloat(formData.amount) > 999999.99) {
      return 'Amount cannot exceed 999,999.99';
    }
    
    if (!formData.transactionDate) {
      return 'Please select date and time';
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
      const expenseData = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || undefined,
        transactionDate: parseDateTimeFromInput(formData.transactionDate).toISOString(),
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined
      };

      const result = await expenseService.createExpense(expenseData);

      if (result.success) {
        // Reset form based on mode
        if (prefilledData) {
          // If from receipt, restore prefilled data for next transaction
          setFormData({
            categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
            amount: prefilledData.amount ? prefilledData.amount.toString() : '',
            description: prefilledData.description || '',
            transactionDate: prefilledData.transactionDate || new Date().toISOString().slice(0, 16),
            location: prefilledData.location || '',
            notes: prefilledData.notes || ''
          });
        } else {
          // Manual entry - clear all fields
          setFormData({
            categoryId: categories.length > 0 ? categories[0].id : '',
            amount: '',
            description: '',
            transactionDate: new Date().toISOString().slice(0, 16),
            location: '',
            notes: ''
          });
        }
        
        onExpenseAdded();
        if (!fromReceipt) {
          onClose();
        }
      } else {
        setError(result.error || 'Failed to create expense');
      }
    } catch (err) {
      setError('Failed to create expense. Please try again.');
    }

    setLoading(false);
  };

  const handleCancel = () => {
    // Reset form based on mode
    if (prefilledData) {
      // If from receipt, restore prefilled data
      setFormData({
        categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
        amount: prefilledData.amount ? prefilledData.amount.toString() : '',
        description: prefilledData.description || '',
        transactionDate: prefilledData.transactionDate || new Date().toISOString().slice(0, 16),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else {
      // Manual entry - clear all fields
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: new Date().toISOString().slice(0, 16),
        location: '',
        notes: ''
      });
    }
    setError('');
    onClose();
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    setSelectedDate(now);
    setFormData(prev => ({ 
      ...prev, 
      transactionDate: formatDateTimeForInput(now)
    }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // Always close the picker after selection
    setShowDatePicker(false);
    
    if (selectedDate) {
      setSelectedDate(selectedDate);
      setFormData(prev => ({
        ...prev,
        transactionDate: formatDateTimeForInput(selectedDate)
      }));
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
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
            {title}{fromReceipt && ' 📄 From Receipt'}
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
              Date & Time <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity 
              style={styles.dateInputButton}
              onPress={showDatePickerModal}
              disabled={loading}
            >
              <Text style={[styles.dateInputText, loading && styles.dateInputTextDisabled]}>
                {selectedDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                })} at {selectedDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </Text>
              <Text style={styles.dateInputIcon}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.currentTimeButton} onPress={getCurrentDateTime}>
              <Text style={styles.currentTimeButtonText}>Use Current Time</Text>
            </TouchableOpacity>
          </View>

          {/* Category Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            {categoriesLoading ? (
              <View style={styles.loadingCategories}>
                <Text style={styles.loadingCategoriesText}>Loading categories...</Text>
              </View>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.categoryId}
                  onValueChange={(value) => handleInputChange('categoryId', value)}
                  style={styles.picker}
                  enabled={!loading}
                >
                  <Picker.Item label="Select Category" value="" />
                  {categories.map(category => (
                    <Picker.Item 
                      key={category.id} 
                      label={`${category.icon} ${category.name}`} 
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
              Amount <Text style={styles.required}>*</Text>
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
                maxLength={10}
              />
            </View>
          </View>

          {/* Description Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="What did you spend on?"
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={500}
            />
          </View>

          {/* Location Input (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
              placeholder="Where did you make the purchase?"
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={255}
            />
          </View>

          {/* Notes Input (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(value) => handleInputChange('notes', value)}
              placeholder="Additional notes"
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
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || categoriesLoading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Adding...' : 'Add Expense'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Date Time Picker */}
        {showDatePicker && (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={selectedDate}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          </View>
        )}
      </SafeAreaView>
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
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
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
  currentTimeButton: {
    marginTop: 8,
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