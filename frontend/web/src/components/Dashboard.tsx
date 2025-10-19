import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import currencyService from '../services/currencyService';
import type { Expense } from '../services/expenseService';
import type { Category } from '../services/categoryService';
import AddExpense from './AddExpense';
import RecentExpensesTable from './RecentExpensesTable';
import EditExpense from './EditExpense';
import ManageCategories from './ManageCategories';
// import ReceiptUpload from './ReceiptUpload'; // COMMENTED OUT - Not fully implemented
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../hooks/useTranslation';
import { getTranslatedCategoryName, getHierarchicalCategoryName } from '../utils/categoryUtils';
import '../styles/Dashboard.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultCurrency: string;
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
  const { t, currentLanguage } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);

  // Function to get hierarchical category name
  const getCategoryDisplayName = (categoryName: string): string => {
    const category = categories.find(cat => cat.name === categoryName);
    if (category && category.parent_id) {
      return getHierarchicalCategoryName(category, categories, t);
    }
    return getTranslatedCategoryName(categoryName, t);
  };

  // Function to aggregate expenses by root categories
  const aggregateByRootCategories = (topCategories: Array<{
    name: string;
    color: string;
    icon: string;
    amount: number;
  }>) => {
    const rootCategoryMap = new Map<string, {
      name: string;
      color: string;
      icon: string;
      amount: number;
    }>();

    topCategories.forEach(category => {
      const categoryObj = categories.find(cat => cat.name === category.name);
      
      if (!categoryObj) {
        // If category not found in categories list, treat as root
        rootCategoryMap.set(category.name, category);
        return;
      }

      // Find the root category
      let rootCategory = categoryObj;
      while (rootCategory.parent_id) {
        const parent = categories.find(cat => cat.id === rootCategory.parent_id);
        if (parent) {
          rootCategory = parent;
        } else {
          break;
        }
      }

      const rootCategoryName = rootCategory.name;
      
      if (rootCategoryMap.has(rootCategoryName)) {
        // Add to existing root category
        const existing = rootCategoryMap.get(rootCategoryName)!;
        existing.amount += category.amount;
      } else {
        // Create new root category entry
        rootCategoryMap.set(rootCategoryName, {
          name: rootCategoryName,
          color: rootCategory.color || '#6b7280',
          icon: rootCategory.icon || '📁',
          amount: category.amount
        });
      }
    });

    // Convert map to array and sort by amount
    return Array.from(rootCategoryMap.values())
      .sort((a, b) => b.amount - a.amount);
  };
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
  // const [showReceiptUpload, setShowReceiptUpload] = useState(false); // COMMENTED OUT - Not fully implemented
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      loadExpenseStats();
      loadRecentExpenses();
      loadCategories();
    }
  }, [user]);

  const loadCategories = async () => {
    try {
      const result = await categoryService.getCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

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

  // COMMENTED OUT - Receipt processing not fully implemented
  // const handleReceiptUpload = () => {
  //   setShowReceiptUpload(true);
  // };

  // const handleReceiptUploadSuccess = () => {
  //   loadExpenseStats();
  //   loadRecentExpenses();
  // };

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
    const currency = user?.defaultCurrency || 'USD';
    return currencyService.formatCurrency(amount, currency, currentLanguage);
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
            <h1>Rapilot</h1>
          </div>
                  <div className="user-menu">
                    <LanguageSwitcher compact={true} />
                    <span className="welcome">{t('dashboard.welcome', { name: user?.firstName || '' })}</span>
                    <button className="btn-logout" onClick={handleLogout}>
                      {t('common.logout')}
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
                <h3>{t('dashboard.weeklyExpenses')}</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(weeklyStats?.total || 0)}
                </p>
                <span className="stat-label">{weeklyStats?.transactionCount || 0} {t('dashboard.transactions')}</span>
              </div>
            </div>

            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>{t('dashboard.monthlyExpenses')}</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(monthlyStats?.total || 0)}
                </p>
                <span className="stat-label">{monthlyStats?.transactionCount || 0} {t('dashboard.transactions')}</span>
              </div>
            </div>

            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <h3>{t('dashboard.yearlyExpenses')}</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(yearlyStats?.total || 0)}
                </p>
                <span className="stat-label">{yearlyStats?.transactionCount || 0} {t('dashboard.transactions')}</span>
              </div>
            </div>
          </div>

          {/* Top Categories Section */}
          {monthlyStats?.topCategories && monthlyStats.topCategories.length > 0 && (
            <div className="top-categories-section">
              <h2>{t('dashboard.topCategoriesThisMonth')}</h2>
              <div className="category-grid">
                {aggregateByRootCategories(monthlyStats.topCategories).map((category, index) => (
                  <div key={index} className="category-item">
                    <div className="category-info">
                      <span className="category-icon">{category.icon}</span>
                      <div>
                        <h4>{getTranslatedCategoryName(category.name, t)}</h4>
                        <p className="category-amount">{formatCurrency(category.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="quick-actions">
            <h2>{t('dashboard.quickActions')}</h2>
            <div className="action-buttons">
                <button className="btn-action primary" onClick={handleAddExpense}>
                {t('dashboard.addExpense')}
                </button>
                {/* COMMENTED OUT - Receipt processing not fully implemented */}
                {/* <button className="btn-action purple" onClick={handleReceiptUpload}>
                <span>📸</span>
                {t('dashboard.uploadReceipt')}
                </button> */}
                <button className="btn-action" onClick={handleViewAnalytics}>
                <span>📊</span>
                {t('dashboard.viewAnalytics')}
                </button>
                <button className="btn-action" onClick={handleManageCategories}>
                <span>🏷️</span>
                {t('dashboard.manageCategories')}
                </button>
                <button className="btn-action" onClick={handleViewAllTransactions}>
                <span>📋</span>
                {t('dashboard.viewAllTransactions')}
                </button>
            </div>
          </div>

          <div className="recent-activity">
            <h2>{t('dashboard.recentExpenses')}</h2>
            <RecentExpensesTable
              expenses={recentExpenses}
              loading={recentExpensesLoading}
              onExpenseClick={handleEditExpense}
              onRetry={loadRecentExpenses}
              userCurrency={user?.defaultCurrency}
            />
          </div>
        </div>
      </main>

      <AddExpense 
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleAddExpenseSuccess}
        userCurrency={user?.defaultCurrency}
      />

      {/* COMMENTED OUT - Receipt processing not fully implemented */}
      {/* <ReceiptUpload 
        isOpen={showReceiptUpload}
        onClose={() => setShowReceiptUpload(false)}
        onReceiptProcessed={handleReceiptUploadSuccess}
      /> */}

      {selectedExpense && (
        <EditExpense 
          isOpen={showEditExpense}
          expense={selectedExpense}
          onClose={() => {
            setShowEditExpense(false);
            setSelectedExpense(null);
          }}
          onExpenseUpdated={handleEditExpenseSuccess}
          userCurrency={user?.defaultCurrency}
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