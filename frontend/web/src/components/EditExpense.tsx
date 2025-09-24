import React, { useState, useEffect } from 'react';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import type { Category } from '../services/categoryService';
import type { Expense } from '../services/expenseService';
import '../styles/EditExpense.css';

interface EditExpenseProps {
  isOpen: boolean;
  expense: Expense;
  onClose: () => void;
  onExpenseUpdated: () => void;
}

const EditExpense: React.FC<EditExpenseProps> = ({ isOpen, expense, onClose, onExpenseUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
    const formattedDate = expenseService.formatDateTimeForInput(transactionDate);

    setFormData({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      description: expense.description || '',
      transactionDate: formattedDate,
      location: expense.location || '',
      notes: expense.notes || ''
    });
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
      const updateData = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || undefined,
        transactionDate: expenseService.parseDateTimeFromInput(formData.transactionDate).toISOString(),
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined
      };

      const result = await expenseService.updateExpense(expense.id, updateData);

      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || 'Failed to update expense');
      }
    } catch (err) {
      setError('Failed to update expense. Please try again.');
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await expenseService.deleteExpense(expense.id);

      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || 'Failed to delete expense');
      }
    } catch (err) {
      setError('Failed to delete expense. Please try again.');
    }

    setLoading(false);
    setShowDeleteConfirm(false);
  };

  const handleCancel = () => {
    setError('');
    setShowDeleteConfirm(false);
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
    <div className="edit-expense-overlay" onClick={handleCancel}>
      <div className="edit-expense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-expense-header">
          <h2>Edit Expense</h2>
          <button className="close-button" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-expense-form">
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
              <div className="loading-select">Loading categories...</div>
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
                {categories.map((category) => (
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
              />
            </div>
          </div>

          {/* Description Input (Optional) */}
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
            <div className="form-actions-left">
              <button
                type="button"
                className="btn-delete"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                🗑️ Delete
              </button>
            </div>
            <div className="form-actions-right">
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
                {loading ? 'Updating...' : 'Update Expense'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-modal">
              <div className="delete-confirm-header">
                <h3>Delete Expense</h3>
              </div>
              <div className="delete-confirm-body">
                <p>Are you sure you want to delete this expense?</p>
                <div className="expense-preview">
                  <div className="expense-preview-item">
                    <span className="expense-preview-label">Amount:</span>
                    <span className="expense-preview-value">{expenseService.formatCurrency(expense.amount)}</span>
                  </div>
                  <div className="expense-preview-item">
                    <span className="expense-preview-label">Category:</span>
                    <span className="expense-preview-value">{expense.category.name}</span>
                  </div>
                  {expense.description && (
                    <div className="expense-preview-item">
                      <span className="expense-preview-label">Description:</span>
                      <span className="expense-preview-value">{expense.description}</span>
                    </div>
                  )}
                </div>
                <p className="delete-warning">This action cannot be undone.</p>
              </div>
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="btn-cancel-delete"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete Expense'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditExpense;