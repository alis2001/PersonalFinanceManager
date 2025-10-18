import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { memoryOptimizer } from '../utils/MemoryOptimizer';

interface AppRefreshContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
  triggerDashboardRefresh: () => void;
  triggerTransactionsRefresh: () => void;
  triggerAnalyticsRefresh: () => void;
  triggerCategoriesRefresh: () => void;
}

const AppRefreshContext = createContext<AppRefreshContextType | undefined>(undefined);

export const useAppRefresh = () => {
  const context = useContext(AppRefreshContext);
  if (!context) {
    throw new Error('useAppRefresh must be used within an AppRefreshProvider');
  }
  return context;
};

interface AppRefreshProviderProps {
  children: React.ReactNode;
}

export const AppRefreshProvider: React.FC<AppRefreshProviderProps> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);
  const [transactionsRefreshTrigger, setTransactionsRefreshTrigger] = useState(0);
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);
  const [categoriesRefreshTrigger, setCategoriesRefreshTrigger] = useState(0);

  // Register cleanup on unmount
  useEffect(() => {
    return () => {
      memoryOptimizer.cleanup();
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    console.log('🔄 Triggering global app refresh');
    setRefreshTrigger(prev => prev + 1);
    setDashboardRefreshTrigger(prev => prev + 1);
    setTransactionsRefreshTrigger(prev => prev + 1);
    setAnalyticsRefreshTrigger(prev => prev + 1);
    setCategoriesRefreshTrigger(prev => prev + 1);
  }, []);

  const triggerDashboardRefresh = useCallback(() => {
    console.log('🔄 Triggering dashboard refresh');
    setDashboardRefreshTrigger(prev => prev + 1);
  }, []);

  const triggerTransactionsRefresh = useCallback(() => {
    console.log('🔄 Triggering transactions refresh');
    setTransactionsRefreshTrigger(prev => prev + 1);
  }, []);

  const triggerAnalyticsRefresh = useCallback(() => {
    console.log('🔄 Triggering analytics refresh');
    setAnalyticsRefreshTrigger(prev => prev + 1);
  }, []);

  const triggerCategoriesRefresh = useCallback(() => {
    console.log('🔄 Triggering categories refresh');
    setCategoriesRefreshTrigger(prev => prev + 1);
  }, []);

  const value: AppRefreshContextType = {
    refreshTrigger,
    triggerRefresh,
    triggerDashboardRefresh,
    triggerTransactionsRefresh,
    triggerAnalyticsRefresh,
    triggerCategoriesRefresh,
  };

  return (
    <AppRefreshContext.Provider value={value}>
      {children}
    </AppRefreshContext.Provider>
  );
};

export default AppRefreshContext;
