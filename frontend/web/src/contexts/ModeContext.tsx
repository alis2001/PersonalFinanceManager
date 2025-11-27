import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TransactionMode = 'expense' | 'income';

interface ModeContextType {
  mode: TransactionMode;
  setMode: (mode: TransactionMode) => void;
  toggleMode: () => void;
  isExpenseMode: boolean;
  isIncomeMode: boolean;
  getModeLabel: () => string;
  getModeColor: () => string;
  getModeIcon: () => string;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

interface ModeProviderProps {
  children: ReactNode;
}

export const ModeProvider: React.FC<ModeProviderProps> = ({ children }) => {
  // Default to 'expense' mode, but check localStorage first
  const [mode, setModeState] = useState<TransactionMode>(() => {
    const savedMode = localStorage.getItem('transactionMode');
    return (savedMode === 'income' ? 'income' : 'expense') as TransactionMode;
  });

  // Persist mode changes to localStorage
  const setMode = (newMode: TransactionMode) => {
    setModeState(newMode);
    localStorage.setItem('transactionMode', newMode);
    
    // Log mode change for debugging
    console.log(`🔄 Transaction mode switched to: ${newMode}`);
  };

  const toggleMode = () => {
    setMode(mode === 'expense' ? 'income' : 'expense');
  };

  const getModeLabel = (): string => {
    return mode === 'expense' ? 'Expenses' : 'Income';
  };

  const getModeColor = (): string => {
    return mode === 'expense' ? '#ef4444' : '#22c55e'; // red for expense, green for income
  };

  const getModeIcon = (): string => {
    return mode === 'expense' ? '💸' : '💰';
  };

  const value: ModeContextType = {
    mode,
    setMode,
    toggleMode,
    isExpenseMode: mode === 'expense',
    isIncomeMode: mode === 'income',
    getModeLabel,
    getModeColor,
    getModeIcon,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

// Custom hook for easy access
export const useMode = (): ModeContextType => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within ModeProvider');
  }
  return context;
};

