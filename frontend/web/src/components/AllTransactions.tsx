// frontend/web/src/components/AllTransactions.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import dateConversionService from '../services/dateConversionService';
import { useTranslation } from '../hooks/useTranslation';
import { getTranslatedCategoryName, getHierarchicalCategoryName } from '../utils/categoryUtils';
import type { Expense } from '../services/expenseService';
import type { Category } from '../services/categoryService';
import RecentExpensesTable from './RecentExpensesTable';
import EditExpense from './EditExpense';
import ConditionalDatePicker from './ConditionalDatePicker';
import CategoryTreeFilter from './CategoryTreeFilter';
import '../styles/AllTransactions.css';

const AllTransactions: React.FC = () => {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();

  // Function to get hierarchical category name
  const getCategoryDisplayName = (categoryName: string): string => {
    const category = categories.find(cat => cat.name === categoryName);
    if (category && category.parent_id) {
      return getHierarchicalCategoryName(category, categories, t);
    }
    return getTranslatedCategoryName(categoryName, t);
  };
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: '',
    search: ''
  });

  useEffect(() => {
    loadCategories();
    
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      dateFrom: formatDateForInput(firstDay),
      dateTo: formatDateForInput(lastDay)
    }));
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [filters, pagination.page]);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const loadCategories = async () => {
    try {
      const result = await categoryService.getExpenseCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    
    try {
      // If a category is selected, get all subcategory IDs for hierarchical filtering
      let categoryIds: string[] = [];
      if (filters.categoryId) {
        const selectedCategory = categories.find(cat => cat.id === filters.categoryId);
        if (selectedCategory) {
          // Get all subcategory IDs including the selected category itself
          categoryIds = getAllSubcategoryIds(selectedCategory.id, categories);
        }
      }

      const result = await expenseService.getExpenses({
        page: pagination.page,
        limit: pagination.limit,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        categoryId: filters.categoryId || undefined,
        search: filters.search || undefined,
        sortBy: 'transaction_date',
        sortOrder: 'desc'
      });

      if (result.success) {
        let filteredExpenses = result.expenses || [];
        
        // If we have category IDs for hierarchical filtering, filter on frontend
        if (categoryIds.length > 0) {
          filteredExpenses = filteredExpenses.filter(expense => 
            categoryIds.includes(expense.categoryId)
          );
        }
        
        setExpenses(filteredExpenses);
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            total: filteredExpenses.length, // Update total based on filtered results
            pages: Math.ceil(filteredExpenses.length / pagination.limit)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    }
    
    setLoading(false);
  };

  // Helper function to get all subcategory IDs for a given category
  const getAllSubcategoryIds = (categoryId: string, allCategories: Category[]): string[] => {
    const subcategoryIds: string[] = [categoryId]; // Include the category itself
    
    (
      allCategories.filter(cat => cat.parent_id === categoryId)
    ).forEach(subcategory => {
      subcategoryIds.push(...getAllSubcategoryIds(subcategory.id, allCategories));
    });
    
    return subcategoryIds;
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
  };

  const handleClearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      categoryId: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const handleEditExpenseSuccess = () => {
    loadExpenses();
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="all-transactions">
      <header className="transactions-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-button" onClick={handleBackToDashboard}>
              ← {t('transactions.backToDashboard')}
            </button>
            <h1>{t('transactions.allTransactions')}</h1>
          </div>
        </div>
      </header>

      <main className="transactions-main">
        <div className="transactions-content">
          
          {/* Filter Section */}
          <div className="filters-section">
            <h2>{t('transactions.filterTransactions')}</h2>
            <div className="filters-grid">
              
              {/* Date Range */}
              <div className="filter-group">
                <label htmlFor="dateFrom">{t('transactions.fromDate')}</label>
                <ConditionalDatePicker
                  value={filters.dateFrom}
                  onChange={(value) => handleFilterChange('dateFrom', value)}
                  className="filter-input"
                  type="date"
                  showTime={false}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="dateTo">{t('transactions.toDate')}</label>
                <ConditionalDatePicker
                  value={filters.dateTo}
                  onChange={(value) => handleFilterChange('dateTo', value)}
                  className="filter-input"
                  type="date"
                  showTime={false}
                />
              </div>

              {/* Category Filter */}
              <div className="filter-group">
                <label htmlFor="categoryId">{t('expenses.category')}</label>
                <CategoryTreeFilter
                  categories={categories}
                  selectedCategoryId={filters.categoryId}
                  onCategorySelect={(categoryId) => handleFilterChange('categoryId', categoryId)}
                  placeholder={t('transactions.allCategories')}
                />
              </div>

              {/* Search */}
              <div className="filter-group">
                <label htmlFor="search">{t('transactions.search')}</label>
                <input
                  type="text"
                  id="search"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder={t('transactions.searchPlaceholder')}
                  className="filter-input"
                />
              </div>

              {/* Clear Filters Button */}
              <div className="filter-group">
                <label>&nbsp;</label>
                <button 
                  className="clear-filters-btn"
                  onClick={handleClearFilters}
                >
                  {t('transactions.clearFilters')}
                </button>
              </div>

            </div>
          </div>

          {/* Results Summary */}
          <div className="results-summary">
            <p>
              {t('transactions.showingResults', { showing: expenses.length, total: pagination.total })}
              {filters.dateFrom && filters.dateTo && (
                <span> {t('transactions.dateRange', { 
                  from: dateConversionService.formatDateShort(filters.dateFrom, currentLanguage), 
                  to: dateConversionService.formatDateShort(filters.dateTo, currentLanguage) 
                })}</span>
              )}
            </p>
          </div>

          {/* Transactions Table - REUSING EXACT SAME COMPONENT */}
          <div className="transactions-table-section">
            <RecentExpensesTable
              expenses={expenses}
              loading={loading}
              onExpenseClick={handleExpenseClick}
              onRetry={loadExpenses}
            />
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button 
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="pagination-btn"
              >
                {t('transactions.previous')}
              </button>
              
              <span className="pagination-info">
                {t('transactions.pageInfo', { current: pagination.page, total: pagination.pages })}
              </span>
              
              <button 
                disabled={pagination.page >= pagination.pages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="pagination-btn"
              >
                {t('transactions.next')}
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Edit Expense Modal - REUSING EXISTING COMPONENT */}
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
    </div>
  );
};

export default AllTransactions;