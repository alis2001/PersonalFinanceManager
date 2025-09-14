import React from 'react';
import type { Expense } from '../services/expenseService';
import expenseService from '../services/expenseService';
import '../styles/RecentExpensesTable.css';

interface RecentExpensesTableProps {
  expenses: Expense[];
  loading: boolean;
  onExpenseClick: (expense: Expense) => void;
  onRetry?: () => void;
}

const RecentExpensesTable: React.FC<RecentExpensesTableProps> = ({
  expenses,
  loading,
  onExpenseClick,
  onRetry
}) => {

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount: number): string => {
    return expenseService.formatCurrency(amount);
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
          <h3>No expenses yet</h3>
          <p>Your recent expenses will appear here once you start tracking them.</p>
          {onRetry && (
            <button 
              className="btn-retry"
              onClick={onRetry}
            >
              Refresh
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
              <th className="date-column">Date</th>
              <th className="time-column">Time</th>
              <th className="category-column">Category</th>
              <th className="amount-column">Amount</th>
              <th className="description-column">Description</th>
              <th className="location-column">Location</th>
              <th className="notes-column">Notes</th>
              <th className="actions-column">Actions</th>
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
                    {formatDate(expense.transactionDate)}
                  </span>
                </td>
                
                <td className="time-cell">
                  <span className="time-text">
                    {formatTime(expense.transactionDate)}
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
                      {expense.category.name}
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
                    title="Edit expense"
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
          <p className="showing-text">Showing last 10 expenses</p>
          <button 
            className="view-all-button"
            onClick={() => console.log('View all expenses')}
          >
            View All Expenses
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentExpensesTable;