// frontend/web/src/components/AddExpense.tsx
import React, { useState, useEffect } from 'react';
import transactionService from '../services/transactionService';
import categoryService from '../services/categoryService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
import type { Category } from '../services/categoryService';
import type { TransactionMode } from '../contexts/ModeContext';
import ConditionalDatePicker from './ConditionalDatePicker';
import CategoryTreeSelector from './CategoryTreeSelector';
import { getLeafCategories } from '../utils/categoryUtils';
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
  userCurrency?: string;
  mode?: TransactionMode;
}

const AddExpense: React.FC<AddExpenseProps> = ({ 
  isOpen, 
  onClose, 
  onExpenseAdded, 
  prefilledData, 
  title, 
  fromReceipt = false,
  userCurrency = 'USD',
  mode = 'expense'
}) => {
  const { t } = useTranslation();
  const isExpenseMode = mode === 'expense';
  const isIncomeMode = mode === 'income';

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
  
  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: '',
    transactionDate: transactionService.formatDateTimeForInput(new Date()),
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
        transactionDate: prefilledData.transactionDate || transactionService.formatDateTimeForInput(new Date()),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else if (isOpen && !prefilledData) {
      // Reset to defaults for manual entry
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: transactionService.formatDateTimeForInput(new Date()),
        location: '',
        notes: ''
      });
    }
  }, [isOpen, prefilledData, categories]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const result = isExpenseMode 
        ? await categoryService.getExpenseCategories()
        : await categoryService.getIncomeCategories();
      
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
    
    // For income, description is REQUIRED
    if (isIncomeMode && !formData.description.trim()) {
      return t('income.descriptionRequired');
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
      // Parse the transactionDate value from the input field
      // This is CRITICAL: formData.transactionDate is in format "YYYY-MM-DDTHH:mm"
      // We need to extract the date/time AS THE USER SEES IT (local), not after UTC conversion
      
      const [datePart, timePart] = formData.transactionDate.split('T');
      const userDate = datePart;  // YYYY-MM-DD (exactly as user entered)
      const userTime = `${timePart}:00`;  // HH:MM:SS (add seconds)
      
      // Now create Date object for UTC storage
      const parsedDate = transactionService.parseDateTimeFromInput(formData.transactionDate);
      
      const transactionData: any = {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        description: formData.description.trim() || (isIncomeMode ? 'Income' : undefined),
        transactionDate: parsedDate.toISOString(),  // UTC for ordering
        userDate: userDate,  // Local date as user entered
        userTime: userTime,  // Local time as user entered
        notes: formData.notes.trim() || undefined
      };
      
      // Add location field (for both modes)
      transactionData.location = formData.location.trim() || undefined;

      const result = await transactionService.createTransaction(mode, transactionData);

      if (result.success) {
        // Reset form based on mode
        if (prefilledData) {
          // If from receipt, restore prefilled data for next transaction
          setFormData({
            categoryId: prefilledData.categoryId || (categories.length > 0 ? categories[0].id : ''),
            amount: prefilledData.amount ? prefilledData.amount.toString() : '',
            description: prefilledData.description || '',
            transactionDate: prefilledData.transactionDate || transactionService.formatDateTimeForInput(new Date()),
            location: prefilledData.location || '',
            notes: prefilledData.notes || ''
          });
        } else {
          // Manual entry - clear all fields
          setFormData({
            categoryId: categories.length > 0 ? categories[0].id : '',
            amount: '',
            description: '',
            transactionDate: transactionService.formatDateTimeForInput(new Date()),
            location: '',
            notes: ''
          });
        }
        
        onExpenseAdded();
        if (!fromReceipt) {
          onClose();
        }
      } else {
        setError(result.error || (isExpenseMode ? t('expenses.failedToCreateExpense') : t('income.failedToCreateIncome')));
      }
    } catch (err) {
      setError(isExpenseMode ? t('expenses.failedToCreateExpenseTryAgain') : t('income.failedToCreateIncomeTryAgain'));
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
        transactionDate: prefilledData.transactionDate || transactionService.formatDateTimeForInput(new Date()),
        location: prefilledData.location || '',
        notes: prefilledData.notes || ''
      });
    } else {
      // Manual entry - clear all fields
      setFormData({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        description: '',
        transactionDate: transactionService.formatDateTimeForInput(new Date()),
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
      transactionDate: transactionService.formatDateTimeForInput(now) 
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="add-expense-overlay" onClick={handleCancel}>
      <div className="add-expense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-expense-header">
          <h2>
            {title || (isExpenseMode ? t('expenses.addNewExpense') : t('income.addNewIncome'))}
            {fromReceipt && <span className="receipt-badge"> 📄 {t('expenses.fromReceipt')}</span>}
          </h2>
          <button className="close-button" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-expense-form">
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
              <div className="loading-categories">{t('expenses.loadingCategories')}</div>
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
              <span className="currency-symbol">{currencyService.getCurrencyByCode(userCurrency)?.symbol || '$'}</span>
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
                ? (isExpenseMode ? t('expenses.adding') : t('income.adding'))
                : (isExpenseMode ? t('expenses.addExpense') : t('income.addIncome'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpense;