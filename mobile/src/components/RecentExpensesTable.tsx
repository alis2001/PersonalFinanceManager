import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform, RefreshControl } from 'react-native';
import { Expense } from '../services/expenseService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
import { formatDateForDisplay } from '../utils/dateFormatter';

interface RecentExpensesTableProps {
  expenses: Expense[];
  loading: boolean;
  onExpenseClick: (expense: Expense) => void;
  onRetry?: () => void;
  userCurrency?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const RecentExpensesTable: React.FC<RecentExpensesTableProps> = ({
  expenses,
  loading,
  onExpenseClick,
  onRetry,
  userCurrency = 'USD',
  refreshing = false,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [formattedDates, setFormattedDates] = useState<{[key: string]: string}>({});
  
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
  const formatCurrency = (amount: number): string => {
    return currencyService.formatCurrency(amount, userCurrency);
  };

  // Format dates when expenses change
  useEffect(() => {
    const formatAllDates = async () => {
      const newFormattedDates: {[key: string]: string} = {};
      for (const expense of expenses) {
        const date = new Date(expense.date);
        newFormattedDates[expense.id] = await formatDateForDisplay(date, false);
      }
      setFormattedDates(newFormattedDates);
    };
    formatAllDates();
  }, [expenses]);

  const formatDate = (dateString: string): string => {
    // For now, return a simple fallback while async formatting loads
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const truncateText = (text: string | undefined, maxLength: number): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      style={styles.expenseItem}
      onPress={() => onExpenseClick(item)}
      activeOpacity={0.7}
    >
      <View style={styles.expenseContent}>
        <View style={styles.expenseLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: item.category.color + '20' }]}>
            <Text style={styles.iconText}>{item.category.icon}</Text>
          </View>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseDescription} numberOfLines={1}>
              {truncateText(item.description, 30) || '—'}
            </Text>
            <Text style={styles.expenseCategory}>
              {getTranslatedCategoryName(item.category.name)}
            </Text>
          </View>
        </View>
        
        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.expenseDate}>
            {formattedDates[item.id] || formatDate(item.transactionDate)}
          </Text>
          <Text style={styles.expenseTime}>
            {formatTime(item.transactionDate)}
          </Text>
        </View>
      </View>
      
      {item.location && (
        <View style={styles.expenseFooter}>
          <Text style={styles.expenseLocation}>
            📍 {truncateText(item.location, 40)}
          </Text>
        </View>
      )}
      
      {item.notes && (
        <View style={styles.expenseFooter}>
          <Text style={styles.expenseNotes}>
            📝 {truncateText(item.notes, 50)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No transactions found</Text>
      <Text style={styles.emptyText}>
        No transactions match your current filters. Try adjusting your search criteria.
      </Text>
      {onRetry && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <Text style={styles.loadingText}>Loading transactions...</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderLoadingState()}
      </View>
    );
  }

  if (expenses.length === 0) {
    return (
      <View style={styles.container}>
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40, // Minimal space for bottom navigation
    paddingHorizontal: 16,
  },
  expenseItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  expenseContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 20,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 2,
  },
  expenseTime: {
    fontSize: 11,
    color: '#999999',
  },
  expenseFooter: {
    marginTop: 8,
    paddingLeft: 52, // Align with text content
  },
  expenseLocation: {
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
  },
  expenseNotes: {
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#f8f9fa',
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    minHeight: 300,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
});

export default RecentExpensesTable;
