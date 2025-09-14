// CREATE NEW FILE: frontend/web/src/components/Analytics.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import analyticsService from '../services/analyticsService';
import '../styles/Analytics.css';

interface AnalyticsOverview {
  total_expenses: number;
  total_income: number;
  net_amount: number;
  transaction_count: number;
  average_daily_spending: number;
  top_expense_categories: Array<{
    category_name: string;
    total_amount: number;
    percentage_of_total: number;
  }>;
  charts: Array<{
    chart_type: string;
    title: string;
    data: any[];
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    severity: string;
  }>;
}

interface SpendingTrends {
  trend_direction: string;
  trend_strength: number;
  trend_percentage: number;
  time_series: Array<{
    period: string;
    amount: number;
    transaction_count: number;
  }>;
}

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<SpendingTrends | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load analytics overview
      const overviewResult = await analyticsService.getAnalyticsOverview({
        period: selectedPeriod,
        include_comparisons: true,
        include_forecasting: false
      });

      if (overviewResult.success) {
        setOverview(overviewResult.data);
      } else {
        setError(overviewResult.error);
      }

      // Load spending trends
      const trendsResult = await analyticsService.getSpendingTrends({
        period: selectedPeriod,
        include_seasonality: true
      });

      if (trendsResult.success) {
        setTrends(trendsResult.data);
      }

    } catch (err) {
      console.error('Analytics loading error:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="error-message">
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <header className="analytics-header">
        <h1>📊 Financial Analytics</h1>
        <div className="analytics-controls">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="period-selector"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Back to Dashboard
          </button>
        </div>
      </header>

      {overview && (
        <>
          {/* Overview Cards */}
          <div className="analytics-overview">
            <div className="overview-cards">
              <div className="overview-card income">
                <h3>Total Income</h3>
                <p className="amount">{formatCurrency(overview.total_income)}</p>
                <span className="label">This {selectedPeriod}</span>
              </div>
              <div className="overview-card expense">
                <h3>Total Expenses</h3>
                <p className="amount">{formatCurrency(overview.total_expenses)}</p>
                <span className="label">This {selectedPeriod}</span>
              </div>
              <div className={`overview-card net ${overview.net_amount >= 0 ? 'positive' : 'negative'}`}>
                <h3>Net Amount</h3>
                <p className="amount">{formatCurrency(overview.net_amount)}</p>
                <span className="label">{overview.net_amount >= 0 ? 'Saved' : 'Overspent'}</span>
              </div>
              <div className="overview-card transactions">
                <h3>Transactions</h3>
                <p className="amount">{overview.transaction_count}</p>
                <span className="label">Total transactions</span>
              </div>
            </div>
          </div>

          {/* Trend Analysis */}
          {trends && (
            <div className="trends-section">
              <h2>Spending Trends</h2>
              <div className="trend-summary">
                <div className="trend-indicator">
                  <span className={`trend-arrow ${trends.trend_direction}`}>
                    {trends.trend_direction === 'increasing' ? '📈' : 
                     trends.trend_direction === 'decreasing' ? '📉' : '➡️'}
                  </span>
                  <div className="trend-details">
                    <h3>{trends.trend_direction.toUpperCase()} TREND</h3>
                    <p>{formatPercentage(trends.trend_percentage)} change</p>
                    <p>Strength: {(trends.trend_strength * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Categories */}
          {overview.top_expense_categories.length > 0 && (
            <div className="categories-section">
              <h2>Top Spending Categories</h2>
              <div className="categories-list">
                {overview.top_expense_categories.slice(0, 5).map((category, index) => (
                  <div key={category.category_name} className="category-item">
                    <div className="category-info">
                      <span className="category-rank">#{index + 1}</span>
                      <span className="category-name">{category.category_name}</span>
                    </div>
                    <div className="category-amount">
                      <span className="amount">{formatCurrency(category.total_amount)}</span>
                      <span className="percentage">{category.percentage_of_total.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {overview.insights.length > 0 && (
            <div className="insights-section">
              <h2>💡 Financial Insights</h2>
              <div className="insights-list">
                {overview.insights.map((insight, index) => (
                  <div key={index} className={`insight-item ${insight.severity}`}>
                    <div className="insight-header">
                      <h4 style={{ color: getSeverityColor(insight.severity) }}>
                        {insight.title}
                      </h4>
                    </div>
                    <p className="insight-description">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts Placeholder */}
          <div className="charts-section">
            <h2>📈 Visual Analytics</h2>
            <div className="charts-grid">
              <div className="chart-placeholder">
                <h3>Income vs Expenses</h3>
                <div className="chart-content">
                  <p>Chart visualization would go here</p>
                  <p>Integration with charting library needed</p>
                </div>
              </div>
              <div className="chart-placeholder">
                <h3>Spending by Category</h3>
                <div className="chart-content">
                  <p>Pie chart would go here</p>
                  <p>Integration with charting library needed</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;