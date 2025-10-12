// Expense Service for Mobile
// Handles expense-related API calls

import Constants from 'expo-constants';

export interface Expense {
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
  userDate?: string;  // User's local date (YYYY-MM-DD) - timezone-independent
  userTime?: string;  // User's local time (HH:MM:SS) - timezone-independent
  location?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseStats {
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

export interface CreateExpenseData {
  categoryId: string;
  amount: number;
  description?: string;
  transactionDate: string;
  userDate?: string;  // User's local date (YYYY-MM-DD) - timezone-independent
  userTime?: string;  // User's local time (HH:MM:SS) - timezone-independent
  location?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateExpenseData extends Partial<CreateExpenseData> {}

export interface ExpenseResponse {
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
  private baseURL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.123:8080/api';
  private expenseURL = `${this.baseURL}/expenses`;

  private async getAuthHeaders(): Promise<HeadersInit> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const token = await AsyncStorage.getItem('accessToken');
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.expenseURL}${endpoint}`;
    
    console.log('Expense service making request to:', url);
    
    try {
      const headers = await this.getAuthHeaders();
      console.log('Expense service headers:', headers);
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('Expense service response status:', response.status);
      return response;
    } catch (error) {
      console.error('Expense service network error:', error);
      throw new Error('Network error occurred');
    }
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      console.log('Expense service error response:', response.status);
      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          throw new Error('Token refreshed, retry request');
        } else {
          throw new Error('Authentication failed');
        }
      }
      const errorData = await response.json().catch(() => ({}));
      console.log('Expense service error data:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Expense service response data:', data);
    return data;
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          await AsyncStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }

    return false;
  }

  async getExpenseStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<ExpenseResponse> {
    try {
      const response = await this.makeRequest(`/stats?period=${period}`, {
        method: 'GET',
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
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ExpenseResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/expenses${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await this.makeRequest(endpoint, {
        method: 'GET',
      });

      const data = await this.handleResponse(response);
      return { success: true, expenses: data.expenses, pagination: data.pagination };
    } catch (error: any) {
      console.error('Get expenses error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getExpenses(params);
      }
      return { success: false, error: error.message };
    }
  }

  async createExpense(expenseData: CreateExpenseData): Promise<ExpenseResponse> {
    try {
      const response = await this.makeRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData),
      });

      const data = await this.handleResponse(response);
      return { success: true, expense: data };
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
      const response = await this.makeRequest(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(expenseData),
      });

      const data = await this.handleResponse(response);
      return { success: true, expense: data };
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
      const response = await this.makeRequest(`/expenses/${id}`, {
        method: 'DELETE',
      });

      await this.handleResponse(response);
      return { success: true };
    } catch (error: any) {
      console.error('Delete expense error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteExpense(id);
      }
      return { success: false, error: error.message };
    }
  }
}

const expenseService = new ExpenseService();
export default expenseService;
