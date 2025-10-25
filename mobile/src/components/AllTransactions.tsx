import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import ProfessionalDatePicker from './ProfessionalDatePicker';
import BottomNavigation from './BottomNavigation';
import RecentExpensesTable from './RecentExpensesTable';
import EditExpense from './EditExpense';
import CategoryTreeSelector from './CategoryTreeSelector';
import { Expense } from '../services/expenseService';
import { Category } from '../services/categoryService';
import expenseService from '../services/expenseService';
import categoryService from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../services/AuthContext';
import { useAppRefresh } from '../services/AppRefreshContext';

interface AllTransactionsProps {
  navigation?: any;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
  onSettings?: () => void;
}

const AllTransactions: React.FC<AllTransactionsProps> = ({ 
  navigation, 
  activeRoute = 'Transactions', 
  onNavigate,
  onAddExpense,
  onSettings
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refreshTrigger } = useAppRefresh();
  
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

  // Function to translate category types
  const getTranslatedCategoryType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'expense': t('categories.expense'),
      'income': t('categories.income'),
      'both': t('categories.both'),
    };
    return typeMap[type] || type;
  };

  // Function to get hierarchical category path
  const getCategoryHierarchicalPath = (category: any): string => {
    if (category.path && category.path !== category.name) {
      // If we have a path that's different from name, use it
      return category.path.split('/').map((part: string) => getTranslatedCategoryName(part)).join(' → ');
    } else {
      // Fallback to just the translated name
      return getTranslatedCategoryName(category.name);
    }
  };

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeDateField, setActiveDateField] = useState<'dateFrom' | 'dateTo' | null>(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20, // Show 20 latest expenses by default
    total: 0,
    pages: 0
  });
  
  // Load more state
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: '',
    search: ''
  });


  useEffect(() => {
    loadCategories();
    // Don't set default date filters - load all expenses by default
  }, []);

  useEffect(() => {
    // Only load transactions when filters change or on initial load
    // Load more is handled separately
    if (pagination.page === 1) {
      loadTransactions();
    }
  }, [filters]);

  // Listen for refresh triggers
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 AllTransactions: Refresh triggered, reloading transactions');
      // Reset pagination and reload transactions
      setPagination(prev => ({ ...prev, page: 1 }));
      setHasMoreExpenses(true);
      loadTransactions();
    }
  }, [refreshTrigger]);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Date picker handlers
  const openDatePicker = (field: 'dateFrom' | 'dateTo') => {
    setActiveDateField(field);
    
    // If there's already a date, use it; otherwise use current date
    const existingDate = field === 'dateFrom' ? filters.dateFrom : filters.dateTo;
    if (existingDate) {
      setSelectedDate(new Date(existingDate));
    } else {
      setSelectedDate(new Date());
    }
    
    setShowDatePicker(true);
  };

  const handleDateConfirm = (date: Date) => {
    if (activeDateField) {
      setSelectedDate(date);
      const formattedDate = formatDateForInput(date);
      handleFilterChange(activeDateField, formattedDate);
    }
    setShowDatePicker(false);
    setActiveDateField(null);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
    setActiveDateField(null);
  };


  const loadCategories = async () => {
    try {
      const result = await categoryService.getCategories({ 
        type: 'expense', 
        active: true,
        includeChildren: true // Load hierarchical structure
      });
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadTransactions = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      setError(null);
      console.log('Loading transactions with filters:', filters);
      console.log('Loading transactions with pagination:', pagination);
      
      // Debug: Check what date range would be if we had filters
      if (filters.dateFrom && filters.dateTo) {
        console.log('Date filter active - from:', filters.dateFrom, 'to:', filters.dateTo);
      } else {
        console.log('Loading recent expenses (latest first)');
      }
      
      const result = await expenseService.getExpenses({
        page: pagination.page,
        limit: pagination.limit,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        categoryId: filters.categoryId || undefined,
        search: filters.search || undefined,
        sortBy: 'created_at', // Sort by creation date for recent expenses
        sortOrder: 'desc'
      });

      console.log('Expense service result:', result);
      console.log('Expenses found:', result.expenses?.length || 0);
      console.log('Expenses data:', result.expenses);

      if (result.success) {
        if (isLoadMore) {
          // Append new expenses to existing ones
          setExpenses(prev => [...prev, ...(result.expenses || [])]);
        } else {
          // Replace expenses (initial load or filter change)
          setExpenses(result.expenses || []);
        }
        
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            total: result.pagination!.total,
            pages: result.pagination!.pages
          }));
          
          // Check if there are more expenses to load
          const currentTotal = isLoadMore ? expenses.length + (result.expenses?.length || 0) : (result.expenses?.length || 0);
          setHasMoreExpenses(currentTotal < result.pagination!.total);
        }
      } else {
        console.log('Failed to load transactions:', result.error);
        setError(result.error || 'Failed to load transactions');
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
      setError('Failed to load transactions');
    }
    
    if (isLoadMore) {
      setLoadingMore(false);
    } else {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
    setHasMoreExpenses(true); // Reset load more state
  };

  const handleClearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      categoryId: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setHasMoreExpenses(true); // Reset load more state
  };

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const handleEditExpenseSuccess = () => {
    loadTransactions();
  };

  const handleLoadMore = async () => {
    if (!hasMoreExpenses || loadingMore) return;
    
    setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    await loadTransactions(true); // Load more expenses
  };

  const handleRetry = () => {
    setLoading(true);
    loadTransactions();
  };

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };

  const renderFilters = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('transactions.filterTransactions')}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowFilters(false)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
          <View style={styles.filterGroup}>
            <Text style={styles.label}>{t('transactions.fromDate')}</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => openDatePicker('dateFrom')}
            >
              <View style={styles.datePickerButtonContent}>
                <View style={styles.datePickerTextContainer}>
                  <Text style={styles.datePickerDateText}>
                    {filters.dateFrom ? formatDateForInput(new Date(filters.dateFrom)) : t('transactions.fromDate')}
                  </Text>
                </View>
                <View style={styles.datePickerIcon}>
                  <Text style={styles.datePickerIconText}>📅</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.label}>{t('transactions.toDate')}</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => openDatePicker('dateTo')}
            >
              <View style={styles.datePickerButtonContent}>
                <View style={styles.datePickerTextContainer}>
                  <Text style={styles.datePickerDateText}>
                    {filters.dateTo ? formatDateForInput(new Date(filters.dateTo)) : t('transactions.toDate')}
                  </Text>
                </View>
                <View style={styles.datePickerIcon}>
                  <Text style={styles.datePickerIconText}>📅</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.label}>{t('expenses.category')}</Text>
            <CategoryTreeSelector
              categories={categories}
              selectedCategoryId={filters.categoryId}
              onCategorySelect={(categoryId) => handleFilterChange('categoryId', categoryId)}
              placeholder={t('transactions.allCategories')}
              type="expense"
              allowEmpty={true}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.label}>{t('transactions.search')}</Text>
            <TextInput
              style={styles.input}
              value={filters.search}
              onChangeText={(value) => handleFilterChange('search', value)}
              placeholder={t('transactions.searchPlaceholder')}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearButtonText}>{t('transactions.clearFilters')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.applyButton]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>{t('common.apply')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      
      {/* Professional Date Picker */}
      <ProfessionalDatePicker
        visible={showDatePicker}
        mode="date"
        value={selectedDate}
        onConfirm={handleDateConfirm}
        onCancel={handleDateCancel}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date()}
      />
    </Modal>
  );

  const renderLoadMore = () => {
    if (!hasMoreExpenses) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <TouchableOpacity
          style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
          onPress={handleLoadMore}
          disabled={loadingMore}
        >
          <Text style={styles.loadMoreButtonText}>
            {loadingMore ? t('common.loading') : t('transactions.loadMore')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.loadMoreInfo}>
          {t('transactions.showingResults', { showing: expenses.length, total: pagination.total })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('transactions.allTransactions')}</Text>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Text style={styles.filterButtonText}>🔍 {t('common.filter')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {t('transactions.showingResults', { showing: expenses.length, total: pagination.total })}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>{t('transactions.errorLoadingTransactions')}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scrollView}>
            <RecentExpensesTable
              expenses={expenses}
              loading={loading}
              onExpenseClick={handleExpenseClick}
              onRetry={handleRetry}
              userCurrency={user?.defaultCurrency || 'USD'}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              categories={categories}
            />
            
            {renderLoadMore()}
          </View>
        )}
      </View>

      {/* Filter Modal */}
      {renderFilters()}

      {/* Edit Expense Modal */}
      {selectedExpense && (
        <EditExpense 
          isOpen={showEditExpense}
          expense={selectedExpense}
          onClose={() => {
            setShowEditExpense(false);
            setSelectedExpense(null);
          }}
          onExpenseUpdated={handleEditExpenseSuccess}
          userCurrency={user?.defaultCurrency || 'USD'}
        />
      )}

      {/* Bottom Navigation */}
        <BottomNavigation 
          activeRoute={activeRoute} 
          onNavigate={handleNavigate}
          onAddExpense={onAddExpense}
          onSettings={onSettings}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  filterButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  filterButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '400',
  },
  content: {
    flex: 1,
    paddingBottom: 20, // Minimal space for bottom navigation
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  filterGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  
  // Date Picker Styles
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginTop: 8,
    overflow: 'hidden',
  },
  datePickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  datePickerTextContainer: {
    flex: 1,
  },
  datePickerDateText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  datePickerIcon: {
    marginLeft: 12,
  },
  datePickerIconText: {
    fontSize: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#1a1a1a',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
    marginBottom: 100,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  clearButton: {
    backgroundColor: '#f7fafc',
    borderColor: '#e2e8f0',
  },
  clearButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Load More styles
  loadMoreContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 10,
  },
  loadMoreButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  loadMoreButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  loadMoreInfo: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
});

export default AllTransactions;
