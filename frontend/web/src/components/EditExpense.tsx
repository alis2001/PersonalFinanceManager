import React, { useState, useEffect } from 'react';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
import type { Category } from '../services/categoryService';
import type { Expense } from '../services/expenseService';
import ConditionalDatePicker from './ConditionalDatePicker';
import '../styles/EditExpense.css';

interface EditExpenseProps {
  isOpen: boolean;
  expense: Expense;
  onClose: () => void;
  onExpenseUpdated: () => void;
  userCurrency?: string;
}

const EditExpense: React.FC<EditExpenseProps> = ({ isOpen, expense, onClose, onExpenseUpdated, userCurrency = 'USD' }) => {
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
        setError(t('expenses.failedToLoadCategories'));
      }
    } catch (err) {
        setError(t('expenses.failedToLoadCategories'));
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
      return t('expenses.pleaseSelectCategory');
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      return t('expenses.pleaseEnterValidAmount');
    }
    
    if (parseFloat(formData.amount) > 999999.99) {
      return t('expenses.amountCannotExceed');
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
        setError(result.error || t('expenses.failedToUpdateExpense'));
      }
    } catch (err) {
      setError(t('expenses.failedToUpdateExpenseTryAgain'));
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
        setError(result.error || t('expenses.failedToDeleteExpense'));
      }
    } catch (err) {
      setError(t('expenses.failedToDeleteExpenseTryAgain'));
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
          <h2>{t('expenses.editExpense')}</h2>
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
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="category-select"
              >
                <option value="">{t('expenses.selectCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {getTranslatedCategoryName(category.name)}
                  </option>
                ))}
              </select>
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

          {/* Description Input (Optional) */}
          <div className="form-group">
            <label htmlFor="description">{t('expenses.description')}</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={t('expenses.whatDidYouSpendOn')}
              disabled={loading}
              className="description-input"
              maxLength={500}
            />
          </div>

          {/* Location Input (Optional) */}
          <div className="form-group">
            <label htmlFor="location">{t('expenses.location')}</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder={t('expenses.whereDidYouMakePurchase')}
              disabled={loading}
              className="location-input"
              maxLength={255}
            />
          </div>

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
                {loading ? t('expenses.updating') : t('expenses.updateExpense')}
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
                    <span className="expense-preview-value">{currencyService.formatCurrency(expense.amount, userCurrency)}</span>
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