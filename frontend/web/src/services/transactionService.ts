import expenseService, { Expense, ExpenseStats, CreateExpenseData, UpdateExpenseData } from './expenseService';
import incomeService, { Income, IncomeStats, CreateIncomeData, UpdateIncomeData } from './incomeService';
import { TransactionMode } from '../contexts/ModeContext';

// Unified transaction type (union of Expense and Income)
export type Transaction = Expense | Income;
export type TransactionStats = ExpenseStats | IncomeStats;
export type CreateTransactionData = CreateExpenseData | CreateIncomeData;
export type UpdateTransactionData = UpdateExpenseData | UpdateIncomeData;

interface TransactionResponse {
  success: boolean;
  transaction?: Transaction;
  transactions?: Transaction[];
  stats?: TransactionStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
  message?: string;
}

class TransactionService {
  /**
   * Get transaction statistics for current mode
   */
  async getStats(
    mode: TransactionMode,
    period: 'weekly' | 'monthly' | 'yearly' = 'monthly'
  ): Promise<TransactionResponse> {
    if (mode === 'expense') {
      return await expenseService.getExpenseStats(period);
    } else {
      return await incomeService.getIncomeStats(period);
    }
  }

  /**
   * Get transactions list for current mode
   */
  async getTransactions(
    mode: TransactionMode,
    params: {
      page?: number;
      limit?: number;
      categoryId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<TransactionResponse> {
    if (mode === 'expense') {
      const result = await expenseService.getExpenses(params);
      return {
        ...result,
        transactions: result.expenses as Transaction[]
      };
    } else {
      const result = await incomeService.getIncome(params);
      return {
        ...result,
        transactions: result.incomes as Transaction[]
      };
    }
  }

  /**
   * Get single transaction by ID
   */
  async getTransaction(mode: TransactionMode, id: string): Promise<TransactionResponse> {
    if (mode === 'expense') {
      const result = await expenseService.getExpense(id);
      return {
        ...result,
        transaction: result.expense as Transaction
      };
    } else {
      const result = await incomeService.getIncomeById(id);
      return {
        ...result,
        transaction: result.income as Transaction
      };
    }
  }

  /**
   * Create new transaction
   */
  async createTransaction(
    mode: TransactionMode,
    data: CreateTransactionData
  ): Promise<TransactionResponse> {
    if (mode === 'expense') {
      const result = await expenseService.createExpense(data as CreateExpenseData);
      return {
        ...result,
        transaction: result.expense as Transaction
      };
    } else {
      const result = await incomeService.createIncome(data as CreateIncomeData);
      return {
        ...result,
        transaction: result.income as Transaction
      };
    }
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    mode: TransactionMode,
    id: string,
    data: UpdateTransactionData
  ): Promise<TransactionResponse> {
    if (mode === 'expense') {
      const result = await expenseService.updateExpense(id, data as UpdateExpenseData);
      return {
        ...result,
        transaction: result.expense as Transaction
      };
    } else {
      const result = await incomeService.updateIncome(id, data as UpdateIncomeData);
      return {
        ...result,
        transaction: result.income as Transaction
      };
    }
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(mode: TransactionMode, id: string): Promise<TransactionResponse> {
    if (mode === 'expense') {
      return await expenseService.deleteExpense(id);
    } else {
      return await incomeService.deleteIncome(id);
    }
  }

  /**
   * Get mode-specific label
   */
  getModeLabel(mode: TransactionMode): string {
    return mode === 'expense' ? 'Expense' : 'Income';
  }

  /**
   * Get mode-specific color theme
   */
  getModeColor(mode: TransactionMode): string {
    return mode === 'expense' ? '#ef4444' : '#22c55e'; // red for expense, green for income
  }

  /**
   * Get mode-specific icon
   */
  getModeIcon(mode: TransactionMode): string {
    return mode === 'expense' ? '💸' : '💰';
  }

  /**
   * Format date time for input field
   */
  formatDateTimeForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Parse date time from input field
   */
  parseDateTimeFromInput(dateTimeString: string): Date {
    return new Date(dateTimeString);
  }
}

export default new TransactionService();

