import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';  // ← MAKE SURE THIS IS HERE
import authService from '../services/authService';
import expenseService from '../services/expenseService';
import type { Expense } from '../services/expenseService';
import AddExpense from './AddExpense';
import RecentExpensesTable from './RecentExpensesTable';
import EditExpense from './EditExpense';
import ManageCategories from './ManageCategories';
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
  const [weeklyStats, setWeeklyStats] = useState<ExpenseStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<ExpenseStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<ExpenseStats | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [recentExpensesLoading, setRecentExpensesLoading] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

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
        sortBy: 'created_at',
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

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const handleEditExpenseSuccess = () => {
    loadExpenseStats();
    loadRecentExpenses();
  };

  const handleViewAnalytics = () => {
  console.log('Navigating to analytics dashboard...');
  navigate('/analytics');
};

  const handleViewAllTransactions = () => {
    navigate('/transactions');
  };

  const handleManageCategories = () => {
    setShowManageCategories(true);
  };

  const handleManageCategoriesSuccess = () => {
    loadExpenseStats();
    loadRecentExpenses();
  };

  const formatCurrency = (amount: number): string => {
    return expenseService.formatCurrency(amount);
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
          <div className="stats-grid">
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

          {/* UPDATED: Only 3 buttons, removed Add Income and + symbol */}
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
                <button className="btn-action primary" onClick={handleAddExpense}>
                Add Expense
                </button>
                <button className="btn-action" onClick={handleViewAnalytics}>
                <span>📊</span>
                View Analytics
                </button>
                <button className="btn-action" onClick={handleManageCategories}>
                <span>🏷️</span>
                Manage Categories
                </button>
                <button className="btn-action" onClick={handleViewAllTransactions}>
                <span>📋</span>
                View All Transactions
                </button>
            </div>
          </div>

          <div className="recent-activity">
            <h2>Recent Expenses</h2>
            <RecentExpensesTable
              expenses={recentExpenses}
              loading={recentExpensesLoading}
              onExpenseClick={handleEditExpense}
              onRetry={loadRecentExpenses}
            />
          </div>
        </div>
      </main>

      <AddExpense 
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleAddExpenseSuccess}
      />

      {selectedExpense && (
        <EditExpense 
          isOpen={showEditExpense}
          expense={selectedExpense}
          onClose={() => {
            setShowEditExpense(false);
            setSelectedExpense(null);
          }}
          onExpenseUpdated={handleEditExpenseSuccess}
        />
      )}

      <ManageCategories
        isOpen={showManageCategories}
        onClose={() => setShowManageCategories(false)}
        onCategoriesUpdated={handleManageCategoriesSuccess}
      />
    </div>
  );
};

export default Dashboard;