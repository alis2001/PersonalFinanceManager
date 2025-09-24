// frontend/web/src/components/AddExpense.tsx
import React, { useState, useEffect } from 'react';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import type { Category } from '../services/categoryService';
import '../styles/AddExpense.css';

interface AddExpenseProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded: () => void;
  // NEW: Optional props for receipt integration
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
}

const AddExpense: React.FC<AddExpenseProps> = ({ 
  isOpen, 
  onClose, 
  onExpenseAdded, 
  prefilledData, 
  title = "Add New Expense", 
  fromReceipt = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: expenseService.formatDateTimeForInput(new Date()),
    location: '',
    notes: ''
  });

  // Load categories when component mounts
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // NEW: Initialize form with prefilled data from receipt
  useEffect(() => {
    if (isOpen && prefilledData) {
      setFormData({
        categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
        amount: prefilledData.amount ? prefilledData.amount.toString() : '',
        description: prefilledData.description || '',
        transactionDate: prefilledData.transactionDate || expenseService.formatDateTimeForInput(new Date()),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else if (isOpen && !prefilledData) {
      // Reset to defaults for manual entry
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: expenseService.formatDateTimeForInput(new Date()),
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point - FIXED REGEX
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
      return 'Amount cannot exceed $999,999.99';
    }
    
    if (!formData.transactionDate) {
      return 'Please select a date and time';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        transactionDate: expenseService.parseDateTimeFromInput(formData.transactionDate).toISOString(),
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
            transactionDate: prefilledData.transactionDate || expenseService.formatDateTimeForInput(new Date()),
            location: prefilledData.location || '',
            notes: prefilledData.notes || ''
          });
        } else {
          // Manual entry - clear all fields
          setFormData({
            categoryId: categories.length > 0 ? categories[0].id : '',
            amount: '',
            description: '',
            transactionDate: expenseService.formatDateTimeForInput(new Date()),
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
        transactionDate: prefilledData.transactionDate || expenseService.formatDateTimeForInput(new Date()),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else {
      // Manual entry - clear all fields
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: expenseService.formatDateTimeForInput(new Date()),
        location: '',
        notes: ''
      });
    }
    setError('');
    onClose();
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    setFormData(prev => ({ 
      ...prev, 
      transactionDate: expenseService.formatDateTimeForInput(now) 
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="add-expense-overlay" onClick={handleCancel}>
      <div className="add-expense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-expense-header">
          <h2>{title}{fromReceipt && <span className="receipt-badge"> 📄 From Receipt</span>}</h2>
          <button className="close-button" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-expense-form">
          {error && <div className="error-message">{error}</div>}

          {/* Date & Time Input */}
          <div className="form-group">
            <label htmlFor="transactionDate">
              Date & Time <span className="required">*</span>
            </label>
            <div className="date-input-container">
              <input
                type="datetime-local"
                id="transactionDate"
                name="transactionDate"
                value={formData.transactionDate}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="date-input"
              />
              <button
                type="button"
                className="now-button"
                onClick={getCurrentDateTime}
                disabled={loading}
              >
                Now
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div className="form-group">
            <label htmlFor="categoryId">
              Category <span className="required">*</span>
            </label>
            {categoriesLoading ? (
              <div className="loading-categories">Loading categories...</div>
            ) : (
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="category-select"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label htmlFor="amount">
              Amount <span className="required">*</span>
            </label>
            <div className="amount-input-container">
              <span className="currency-symbol">$</span>
              <input
                type="text"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                required
                disabled={loading}
                className="amount-input"
                maxLength={10}
              />
            </div>
          </div>

          {/* Description Input */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="What did you spend on?"
              disabled={loading}
              className="description-input"
              maxLength={500}
            />
          </div>

          {/* Location Input (Optional) */}
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Where did you make this purchase?"
              disabled={loading}
              className="location-input"
              maxLength={255}
            />
          </div>

          {/* Notes Input (Optional) */}
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Any additional notes or details..."
              disabled={loading}
              className="notes-input"
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || categoriesLoading}
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpense;