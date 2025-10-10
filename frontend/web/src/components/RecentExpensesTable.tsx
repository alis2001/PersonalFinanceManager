import React from 'react';
import type { Expense } from '../services/expenseService';
import expenseService from '../services/expenseService';
import currencyService from '../services/currencyService';
import dateConversionService from '../services/dateConversionService';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/RecentExpensesTable.css';

interface RecentExpensesTableProps {
  expenses: Expense[];
  loading: boolean;
  onExpenseClick: (expense: Expense) => void;
  onRetry?: () => void;
  userCurrency?: string;
}

const RecentExpensesTable: React.FC<RecentExpensesTableProps> = ({
  expenses,
  loading,
  onExpenseClick,
  onRetry,
  userCurrency = 'USD'
}) => {
  const { t, currentLanguage } = useTranslation();

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

  const formatDate = (userDate: string): string => {
    // userDate is already in YYYY-MM-DD format (user's local date)
    return dateConversionService.formatDateShort(userDate, currentLanguage);
  };

  const formatTime = (userTime: string): string => {
    // userTime is in HH:MM:SS format, extract HH:MM for display
    return userTime ? userTime.substring(0, 5) : '00:00';
  };

  const formatCurrency = (amount: number): string => {
    return currencyService.formatCurrency(amount, userCurrency, currentLanguage);
  };

  const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="expenses-table-container">
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <p>Loading recent expenses...</p>
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="expenses-table-container">
        <div className="table-empty">
          <div className="empty-icon">📊</div>
          <h3>{t('expenses.noExpensesYet')}</h3>
          <p>{t('expenses.recentExpensesDescription')}</p>
          {onRetry && (
            <button 
              className="btn-retry"
              onClick={onRetry}
            >
              {t('expenses.refresh')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-table-container">
      <div className="table-wrapper">
        <table className="expenses-table">
          <thead>
            <tr>
              <th className="date-column">{t('expenses.date')}</th>
              <th className="time-column">{t('expenses.time')}</th>
              <th className="category-column">{t('expenses.category')}</th>
              <th className="amount-column">{t('expenses.amount')}</th>
              <th className="description-column">{t('expenses.description')}</th>
              <th className="location-column">{t('expenses.location')}</th>
              <th className="notes-column">{t('expenses.notes')}</th>
              <th className="actions-column">{t('expenses.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr 
                key={expense.id} 
                className="expense-row"
                onClick={() => onExpenseClick(expense)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onExpenseClick(expense);
                  }
                }}
              >
                <td className="date-cell">
                  <span className="date-text">
                    {formatDate(expense.userDate || expense.transactionDate)}
                  </span>
                </td>
                
                <td className="time-cell">
                  <span className="time-text">
                    {formatTime(expense.userTime || expense.transactionDate)}
                  </span>
                </td>
                
                <td className="category-cell">
                  <div className="category-content">
                    <div 
                      className="category-icon-small"
                      style={{ 
                        backgroundColor: expense.category.color + '20', 
                        color: expense.category.color 
                      }}
                    >
                      {expense.category.icon}
                    </div>
                    <span className="category-name">
                      {getTranslatedCategoryName(expense.category.name)}
                    </span>
                  </div>
                </td>
                
                <td className="amount-cell">
                  <span className="amount-text">
                    {formatCurrency(expense.amount)}
                  </span>
                </td>
                
                <td className="description-cell">
                  <span className="description-text">
                    {truncateText(expense.description, 30) || '—'}
                  </span>
                </td>
                
                <td className="location-cell">
                  <span className="location-text">
                    {truncateText(expense.location, 25) || '—'}
                  </span>
                </td>
                
                <td className="notes-cell">
                  <span className="notes-text">
                    {truncateText(expense.notes, 30) || '—'}
                  </span>
                </td>
                
                <td className="actions-cell">
                  <button 
                    className="edit-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpenseClick(expense);
                    }}
                    title={t('expenses.editExpenseTitle')}
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {expenses.length === 10 && (
        <div className="table-footer">
          <p className="showing-text">{t('expenses.showingLast10')}</p>
          <button 
            className="view-all-button"
            onClick={() => console.log('View all expenses')}
          >
            {t('expenses.viewAllExpenses')}
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentExpensesTable;