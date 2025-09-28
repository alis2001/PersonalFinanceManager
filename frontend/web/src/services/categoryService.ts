interface Category {
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

interface CategoryResponse {
  success: boolean;
  categories?: Category[];
  category?: Category;
  total?: number;
  stats?: any;
  error?: string;
  message?: string;
}

class CategoryService {
  private baseURL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';
  private categoryURL = `${this.baseURL}/api/categories`;
  

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

  async getCategories(params: {
    type?: 'income' | 'expense' | 'both';
    active?: boolean;
  } = {}): Promise<CategoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.type) {
        queryParams.append('type', params.type);
      }
      
      if (params.active !== undefined) {
        queryParams.append('active', params.active.toString());
      }

      const url = `${this.categoryURL}/categories${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        categories: data.categories,
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

  private async createDefaultCategories(): Promise<void> {
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

  async getIncomeCategories(): Promise<CategoryResponse> {
    return this.getCategories({ type: 'income', active: true });
  }

  async getCategory(id: string): Promise<CategoryResponse> {
    try {
      const response = await fetch(`${this.categoryURL}/categories/${id}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, category: data.category };
    } catch (error: any) {
      console.error('Get category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getCategory(id);
      }
      return { success: false, error: error.message };
    }
  }

  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    type: 'income' | 'expense' | 'both';
    is_active?: boolean;
  }): Promise<CategoryResponse> {
    try {
      const response = await fetch(`${this.categoryURL}/categories`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(categoryData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        category: data.category,
        message: data.message
      };
    } catch (error: any) {
      console.error('Create category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.createCategory(categoryData);
      }
      return { success: false, error: error.message };
    }
  }

  async updateCategory(id: string, categoryData: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    type?: 'income' | 'expense' | 'both';
    is_active?: boolean;
  }): Promise<CategoryResponse> {
    try {
      const response = await fetch(`${this.categoryURL}/categories/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(categoryData)
      });

      const data = await this.handleResponse(response);
      return { 
        success: true, 
        category: data.category,
        message: data.message
      };
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
      const response = await fetch(`${this.categoryURL}/categories/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { 
        success: true,
        message: data.message
      };
    } catch (error: any) {
      console.error('Delete category error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.deleteCategory(id);
      }
      return { success: false, error: error.message };
    }
  }

  // Utility method for formatting currency in components
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Utility method for generating default category colors
  getRandomColor(): string {
    const colors = [
      '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#85C1E9', '#F8C471', '#A9DFBF', '#F7DC6F', '#BB8FCE', '#82E0AA',
      '#AED6F1', '#F9E79F', '#D7BDE2', '#A3E4D7', '#FADBD8', '#D5DBDB'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Utility method for generating default icons
  getRandomIcon(): string {
    const icons = [
      '💰', '🍽️', '🚗', '🛍️', '🎬', '📄', '❤️', '📚', '✈️', '🏠',
      '✨', '🎁', '💼', '🎯', '⚡', '📊', '💡', '🎨', '🎵', '🏃‍♂️'
    ];
    return icons[Math.floor(Math.random() * icons.length)];
  }
}

export default new CategoryService();
export type { Category };