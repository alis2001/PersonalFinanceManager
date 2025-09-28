interface Expense {
  id: string;
  categoryId: string;
  category: {
    name: string;
    color: string;
    icon: string;
  };
  amount: number;
  description?: string;
  transactionDate: string;
  location?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseStats {
  period: string;
  total: number;
  transactionCount: number;
  topCategories: Array<{
    name: string;
    color: string;
    icon: string;
    amount: number;
  }>;
}

interface CreateExpenseData {
  categoryId: string;
  amount: number;
  description?: string;
  transactionDate: string;
  location?: string;
  tags?: string[];
  notes?: string;
}

interface UpdateExpenseData extends Partial<CreateExpenseData> {}

interface ExpenseResponse {
  success: boolean;
  expense?: Expense;
  expenses?: Expense[];
  stats?: ExpenseStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
  message?: string;
}

class ExpenseService {
  private baseURL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';
  private expenseURL = `${this.baseURL}/api/expenses`;

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        const refreshSuccess = await this.refreshToken();
        if (!refreshSuccess) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          throw new Error('Authentication required');
        }
        throw new Error('Token refreshed, retry request');
      }
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tokens) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  async getExpenseStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<ExpenseResponse> {
    try {
      const response = await fetch(`${this.expenseURL}/stats?period=${period}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, stats: data };
    } catch (error: any) {
      console.error('Get expense stats error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getExpenseStats(period);
      }
      return { success: false, error: error.message };
    }
  }

  async getExpenses(params: {
    page?: number;
    limit?: number;
    categoryId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;  // NEW: Add search parameter
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ExpenseResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.expenseURL}/expenses${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        expenses: data.expenses,
        pagination: data.pagination
      };
    } catch (error: any) {
      console.error('Get expenses error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getExpenses(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getExpense(id: string): Promise<ExpenseResponse> {
    try {
      const response = await fetch(`${this.expenseURL}/expenses/${id}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, expense: data.expense };
    } catch (error: any) {
      console.error('Get expense error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getExpense(id);
      }
      return { success: false, error: error.message };
    }
  }

  async createExpense(expenseData: CreateExpenseData): Promise<ExpenseResponse> {
    try {
      const response = await fetch(`${this.expenseURL}/expenses`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(expenseData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        expense: data.expense,
        message: data.message
      };
    } catch (error: any) {
      console.error('Create expense error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.createExpense(expenseData);
      }
      return { success: false, error: error.message };
    }
  }

  async updateExpense(id: string, expenseData: UpdateExpenseData): Promise<ExpenseResponse> {
    try {
      const response = await fetch(`${this.expenseURL}/expenses/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(expenseData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        expense: data.expense,
        message: data.message
      };
    } catch (error: any) {
      console.error('Update expense error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.updateExpense(id, expenseData);
      }
      return { success: false, error: error.message };
    }
  }

  async deleteExpense(id: string): Promise<ExpenseResponse> {
    try {
      const response = await fetch(`${this.expenseURL}/expenses/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true,
        message: data.message
      };
    } catch (error: any) {
      console.error('Delete expense error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteExpense(id);
      }
      return { success: false, error: error.message };
    }
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  formatDate(date: string, language: string = 'en'): string {
    // This function is deprecated - use dateConversionService.formatDateShort instead
    // Keeping for backward compatibility
    const d = new Date(date);
    if (language === 'fa') {
      // For Persian, we would need moment-jalaali, but this service doesn't have it
      // Return basic format for now
      return d.toLocaleDateString('fa-IR');
    }
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTimeForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  parseDateTimeFromInput(dateTimeString: string): Date {
    return new Date(dateTimeString);
  }
}

export default new ExpenseService();
export type { Expense, ExpenseStats, CreateExpenseData, UpdateExpenseData };