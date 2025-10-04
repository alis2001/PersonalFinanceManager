import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import expenseService from '../services/expenseService';
import categoryService, { Category } from '../services/categoryService';
import { Expense } from '../services/expenseService';

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
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: formatDateTimeForInput(new Date()),
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
        setError('Failed to load categories');
      }
    } catch (err) {
      setError('Failed to load categories');
    }
    setCategoriesLoading(false);
  };

  const populateForm = () => {
    // Convert expense data to form format
    const transactionDate = new Date(expense.transactionDate);
    setSelectedDate(transactionDate);

    setFormData({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      description: expense.description || '',
      transactionDate: formatDateTimeForInput(transactionDate),
      location: expense.location || '',
      notes: expense.notes || ''
    });
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
      return 'Please select a category';
    }
    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) {
      return 'Please enter a valid amount';
    }
    if (!formData.transactionDate.trim()) {
      return 'Please select a transaction date';
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
      const updateData = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || undefined,
        transactionDate: parseDateTimeFromInput(formData.transactionDate).toISOString(),
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const result = await expenseService.updateExpense(expense.id, updateData);
      
      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || 'Failed to update expense');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update expense');
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
        setError(result.error || 'Failed to delete expense');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete expense');
    }

    setLoading(false);
  };

  const handleCancel = () => {
    setShowDeleteConfirm(false);
    setError('');
    onClose();
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

  return (
    <>
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>
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
            <Text style={styles.label}>Category *</Text>
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
                    label={`${category.icon} ${category.name}`} 
                    value={category.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount *</Text>
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
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Transaction description"
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={200}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date & Time *</Text>
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
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(value) => handleInputChange('location', value)}
              placeholder="Transaction location"
              placeholderTextColor="#999"
              editable={!loading}
              maxLength={100}
            />
          </View>

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
                  🗑️ Delete
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={loading}
            >
              <Text style={styles.updateButtonText}>
                {loading ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </SafeAreaView>
        
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
      </Modal>
      
      {showDeleteConfirm && (
        <Modal
          visible={showDeleteConfirm}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.deleteConfirmOverlay}>
            <View style={styles.deleteConfirmModal}>
              <View style={styles.deleteConfirmHeader}>
                <Text style={styles.deleteConfirmTitle}>Delete Transaction</Text>
              </View>
              
              <View style={styles.deleteConfirmBody}>
                <Text style={styles.deleteConfirmMessage}>
                  Are you sure you want to delete this transaction? This action cannot be undone.
                </Text>
                
                <View style={styles.expensePreview}>
                  <View style={styles.expensePreviewItem}>
                    <Text style={styles.expensePreviewLabel}>Amount:</Text>
                    <Text style={styles.expensePreviewValue}>
                      {expense.amount.toFixed(2)} {userCurrency}
                    </Text>
                  </View>
                  <View style={styles.expensePreviewItem}>
                    <Text style={styles.expensePreviewLabel}>Category:</Text>
                    <Text style={styles.expensePreviewValue}>{expense.category.name}</Text>
                  </View>
                  {expense.description && (
                    <View style={styles.expensePreviewItem}>
                      <Text style={styles.expensePreviewLabel}>Description:</Text>
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
                  <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.confirmDeleteButton}
                  onPress={handleDelete}
                  disabled={loading}
                >
                  <Text style={styles.confirmDeleteButtonText}>
                    {loading ? 'Deleting...' : 'Delete Transaction'}
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
