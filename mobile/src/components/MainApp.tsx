import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import AllTransactions from './AllTransactions';
import Categories from './Categories';
import AddExpense from './AddExpense';
import Settings from './Settings';
import { useAuth } from '../services/AuthContext';
import { useAppRefresh } from '../services/AppRefreshContext';
import { logger } from '../services/Logger';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const { triggerRefresh } = useAppRefresh();
  const [activeRoute, setActiveRoute] = useState('Dashboard');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleNavigate = (route: string) => {
    setActiveRoute(route);
  };

  const handleAddExpense = () => {
    setShowAddExpense(true);
  };

  const handleExpenseAdded = () => {
    logger.log('✅ Expense added, triggering global refresh');
    // Trigger refresh in all components
    triggerRefresh();
    setShowAddExpense(false);
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  const handleBackFromSettings = () => {
    setShowSettings(false);
  };

  const renderActiveScreen = () => {
    logger.log('Rendering screen for route:', activeRoute);
    
    switch (activeRoute) {
      case 'Analytics':
        return (
          <Analytics 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
            onSettings={handleSettings}
          />
        );
      case 'Transactions':
        return (
          <AllTransactions 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
            onSettings={handleSettings}
          />
        );
      case 'Categories':
        return (
          <Categories 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
            onSettings={handleSettings}
          />
        );
      case 'Dashboard':
      default:
        logger.log('Rendering Dashboard component');
        return (
          <Dashboard 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
            onSettings={handleSettings}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {showSettings ? (
        <Settings onBack={handleBackFromSettings} />
      ) : (
        renderActiveScreen()
      )}
      
      {/* Add Expense Modal */}
      <AddExpense
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
        userCurrency={user?.defaultCurrency || 'USD'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainApp;
