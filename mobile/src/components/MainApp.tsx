import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import AllTransactions from './AllTransactions';
import Categories from './Categories';
import AddExpense from './AddExpense';
import Settings from './Settings';
import { useAuth } from '../services/AuthContext';

const MainApp: React.FC = () => {
  const { user } = useAuth();
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
    // Refresh data in all components that might need it
    setShowAddExpense(false);
    // The individual components will handle their own data refresh
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  const handleBackFromSettings = () => {
    setShowSettings(false);
  };

  const renderActiveScreen = () => {
    console.log('Rendering screen for route:', activeRoute);
    
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
        console.log('Rendering Dashboard component');
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
