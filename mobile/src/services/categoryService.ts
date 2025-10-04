// Category Service for Mobile
// Handles category-related API calls

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryResponse {
  success: boolean;
  categories?: Category[];
  category?: Category;
  total?: number;
  stats?: any;
  error?: string;
  message?: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  is_active?: boolean;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {
  is_active?: boolean;
}

class CategoryService {
  private baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.123:8080/api';
  private categoryURL = `${this.baseURL}/categories`;

  private async getAuthHeaders(): Promise<HeadersInit> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const token = await AsyncStorage.getItem('accessToken');
    
    console.log('Category service token:', token ? 'Token exists' : 'No token');
    
    // Decode token to see user info (for debugging)
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token payload user ID:', payload.userId);
        console.log('Token payload email:', payload.email);
      } catch (e) {
        console.log('Could not decode token payload');
      }
    }
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.categoryURL}${endpoint}`;
    
    console.log('Category service making request to:', url);
    
    try {
      const headers = await this.getAuthHeaders();
      console.log('Category service headers:', headers);
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log('Category service response status:', response.status);
      return response;
    } catch (error) {
      console.error('Category service network error:', error);
      throw new Error('Network error occurred');
    }
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
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
      console.log('Category service error response:', response.status, errorData);
      
      // Handle specific error cases
      if (response.status === 409 && errorData.error) {
        // Category is being used in transactions
        console.log('Category deletion blocked - category is being used in transactions');
        throw new Error(errorData.error);
      }
      
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
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

  async getCategories(params: {
    type?: 'income' | 'expense' | 'both';
    active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<CategoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      // Match web version's parameter handling
      if (params.type) {
        queryParams.append('type', params.type);
      }
      
      if (params.active !== undefined) {
        queryParams.append('active', params.active.toString());
      }

      if (params.page !== undefined) {
        queryParams.append('page', params.page.toString());
      }

      if (params.limit !== undefined) {
        queryParams.append('limit', params.limit.toString());
      }

      const endpoint = `/categories${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await this.makeRequest(endpoint, {
        method: 'GET',
      });

      const data = await this.handleResponse(response);
      console.log('Category service response:', data);
      console.log('Categories found:', data.categories?.length || 0);
      console.log('Categories data:', data.categories);
      return { 
        success: true, 
        categories: data.categories || data, 
        total: data.total 
      };
    } catch (error: any) {
      console.error('Get categories error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getCategories(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getExpenseCategories(): Promise<CategoryResponse> {
    try {
      const result = await this.getCategories({ type: 'expense', active: true });
      
      if (result.success && result.categories && result.categories.length === 0) {
        await this.createDefaultCategories();
        return this.getCategories({ type: 'expense', active: true });
      }
      
      return result;
    } catch (error: any) {
      console.error('Get expense categories error:', error);
      return { success: false, error: error.message };
    }
  }

  async getIncomeCategories(): Promise<CategoryResponse> {
    return this.getCategories({ type: 'income', active: true });
  }

  async createDefaultCategories(): Promise<void> {
    const defaultExpenseCategories = [
      { name: 'Food & Dining', description: 'Restaurants, groceries, food delivery', color: '#FF6B35', icon: '🍽️', type: 'expense' as const },
      { name: 'Transportation', description: 'Gas, public transit, ride-sharing', color: '#4ECDC4', icon: '🚗', type: 'expense' as const },
      { name: 'Shopping', description: 'Clothing, electronics, general shopping', color: '#45B7D1', icon: '🛍️', type: 'expense' as const },
      { name: 'Entertainment', description: 'Movies, concerts, games, subscriptions', color: '#96CEB4', icon: '🎬', type: 'expense' as const },
      { name: 'Bills & Utilities', description: 'Electric, water, internet, phone bills', color: '#FFEAA7', icon: '📄', type: 'expense' as const },
      { name: 'Healthcare', description: 'Medical, dental, pharmacy, insurance', color: '#DDA0DD', icon: '❤️', type: 'expense' as const },
      { name: 'Personal Care', description: 'Haircuts, cosmetics, gym, wellness', color: '#85C1E9', icon: '✨', type: 'expense' as const },
      { name: 'Other Expenses', description: 'Miscellaneous and uncategorized expenses', color: '#D5DBDB', icon: '📝', type: 'expense' as const }
    ];

    const promises = defaultExpenseCategories.map(category => 
      this.createCategory({ ...category, is_active: true })
    );

    await Promise.allSettled(promises);
  }

  async getCategoryById(id: string): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest(`/categories/${id}`, {
        method: 'GET',
      });

      const data = await this.handleResponse(response);
      return { success: true, category: data };
    } catch (error: any) {
      console.error('Get category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getCategoryById(id);
      }
      return { success: false, error: error.message };
    }
  }

  async createCategory(categoryData: CreateCategoryData): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData),
      });

      const data = await this.handleResponse(response);
      return { success: true, category: data };
    } catch (error: any) {
      console.error('Create category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.createCategory(categoryData);
      }
      return { success: false, error: error.message };
    }
  }

  async updateCategory(id: string, categoryData: UpdateCategoryData): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(categoryData),
      });

      const data = await this.handleResponse(response);
      return { success: true, category: data };
    } catch (error: any) {
      console.error('Update category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.updateCategory(id, categoryData);
      }
      return { success: false, error: error.message };
    }
  }

  async deleteCategory(id: string): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest(`/categories/${id}`, {
        method: 'DELETE',
      });

      await this.handleResponse(response);
      return { success: true };
    } catch (error: any) {
      console.error('Delete category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteCategory(id);
      }
      return { success: false, error: error.message };
    }
  }

  async getCategoryStats(): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest('/categories/stats', {
        method: 'GET',
      });

      const data = await this.handleResponse(response);
      return { success: true, stats: data };
    } catch (error: any) {
      console.error('Get category stats error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getCategoryStats();
      }
      return { success: false, error: error.message };
    }
  }
}

const categoryService = new CategoryService();
export default categoryService;
