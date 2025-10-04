import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import AllTransactions from './AllTransactions';
import Categories from './Categories';
import AddExpense from './AddExpense';

const MainApp: React.FC = () => {
  const [activeRoute, setActiveRoute] = useState('Dashboard');
  const [showAddExpense, setShowAddExpense] = useState(false);

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

  const renderActiveScreen = () => {
    console.log('Rendering screen for route:', activeRoute);
    
    switch (activeRoute) {
      case 'Analytics':
        return (
          <Analytics 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
          />
        );
      case 'Transactions':
        return (
          <AllTransactions 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
          />
        );
      case 'Categories':
        return (
          <Categories 
            activeRoute={activeRoute}
            onNavigate={handleNavigate}
            onAddExpense={handleAddExpense}
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
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderActiveScreen()}
      
      {/* Add Expense Modal */}
      <AddExpense
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onExpenseAdded={handleExpenseAdded}
        userCurrency="USD"
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
