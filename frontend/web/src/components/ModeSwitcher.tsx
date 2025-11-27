import React from 'react';
import { useMode } from '../contexts/ModeContext';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/ModeSwitcher.css';

interface ModeSwitcherProps {
  compact?: boolean;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ compact = false }) => {
  const { mode, setMode, isExpenseMode, isIncomeMode } = useMode();
  const { t } = useTranslation();

  return (
    <div className={`mode-switcher ${compact ? 'compact' : ''}`}>
      <button
        className={`mode-button ${isExpenseMode ? 'active expense' : ''}`}
        onClick={() => setMode('expense')}
        aria-pressed={isExpenseMode}
        aria-label={t('dashboard.switchToExpenseMode') || 'Switch to Expense Mode'}
        title={t('dashboard.switchToExpenseMode') || 'Switch to Expense Mode'}
      >
        <span className="mode-icon">💸</span>
        {!compact && <span className="mode-label">{t('dashboard.expenses')}</span>}
      </button>
      
      <button
        className={`mode-button ${isIncomeMode ? 'active income' : ''}`}
        onClick={() => setMode('income')}
        aria-pressed={isIncomeMode}
        aria-label={t('dashboard.switchToIncomeMode') || 'Switch to Income Mode'}
        title={t('dashboard.switchToIncomeMode') || 'Switch to Income Mode'}
      >
        <span className="mode-icon">💰</span>
        {!compact && <span className="mode-label">{t('dashboard.income')}</span>}
      </button>
    </div>
  );
};

export default ModeSwitcher;

