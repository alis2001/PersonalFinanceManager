import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import expenseService from '../services/expenseService';
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
  const [weeklyStats, setWeeklyStats] = useState<ExpenseStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<ExpenseStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<ExpenseStats | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      loadExpenseStats();
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
      // Load all three periods concurrently
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

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleAddExpense = () => {
    setShowAddExpense(true);
  };

  const handleAddExpenseSuccess = () => {
    // Reload expense stats when a new expense is added
    loadExpenseStats();
  };

  const handleViewAnalytics = () => {
    // TODO: Navigate to analytics page
    console.log('View analytics clicked');
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
            <h2>Recent Activity</h2>
            <div className="activity-placeholder">
              <p>Your recent expenses will appear here</p>
              <button className="btn-secondary" onClick={handleAddExpense}>
                Add Your First Expense
              </button>
            </div>
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