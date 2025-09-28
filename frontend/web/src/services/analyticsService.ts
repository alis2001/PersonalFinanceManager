// Analytics Service - API Client for Finance Analytics
// Location: frontend/web/src/services/analyticsService.ts

interface AnalyticsOverviewRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  include_forecasting?: boolean;
  include_comparisons?: boolean;
}

interface CategoryAnalyticsRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  category_ids?: string[];
  include_subcategories?: boolean;
  group_by_type?: boolean;
}

interface SpendingTrendsRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  include_seasonality?: boolean;
  smoothing?: boolean;
  category_id?: string;
}

interface BudgetAnalyticsRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  category_ids?: string[];
  include_alerts?: boolean;
}

interface AnalyticsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class AnalyticsService {
  private baseURL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';
  private analyticsURL = `${this.baseURL}/api/analytics`;

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

  async getAnalyticsOverview(params: AnalyticsOverviewRequest = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.analyticsURL}/overview${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get analytics overview error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getAnalyticsOverview(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getCategoryAnalytics(params: CategoryAnalyticsRequest = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.analyticsURL}/categories${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get category analytics error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getCategoryAnalytics(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getSpendingTrends(params: SpendingTrendsRequest = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.analyticsURL}/trends/spending${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get spending trends error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getSpendingTrends(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getBudgetAnalytics(params: BudgetAnalyticsRequest = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.analyticsURL}/analytics/budget${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get budget analytics error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getBudgetAnalytics(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getInsights(params: {
    period?: string;
    start_date?: string;
    end_date?: string;
    insight_types?: string[];
  } = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.append(key, value.join(','));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      const url = `${this.analyticsURL}/analytics/insights${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get insights error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getInsights(params);
      }
      return { success: false, error: error.message };
    }
  }

  async getForecasting(params: {
    forecast_days?: number;
    confidence_interval?: number;
    model_type?: string;
    include_events?: boolean;
    category_id?: string;
  } = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.analyticsURL}/forecasting/expenses${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get forecasting error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getForecasting(params);
      }
      return { success: false, error: error.message };
    }
  }

  // Format currency helper
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Format percentage helper
  formatPercentage(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  formatDate(date: string | Date, language: string = 'en'): string {
    // This function is deprecated - use dateConversionService.formatDateShort instead
    // Keeping for backward compatibility
    const d = typeof date === 'string' ? new Date(date) : date;
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
}

// Export singleton instance
const analyticsService = new AnalyticsService();
export default analyticsService;