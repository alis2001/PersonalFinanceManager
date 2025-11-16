// Category Service for Mobile
// Handles category-related API calls

import { fetchWithTimeout } from '../utils/NetworkUtils';
import secureStorage from './SecureStorage';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  is_active: boolean;
  // Hierarchical fields
  parent_id?: string;
  level: number;
  path: string;
  path_ids: string[];
  // Children (for tree structure)
  children?: Category[];
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
  parent_id?: string;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {
  is_active?: boolean;
}

class CategoryService {
  private baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.123:8080/api';
  private categoryURL = `${this.baseURL}/categories`;

  // Utility function to get full hierarchical path for a category
  getCategoryPath(category: Category, allCategories: Category[]): string {
    const buildPath = (cat: Category): string[] => {
      const path = [cat.name];
      if (cat.parent_id) {
        const parent = allCategories.find(c => c.id === cat.parent_id);
        if (parent) {
          return [...buildPath(parent), ...path];
        }
      }
      return path;
    };
    
    return buildPath(category).join(' → ');
  }

  // Check if a category is a leaf category (has no children)
  isLeafCategory(category: Category, allCategories: Category[]): boolean {
    return !allCategories.some(cat => cat.parent_id === category.id);
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await secureStorage.getItem('accessToken');
    
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
      
      const response = await fetchWithTimeout(url, {
        ...options,
        headers,
        timeout: 30000,
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
      const refreshToken = await secureStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetchWithTimeout(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await secureStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          await secureStorage.setItem('refreshToken', data.refreshToken);
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
    includeChildren?: boolean;
    level?: number;
    parentId?: string;
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

      if (params.includeChildren !== undefined) {
        queryParams.append('includeChildren', params.includeChildren.toString());
      }

      if (params.level !== undefined) {
        queryParams.append('level', params.level.toString());
      }

      if (params.parentId) {
        queryParams.append('parentId', params.parentId);
      }

      const endpoint = `${queryParams.toString() ? `?${queryParams}` : ''}`;
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
      const response = await this.makeRequest(`/${id}`, {
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
      const response = await this.makeRequest('', {
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
      const response = await this.makeRequest(`/${id}`, {
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

  async deleteCategory(id: string, deleteChildren: boolean = false): Promise<CategoryResponse> {
    try {
      const endpoint = `/${id}${deleteChildren ? '?deleteChildren=true' : ''}`;
      const response = await this.makeRequest(endpoint, {
        method: 'DELETE',
      });

      await this.handleResponse(response);
      return { success: true };
    } catch (error: any) {
      console.error('Delete category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteCategory(id, deleteChildren);
      }
      return { success: false, error: error.message };
    }
  }

  async moveCategory(id: string, newParentId?: string): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest(`/${id}/move`, {
        method: 'PUT',
        body: JSON.stringify({ new_parent_id: newParentId }),
      });

      const data = await this.handleResponse(response);
      return { success: true, category: data.category };
    } catch (error: any) {
      console.error('Move category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.moveCategory(id, newParentId);
      }
      return { success: false, error: error.message };
    }
  }

  async getCategoryTree(type?: 'income' | 'expense' | 'both'): Promise<CategoryResponse> {
    return this.getCategories({ 
      type, 
      active: true, 
      includeChildren: true 
    });
  }

  async getRootCategories(type?: 'income' | 'expense' | 'both'): Promise<CategoryResponse> {
    return this.getCategories({ 
      type, 
      active: true, 
      level: 1 
    });
  }

  async getSubCategories(parentId: string): Promise<CategoryResponse> {
    return this.getCategories({ 
      active: true, 
      parentId 
    });
  }

  async getCategoryStats(): Promise<CategoryResponse> {
    try {
      const response = await this.makeRequest('/stats', {
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

  async checkCategoryUsage(id: string): Promise<{
    success: boolean;
    hasExpenses?: boolean;
    hasChildren?: boolean;
    expenseCount?: number;
    childrenCount?: number;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest(`/${id}/usage`, {
        method: 'GET',
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        hasExpenses: data.hasExpenses,
        hasChildren: data.hasChildren,
        expenseCount: data.expenseCount,
        childrenCount: data.childrenCount
      };
    } catch (error: any) {
      console.error('Check category usage error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.checkCategoryUsage(id);
      }
      return { success: false, error: error.message };
    }
  }

  async updateCategoryWithCascade(id: string, categoryData: UpdateCategoryData, cascadeToChildren: boolean = false): Promise<CategoryResponse> {
    try {
      const endpoint = `/${id}${cascadeToChildren ? '?cascade=true' : ''}`;
      console.log(`🔄 CATEGORY SERVICE CASCADE: Calling endpoint ${endpoint} with data:`, categoryData);
      
      const response = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(categoryData),
      });

      const data = await this.handleResponse(response);
      console.log(`🔄 CATEGORY SERVICE CASCADE SUCCESS: Response data:`, data);
      return { success: true, category: data };
    } catch (error: any) {
      console.error('Update category with cascade error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.updateCategoryWithCascade(id, categoryData, cascadeToChildren);
      }
      return { success: false, error: error.message };
    }
  }
}

const categoryService = new CategoryService();
export default categoryService;
