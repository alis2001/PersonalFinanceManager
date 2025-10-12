// Mobile Analytics Service - API Client for Finance Analytics
// Location: mobile/src/services/analyticsService.ts

import Constants from 'expo-constants';
import authService from './authService';

interface AnalyticsOverviewRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  include_forecasting?: boolean;
  include_comparisons?: boolean;
}

interface SpendingTrendsRequest {
  period?: string;
  start_date?: string;
  end_date?: string;
  include_seasonality?: boolean;
  smoothing?: boolean;
  category_id?: string;
}

interface ForecastingRequest {
  forecast_days?: number;
  confidence_interval?: number;
  model_type?: string;
  include_events?: boolean;
  category_id?: string;
}

interface AnalyticsResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

interface AnalyticsOverview {
  total_expenses: number;
  transaction_count: number;
  net_amount: number;
  average_daily_spending: number;
  top_expense_categories: Array<{
    category_name: string;
    total_amount: number;
    percentage_of_total: number;
    category_color?: string;
    category_icon?: string;
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    severity: string;
  }>;
  charts?: Array<{
    chart_type: string;
    title: string;
    data: any;
    config?: any;
  }>;
}

interface SpendingTrends {
  trend_direction: string;
  trend_percentage: number;
  trend_strength: number;
  trend_data: Array<{
    period: string;
    amount: number;
    transaction_count: number;
  }>;
}

class AnalyticsService {
  private baseURL = (Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.123:8080/api').replace('/api', '');
  private analyticsURL = `${this.baseURL}/api/analytics`;

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // For React Native, we'll get the token from authService
    const token = await authService.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        // Handle authentication error
        throw new Error('Authentication required');
      }
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
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
      const headers = await this.getAuthHeaders();
      console.log('Analytics service making request to:', url);
      console.log('Analytics service headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      const data = await this.handleResponse(response);
      console.log('Analytics service response status:', response.status);
      console.log('Analytics service response data:', data);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Get analytics overview error:', error);
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
      const headers = await this.getAuthHeaders();
      console.log('Analytics service making request to:', url);
      console.log('Analytics service headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      const data = await this.handleResponse(response);
      console.log('Analytics service response status:', response.status);
      console.log('Analytics service response data:', data);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Get spending trends error:', error);
      return { success: false, error: error.message };
    }
  }

  async getForecasting(params: ForecastingRequest = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.analyticsURL}/forecasting/expenses${queryParams.toString() ? `?${queryParams}` : ''}`;
      const headers = await this.getAuthHeaders();
      console.log('Analytics service making request to:', url);
      console.log('Analytics service headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      const data = await this.handleResponse(response);
      console.log('Analytics service response status:', response.status);
      console.log('Analytics service response data:', data);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Get forecasting error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAnomalyDetection(params: {
    lookback_days?: number;
    sensitivity?: number;
    category_id?: string;
  } = {}): Promise<AnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${this.analyticsURL}/anomaly${queryParams.toString() ? `?${queryParams}` : ''}`;
      const headers = await this.getAuthHeaders();
      console.log('Analytics service making request to:', url);
      console.log('Analytics service headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      const data = await this.handleResponse(response);
      console.log('Analytics service response status:', response.status);
      console.log('Analytics service response data:', data);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Get anomaly detection error:', error);
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

  // Get severity color
  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  }

  // Get trend direction emoji
  getTrendEmoji(direction: string): string {
    switch (direction) {
      case 'increasing': return '↗';
      case 'decreasing': return '↘';
      case 'stable': return '→';
      case 'volatile': return '↕';
      default: return '→';
    }
  }

  // Get trend direction color
  getTrendColor(direction: string): string {
    switch (direction) {
      case 'increasing': return '#ef4444';
      case 'decreasing': return '#22c55e';
      case 'stable': return '#f59e0b';
      case 'volatile': return '#8b5cf6';
      default: return '#666666';
    }
  }
}

// Export singleton instance
const analyticsService = new AnalyticsService();
export default analyticsService;
