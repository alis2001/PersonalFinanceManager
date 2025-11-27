import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../contexts/ModeContext';
import authService from '../services/authService';
import transactionService, { Transaction } from '../services/transactionService';
import categoryService from '../services/categoryService';
import currencyService from '../services/currencyService';
import type { Category } from '../services/categoryService';
import AddExpense from './AddExpense';
import RecentExpensesTable from './RecentExpensesTable';
import EditExpense from './EditExpense';
import ManageCategories from './ManageCategories';
import ModeSwitcher from './ModeSwitcher';
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

interface TransactionStats {
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
  const { mode, isExpenseMode, isIncomeMode, getModeColor } = useMode();
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
  const [weeklyStats, setWeeklyStats] = useState<TransactionStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<TransactionStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<TransactionStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [recentTransactionsLoading, setRecentTransactionsLoading] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  // const [showReceiptUpload, setShowReceiptUpload] = useState(false); // COMMENTED OUT - Not fully implemented
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      loadTransactionStats();
      loadRecentTransactions();
      loadCategories();
    }
  }, [user, mode]); // Reload when mode changes

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

  const loadTransactionStats = async () => {
    setStatsLoading(true);
    
    try {
      const [weeklyResult, monthlyResult, yearlyResult] = await Promise.all([
        transactionService.getStats(mode, 'weekly'),
        transactionService.getStats(mode, 'monthly'),
        transactionService.getStats(mode, 'yearly')
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
      console.error(`Failed to load ${mode} stats:`, error);
    }
    
    setStatsLoading(false);
  };

  const loadRecentTransactions = async () => {
    setRecentTransactionsLoading(true);
    
    try {
      const result = await transactionService.getTransactions(mode, {
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      if (result.success && result.transactions) {
        setRecentTransactions(result.transactions);
      }
    } catch (error) {
      console.error(`Failed to load recent ${mode} transactions:`, error);
    }
    
    setRecentTransactionsLoading(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const handleAddTransaction = () => {
    setShowAddTransaction(true);
  };

  const handleAddTransactionSuccess = () => {
    loadTransactionStats();
    loadRecentTransactions();
  };

  // COMMENTED OUT - Receipt processing not fully implemented
  // const handleReceiptUpload = () => {
  //   setShowReceiptUpload(true);
  // };

  // const handleReceiptUploadSuccess = () => {
  //   loadTransactionStats();
  //   loadRecentTransactions();
  // };

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowEditTransaction(true);
  };

  const handleEditTransactionSuccess = () => {
    loadTransactionStats();
    loadRecentTransactions();
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
    loadTransactionStats();
    loadRecentTransactions();
    loadCategories();
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
                  <div className="header-actions">
                    <ModeSwitcher />
                    <LanguageSwitcher compact={true} />
                    <div className="user-menu">
                      <span className="welcome">{t('dashboard.welcome', { name: user?.firstName || '' })}</span>
                      <button className="btn-logout" onClick={handleLogout}>
                        {t('common.logout')}
                      </button>
                    </div>
                  </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <h3>{isExpenseMode ? t('dashboard.weeklyExpenses') : t('dashboard.weeklyIncome')}</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(weeklyStats?.total || 0)}
                </p>
                <span className="stat-label">{weeklyStats?.transactionCount || 0} {t('dashboard.transactions')}</span>
              </div>
            </div>

            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>{isExpenseMode ? t('dashboard.monthlyExpenses') : t('dashboard.monthlyIncome')}</h3>
                <p className="stat-value">
                  {statsLoading ? '...' : formatCurrency(monthlyStats?.total || 0)}
                </p>
                <span className="stat-label">{monthlyStats?.transactionCount || 0} {t('dashboard.transactions')}</span>
              </div>
            </div>

            <div className={getStatCardClass(statsLoading)}>
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <h3>{isExpenseMode ? t('dashboard.yearlyExpenses') : t('dashboard.yearlyIncome')}</h3>
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
              <h2>
                {isExpenseMode 
                  ? t('dashboard.topExpenseCategoriesThisMonth') 
                  : t('dashboard.topIncomeCategoriesThisMonth')
                }
              </h2>
              <div className="category-grid">
                {aggregateByRootCategories(monthlyStats.topCategories).map((category, index) => (
                  <div key={index} className="category-item">
                    <div className="category-info">
                      <span className="category-icon">
                        {category.icon}
                      </span>
                      <div>
                        <h4>{getTranslatedCategoryName(category.name, t)}</h4>
                        <p className="category-amount">
                          {formatCurrency(category.amount)}
                        </p>
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
                <button 
                  className="btn-action primary"
                  onClick={handleAddTransaction}
                >
                  {isExpenseMode ? t('dashboard.addExpense') : t('dashboard.addIncome')}
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
            <h2>
              {isExpenseMode ? t('dashboard.recentExpenses') : t('dashboard.recentIncome')}
            </h2>
            <RecentExpensesTable
              transactions={recentTransactions}
              loading={recentTransactionsLoading}
              onTransactionClick={handleEditTransaction}
              onRetry={loadRecentTransactions}
              userCurrency={user?.defaultCurrency}
              mode={mode}
            />
          </div>
        </div>
      </main>

      <AddExpense 
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onExpenseAdded={handleAddTransactionSuccess}
        userCurrency={user?.defaultCurrency}
        mode={mode}
      />

      {/* COMMENTED OUT - Receipt processing not fully implemented */}
      {/* <ReceiptUpload 
        isOpen={showReceiptUpload}
        onClose={() => setShowReceiptUpload(false)}
        onReceiptProcessed={handleReceiptUploadSuccess}
      /> */}

      {selectedTransaction && (
        <EditExpense 
          isOpen={showEditTransaction}
          expense={selectedTransaction}
          onClose={() => {
            setShowEditTransaction(false);
            setSelectedTransaction(null);
          }}
          onExpenseUpdated={handleEditTransactionSuccess}
          userCurrency={user?.defaultCurrency}
          mode={mode}
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