import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import expenseService from '../services/expenseService';
import type { Expense } from '../services/expenseService';
import AddExpense from './AddExpense';
import '../styles/Dashboard.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface ExpenseStats {
  period: string;
  total: number;
  transactionCount: number;
  topCategories: Array<{
    name: string;
    color: string;
    icon: string;
    amount: number;
  }>;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentExpensesLoading, setRecentExpensesLoading] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<ExpenseStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<ExpenseStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<ExpenseStats | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      loadExpenseStats();
      loadRecentExpenses();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const profile = await authService.getProfile();
    if (profile) {
      setUser(profile);
    } else {
      navigate('/login');
    }
    setLoading(false);
  };

  const loadExpenseStats = async () => {
    setStatsLoading(true);
    
    try {
      const [weeklyResult, monthlyResult, yearlyResult] = await Promise.all([
        expenseService.getExpenseStats('weekly'),
        expenseService.getExpenseStats('monthly'),
        expenseService.getExpenseStats('yearly')
      ]);

      if (weeklyResult.success && weeklyResult.stats) {
        setWeeklyStats(weeklyResult.stats);
      }
      
      if (monthlyResult.success && monthlyResult.stats) {
        setMonthlyStats(monthlyResult.stats);
      }
      
      if (yearlyResult.success && yearlyResult.stats) {
        setYearlyStats(yearlyResult.stats);
      }
    } catch (error) {
      console.error('Failed to load expense stats:', error);
    }
    
    setStatsLoading(false);
  };

  const loadRecentExpenses = async () => {
    setRecentExpensesLoading(true);
    
    try {
      const result = await expenseService.getExpenses({
        page: 1,
        limit: 10,
        sortBy: 'transaction_date',
        sortOrder: 'desc'
      });

      if (result.success && result.expenses) {
        setRecentExpenses(result.expenses);
      }
    } catch (error) {
      console.error('Failed to load recent expenses:', error);
    }
    
    setRecentExpensesLoading(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleAddExpense = () => {
    setShowAddExpense(true);
  };

  const handleAddExpenseSuccess = () => {
    loadExpenseStats();
    loadRecentExpenses();
  };

  const handleViewAnalytics = () => {
    console.log('View analytics clicked');
  };

  const formatCurrency = (amount: number): string => {
    return expenseService.formatCurrency(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getStatCardClass = (isLoading: boolean) => {
    return `stat-card ${isLoading ? 'loading' : ''}`;
  };

  if (loading) {
    return <div className="dashboard loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">💰</span>
            <h1>FinanceTracker</h1>
          </div>
          <div className="user-menu">
            <span className="welcome">Welcome, {user?.firstName}!</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* Expense Statistics Cards */}
          <div className="stats-grid">
            {/* Weekly Expenses */}
            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <h3>Weekly Expenses</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(weeklyStats?.total || 0)}
                </p>
                <p className="stat-detail">
                  {weeklyStats?.transactionCount || 0} transactions
                </p>
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>Monthly Expenses</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(monthlyStats?.total || 0)}
                </p>
                <p className="stat-detail">
                  {monthlyStats?.transactionCount || 0} transactions
                </p>
              </div>
            </div>

            {/* Yearly Expenses */}
            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <h3>Yearly Expenses</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(yearlyStats?.total || 0)}
                </p>
                <p className="stat-detail">
                  {yearlyStats?.transactionCount || 0} transactions
                </p>
              </div>
            </div>
          </div>

          {/* Top Categories Section */}
          {monthlyStats && monthlyStats.topCategories.length > 0 && (
            <div className="top-categories-section">
              <h2>Top Spending Categories This Month</h2>
              <div className="category-grid">
                {monthlyStats.topCategories.map((category, index) => (
                  <div key={index} className="category-item">
                    <div 
                      className="category-icon"
                      style={{ backgroundColor: category.color + '20', color: category.color }}
                    >
                      {category.icon}
                    </div>
                    <div className="category-info">
                      <h4>{category.name}</h4>
                      <p className="category-amount">{formatCurrency(category.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="btn-action primary" onClick={handleAddExpense}>
                <span>➕</span>
                Add Expense
              </button>
              <button className="btn-action" onClick={() => console.log('Add Income')}>
                <span>💰</span>
                Add Income
              </button>
              <button className="btn-action" onClick={handleViewAnalytics}>
                <span>📊</span>
                View Analytics
              </button>
              <button className="btn-action" onClick={() => console.log('Manage Categories')}>
                <span>🏷️</span>
                Manage Categories
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity">
            <h2>Recent Expenses</h2>
            {recentExpensesLoading ? (
              <div className="activity-loading">
                <div className="loading-spinner"></div>
                <p>Loading recent expenses...</p>
              </div>
            ) : recentExpenses.length > 0 ? (
              <div className="expenses-list">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="expense-item">
                    <div className="expense-main">
                      <div 
                        className="expense-category-icon"
                        style={{ backgroundColor: expense.category.color + '20', color: expense.category.color }}
                      >
                        {expense.category.icon}
                      </div>
                      <div className="expense-details">
                        <div className="expense-description">
                          {expense.description || expense.category.name}
                        </div>
                        <div className="expense-category">
                          {expense.category.name}
                          {expense.location && ` • ${expense.location}`}
                        </div>
                      </div>
                    </div>
                    <div className="expense-right">
                      <div className="expense-amount">
                        {formatCurrency(expense.amount)}
                      </div>
                      <div className="expense-date">
                        {formatDate(expense.transactionDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="activity-placeholder">
                <p>No expenses yet</p>
                <button className="btn-secondary" onClick={handleAddExpense}>
                  Add Your First Expense
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Expense Component */}
      <AddExpense 
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleAddExpenseSuccess}
      />
    </div>
  );
};

export default Dashboard;