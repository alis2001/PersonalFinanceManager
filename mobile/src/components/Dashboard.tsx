import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../services/AuthContext';
import expenseService, { ExpenseStats } from '../services/expenseService';
import currencyService from '../services/currencyService';
import BottomNavigation from './BottomNavigation';
import { useTranslation } from '../hooks/useTranslation';
import { formatDateForDisplay } from '../utils/dateFormatter';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultCurrency: string;
}

interface DashboardProps {
  navigation?: any;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
  onSettings?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ navigation, activeRoute = 'Dashboard', onNavigate, onAddExpense, onSettings }) => {
  const { user, logout } = useAuth();
  const { t, currentLanguage } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<ExpenseStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<ExpenseStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<ExpenseStats | null>(null);

  useEffect(() => {
    loadUserStats();
  }, []);


  const loadUserStats = async () => {
    setStatsLoading(true);
    try {
      // Load all three stat types in parallel
      const [weeklyResult, monthlyResult, yearlyResult] = await Promise.all([
        expenseService.getExpenseStats('weekly'),
        expenseService.getExpenseStats('monthly'),
        expenseService.getExpenseStats('yearly'),
      ]);

      if (weeklyResult.success && weeklyResult.stats) {
        console.log('Weekly stats received:', weeklyResult.stats);
        setWeeklyStats(weeklyResult.stats);
      } else {
        console.log('Weekly stats failed or empty:', weeklyResult);
      }
      if (monthlyResult.success && monthlyResult.stats) {
        setMonthlyStats(monthlyResult.stats);
      }
      if (yearlyResult.success && yearlyResult.stats) {
        setYearlyStats(yearlyResult.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert(t('common.error'), t('dashboard.failedToLoadData'));
    } finally {
      setStatsLoading(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(t('common.error'), t('auth.logoutError'));
    }
  };

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };


  const formatCurrency = (amount: number): string => {
    return currencyService.formatCurrency(amount, user?.defaultCurrency || 'USD', currentLanguage);
  };

  const getStatCardClass = (loading: boolean) => {
    return loading ? styles.statCardLoading : styles.statCard;
  };

  const StatCard: React.FC<{
    icon: string;
    title: string;
    value: string;
    label: string;
    loading: boolean;
  }> = ({ icon, title, value, label, loading }) => {
    const scaleValue = new Animated.Value(1);

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    };

    return (
      <Animated.View style={[getStatCardClass(loading), { transform: [{ scale: scaleValue }] }]}>
        <TouchableOpacity
          style={styles.statCardTouchable}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          disabled={true}
        >
          <View style={styles.statIcon}>
            <Text style={styles.statIconText}>{icon}</Text>
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statTitle}>{title}</Text>
            <View style={styles.statValueContainer}>
              {loading ? (
                <Text style={styles.statValue}>...</Text>
              ) : (
                <>
                  <Text style={styles.statCurrencySymbol}>
                    {currencyService.getCurrencySymbol(user?.defaultCurrency || 'USD')}
                  </Text>
                  <Text style={styles.statValue}>
                    {value.replace(currencyService.getCurrencySymbol(user?.defaultCurrency || 'USD'), '')}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Rapilot</Text>
          </View>
          <TouchableOpacity style={styles.menuButton} onPress={onSettings}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {/* Stats Grid - Three rows as requested */}
        <View style={styles.statsContainer}>
          {/* Weekly Expenses Card */}
          <StatCard
            icon="📅"
            title={t('dashboard.weeklyExpenses')}
            value={formatCurrency(weeklyStats?.total || 0)}
            label={`${weeklyStats?.transactionCount || 0} ${t('dashboard.transactions')}`}
            loading={statsLoading}
          />

          {/* Monthly Expenses Card */}
          <StatCard
            icon="📊"
            title={t('dashboard.monthlyExpenses')}
            value={formatCurrency(monthlyStats?.total || 0)}
            label={`${monthlyStats?.transactionCount || 0} ${t('dashboard.transactions')}`}
            loading={statsLoading}
          />

          {/* Yearly Expenses Card */}
          <StatCard
            icon="📈"
            title={t('dashboard.yearlyExpenses')}
            value={formatCurrency(yearlyStats?.total || 0)}
            label={`${yearlyStats?.transactionCount || 0} ${t('dashboard.transactions')}`}
            loading={statsLoading}
          />
        </View>
      </ScrollView>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '400',
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
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    paddingHorizontal: 20,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '300',
    fontFamily: '-apple-system',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  menuLine: {
    width: 24,
    height: 2,
    backgroundColor: '#1a1a1a',
    borderRadius: 1,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    padding: 20,
    paddingBottom: 20, // Minimal space for bottom navigation
  },
  statsContainer: {
    gap: 20,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 35,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardLoading: {
    backgroundColor: '#ffffff',
    padding: 35,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.7,
  },
  statCardTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 25,
  },
  statIconText: {
    fontSize: 28,
    color: '#1a1a1a',
  },
  statInfo: {
    flex: 1,
  },
  statTitle: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  statCurrencySymbol: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '300',
    marginRight: 4,
    fontFamily: '-apple-system',
  },
  statValue: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '300',
    fontFamily: '-apple-system',
  },
  statLabel: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '400',
  },
});

export default Dashboard;