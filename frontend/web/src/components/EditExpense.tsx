import React, { useState, useEffect } from 'react';
import transactionService, { Transaction } from '../services/transactionService';
import categoryService from '../services/categoryService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
import type { Category } from '../services/categoryService';
import type { TransactionMode } from '../contexts/ModeContext';
import ConditionalDatePicker from './ConditionalDatePicker';
import CategoryTreeSelector from './CategoryTreeSelector';
import '../styles/EditExpense.css';

interface EditExpenseProps {
  isOpen: boolean;
  expense: Transaction;
  onClose: () => void;
  onExpenseUpdated: () => void;
  userCurrency?: string;
  mode?: TransactionMode;
}

const EditExpense: React.FC<EditExpenseProps> = ({ isOpen, expense, onClose, onExpenseUpdated, userCurrency = 'USD', mode = 'expense' }) => {
  const { t, currentLanguage } = useTranslation();
  const isExpenseMode = mode === 'expense';
  const isIncomeMode = mode === 'income';

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
    isRecurring: false,
    frequency: 'monthly',
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
      const result = isExpenseMode
        ? await categoryService.getExpenseCategories()
        : await categoryService.getIncomeCategories();
        
      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        setError(t('expenses.failedToLoadCategories'));
      }
    } catch (err) {
        setError(t('expenses.failedToLoadCategories'));
    }
    setCategoriesLoading(false);
  };

  const populateForm = () => {
    // Convert transaction data to form format
    const transactionDate = new Date(expense.transactionDate);
    const formattedDate = transactionService.formatDateTimeForInput(transactionDate);
    
    // Type checking for income-specific fields
    const incomeData = expense as any;

    setFormData({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      description: expense.description || '',
      transactionDate: formattedDate,
      location: (expense as any).location || '',
      isRecurring: (expense as any).isRecurring || false,
      frequency: (expense as any).frequency || 'monthly',
      notes: expense.notes || ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
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
      return t('expenses.pleaseSelectCategory');
    }
    
    const numericAmount = parseFloat(formData.amount);
    
    if (!formData.amount || isNaN(numericAmount) || numericAmount <= 0) {
      return t('expenses.pleaseEnterValidAmount');
    }
    
    // Dynamic limit based on currency
    const maxLimit = currencyService.getMaxAmountLimit(userCurrency);
    if (numericAmount > maxLimit) {
      const formattedLimit = currencyService.formatCurrency(maxLimit, userCurrency);
      return `${t('expenses.amountCannotExceed')} ${formattedLimit}`;
    }
    
    if (!formData.transactionDate) {
      return t('expenses.pleaseSelectDateTime');
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
      // Extract user's local date and time from the input field
      const [datePart, timePart] = formData.transactionDate.split('T');
      const userDate = datePart;  // YYYY-MM-DD (exactly as user entered)
      const userTime = `${timePart}:00`;  // HH:MM:SS (add seconds)
      
      // Now create Date object for UTC storage
      const parsedDate = transactionService.parseDateTimeFromInput(formData.transactionDate);
      
      const updateData: any = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || (isIncomeMode ? 'Income' : undefined),
        transactionDate: parsedDate.toISOString(),
        userDate: userDate,
        userTime: userTime,
        notes: formData.notes.trim() || undefined
      };
      
      // Add location field (for both modes)
      updateData.location = formData.location.trim() || undefined;

      // Add recurring fields (for both modes)
      updateData.isRecurring = formData.isRecurring;
      if (formData.isRecurring) {
        updateData.frequency = formData.frequency;
      }

      const result = await transactionService.updateTransaction(mode, expense.id, updateData);

      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || (isExpenseMode ? t('expenses.failedToUpdateExpense') : t('income.failedToUpdateIncome')));
      }
    } catch (err) {
      setError(isExpenseMode ? t('expenses.failedToUpdateExpenseTryAgain') : t('income.failedToUpdateIncomeTryAgain'));
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await transactionService.deleteTransaction(mode, expense.id);

      if (result.success) {
        onExpenseUpdated();
        onClose();
      } else {
        setError(result.error || t('expenses.failedToDeleteExpense'));
      }
    } catch (err) {
      setError(isExpenseMode ? t('expenses.failedToDeleteExpenseTryAgain') : t('income.failedToDeleteIncomeTryAgain'));
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
      transactionDate: transactionService.formatDateTimeForInput(now) 
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="edit-expense-overlay" onClick={handleCancel}>
      <div className="edit-expense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-expense-header">
          <h2>{isExpenseMode ? t('expenses.editExpense') : t('income.editIncome')}</h2>
          <button className="close-button" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-expense-form">
          {error && <div className="error-message">{error}</div>}

          {/* Date & Time Input */}
          <div className="form-group">
            <label htmlFor="transactionDate">
              {t('expenses.dateTime')} <span className="required">*</span>
            </label>
            <div className="date-input-container">
              <ConditionalDatePicker
                value={formData.transactionDate}
                onChange={(value) => setFormData(prev => ({ ...prev, transactionDate: value }))}
                disabled={loading}
                placeholder={t('expenses.dateTime')}
                showTime={true}
                className="date-input"
                type="datetime-local"
              />
            </div>
          </div>

          {/* Category Selection */}
          <div className="form-group">
            <label htmlFor="categoryId">
              {t('expenses.category')} <span className="required">*</span>
            </label>
            {categoriesLoading ? (
              <div className="loading-select">{t('expenses.loadingCategories')}</div>
            ) : (
              <CategoryTreeSelector
                categories={categories}
                selectedCategoryId={formData.categoryId}
                onCategorySelect={(categoryId) => setFormData(prev => ({ ...prev, categoryId }))}
                disabled={loading}
                placeholder={t('expenses.selectCategory')}
              />
            )}
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label htmlFor="amount">
              {t('expenses.amount')} <span className="required">*</span>
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

          {/* Description Input */}
          <div className="form-group">
            <label htmlFor="description">
              {t('expenses.description')}
              {isIncomeMode && <span className="required">*</span>}
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={isExpenseMode ? t('expenses.whatDidYouSpendOn') : t('income.whatIsThisIncomeFor')}
              disabled={loading}
              className="description-input"
              maxLength={500}
              required={isIncomeMode}
            />
          </div>

          {/* Location Input (for both modes) */}
          <div className="form-group">
            <label htmlFor="location">{t('expenses.location')}</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder={isExpenseMode ? t('expenses.whereDidYouMakePurchase') : t('expenses.location')}
              disabled={loading}
              className="location-input"
              maxLength={255}
            />
          </div>

          {/* Recurring Checkbox */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isRecurring"
                checked={formData.isRecurring}
                onChange={handleInputChange}
                disabled={loading}
              />
              <span className="checkmark"></span>
              {isExpenseMode ? t('expenses.isRecurring') : t('income.isRecurring')}
            </label>
          </div>

          {/* Frequency Dropdown (only shown when recurring is checked) */}
          {formData.isRecurring && (
            <div className="form-group">
              <label htmlFor="frequency">
                {isExpenseMode ? t('expenses.frequency') : t('income.frequency')} *
              </label>
              <select
                id="frequency"
                name="frequency"
                value={formData.frequency}
                onChange={handleInputChange}
                required={formData.isRecurring}
                disabled={loading}
              >
                <option value="daily">{t('income.daily')}</option>
                <option value="weekly">{t('income.weekly')}</option>
                <option value="bi_weekly">{t('income.biweekly')}</option>
                <option value="semi_monthly">{t('income.semiMonthly')}</option>
                <option value="monthly">{t('income.monthly')}</option>
                <option value="bi_monthly">{t('income.biMonthly')}</option>
                <option value="quarterly">{t('income.quarterly')}</option>
                <option value="semi_annually">{t('income.semiAnnually')}</option>
                <option value="yearly">{t('income.yearly')}</option>
              </select>
              <small className="form-help">{t('income.frequencyHelp')}</small>
            </div>
          )}

          {/* Notes Input (Optional) */}
          <div className="form-group">
            <label htmlFor="notes">{t('expenses.notes')}</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder={t('expenses.additionalNotes')}
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
                🗑️ {t('common.delete')}
              </button>
            </div>
            <div className="form-actions-right">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCancel}
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading || categoriesLoading}
              >
                {loading 
                  ? (isExpenseMode ? t('expenses.updating') : t('income.updating'))
                  : (isExpenseMode ? t('expenses.updateExpense') : t('income.updateIncome'))
                }
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-modal">
              <div className="delete-confirm-header">
                <h3>{t('expenses.deleteExpense')}</h3>
              </div>
              <div className="delete-confirm-body">
                <p>{t('expenses.deleteConfirm')}</p>
                <div className="expense-preview">
                  <div className="expense-preview-item">
                    <span className="expense-preview-label">{t('expenses.amount')}:</span>
                    <span className="expense-preview-value">{currencyService.formatCurrency(expense.amount, userCurrency, currentLanguage)}</span>
                  </div>
                  <div className="expense-preview-item">
                    <span className="expense-preview-label">{t('expenses.category')}:</span>
                    <span className="expense-preview-value">{expense.category.name}</span>
                  </div>
                  {expense.description && (
                    <div className="expense-preview-item">
                      <span className="expense-preview-label">{t('expenses.description')}:</span>
                      <span className="expense-preview-value">{expense.description}</span>
                    </div>
                  )}
                </div>
                <p className="delete-warning">{t('expenses.deleteWarning')}</p>
              </div>
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="btn-cancel-delete"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? t('expenses.deleting') : t('expenses.deleteExpense')}
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