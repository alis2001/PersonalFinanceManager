interface Income {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
    parent_id?: string;
    level?: number;
    path?: string;
    path_ids?: string[];
  };
  amount: number;
  description: string; // Required for income
  transactionDate: string;
  userDate?: string;  // User's local date (YYYY-MM-DD)
  userTime?: string;  // User's local time (HH:MM:SS)
  frequency: 'one_time' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  isRecurring: boolean;
  nextExpectedDate?: string | null;
  source?: string; // Like 'location' for expenses, but 'source' for income
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface IncomeStats {
  period: string;
  total: number;
  transactionCount: number;
  topCategories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    parent_id?: string;
    level?: number;
    path?: string;
    path_ids?: string[];
    amount: number;
  }>;
}

interface CreateIncomeData {
  categoryId: string;
  amount: number;
  description: string; // REQUIRED for income (NOT NULL in DB)
  transactionDate: string;
  userDate: string;  // Required
  userTime: string;  // Required
  frequency?: 'one_time' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  isRecurring?: boolean;
  nextExpectedDate?: string | null;
  source?: string;
  tags?: string[];
  notes?: string;
}

interface UpdateIncomeData extends Partial<CreateIncomeData> {}

interface IncomeResponse {
  success: boolean;
  income?: Income;
  incomes?: Income[];
  stats?: IncomeStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
  message?: string;
}

class IncomeService {
  private baseURL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';
  private incomeURL = `${this.baseURL}/api/income`;

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

  async getIncomeStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<IncomeResponse> {
    try {
      const response = await fetch(`${this.incomeURL}/stats?period=${period}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, stats: data };
    } catch (error: any) {
      console.error('Get income stats error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getIncomeStats(period);
      }
      return { success: false, error: error.message };
    }
  }

  async getIncome(params: {
    page?: number;
    limit?: number;
    categoryId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<IncomeResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.incomeURL}/income${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        incomes: data.income, // Backend returns "income" array
        pagination: data.pagination
      };
    } catch (error: any) {
      console.error('Get income error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getIncome(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getIncomeById(id: string): Promise<IncomeResponse> {
    try {
      const response = await fetch(`${this.incomeURL}/income/${id}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, income: data.income };
    } catch (error: any) {
      console.error('Get income error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getIncomeById(id);
      }
      return { success: false, error: error.message };
    }
  }

  async createIncome(incomeData: CreateIncomeData): Promise<IncomeResponse> {
    try {
      const response = await fetch(`${this.incomeURL}/income`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(incomeData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        income: data.income,
        message: data.message
      };
    } catch (error: any) {
      console.error('Create income error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.createIncome(incomeData);
      }
      return { success: false, error: error.message };
    }
  }

  async updateIncome(id: string, incomeData: UpdateIncomeData): Promise<IncomeResponse> {
    try {
      const response = await fetch(`${this.incomeURL}/income/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(incomeData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        income: data.income,
        message: data.message
      };
    } catch (error: any) {
      console.error('Update income error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.updateIncome(id, incomeData);
      }
      return { success: false, error: error.message };
    }
  }

  async deleteIncome(id: string): Promise<IncomeResponse> {
    try {
      const response = await fetch(`${this.incomeURL}/income/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true,
        message: data.message
      };
    } catch (error: any) {
      console.error('Delete income error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteIncome(id);
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

export default new IncomeService();
export type { Income, IncomeStats, CreateIncomeData, UpdateIncomeData };

