import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import analyticsService from '../services/analyticsService';
import '../styles/Analytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

interface ChartConfig {
  chart_type: string;
  title: string;
  subtitle?: string;
  data: any;
  config?: any;
  transaction_details?: any[];
  maximizable?: boolean;
  period?: string;
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
  charts?: ChartConfig[];
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
  const [maximizedChart, setMaximizedChart] = useState<ChartConfig | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const overviewResult = await analyticsService.getAnalyticsOverview({
        period: selectedPeriod
      });

      if (overviewResult.success) {
        setOverview(overviewResult.data);
      } else {
        setError(overviewResult.error || 'Failed to load analytics overview');
      }

      const trendsResult = await analyticsService.getSpendingTrends({
        period: selectedPeriod
      });

      if (trendsResult.success) {
        setTrends(trendsResult.data);
      } else if (!error) {
        setError(trendsResult.error || 'Failed to load spending trends');
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

  const renderChart = (chartConfig: ChartConfig, isMaximized: boolean = false) => {
    const { chart_type, data, config, transaction_details } = chartConfig;
    
    const chartOptions = {
      ...config,
      responsive: true,
      maintainAspectRatio: !isMaximized,
      plugins: {
        ...config?.plugins,
        tooltip: {
          ...config?.plugins?.tooltip,
          callbacks: {
            title: (context: any) => {
              if (transaction_details && context[0]) {
                const index = context[0].dataIndex;
                const transaction = transaction_details[index];
                return transaction ? `${transaction.category.name} - ${transaction.description}` : '';
              }
              return context[0]?.label || '';
            },
            label: (context: any) => {
              const value = formatCurrency(context.parsed.y);
              if (transaction_details && context.dataIndex < transaction_details.length) {
                const transaction = transaction_details[context.dataIndex];
                return [
                  `Amount: ${value}`,
                  `Date: ${new Date(transaction.date).toLocaleDateString()}`,
                  `Location: ${transaction.location || 'N/A'}`
                ];
              }
              return `Amount: ${value}`;
            }
          }
        }
      }
    };

    switch (chart_type) {
      case 'line':
        return <Line data={data} options={chartOptions} />;
      case 'bar':
        return <Bar data={data} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={data} options={chartOptions} />;
      default:
        return <Line data={data} options={chartOptions} />;
    }
  };

  const maximizeChart = (chart: ChartConfig) => {
    setMaximizedChart(chart);
  };

  const closeMaximizedChart = () => {
    setMaximizedChart(null);
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="error-state">
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button onClick={loadAnalyticsData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <div className="period-selector">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="overview-cards">
          <div className="overview-card">
            <h3>Total Expenses</h3>
            <p className="amount">{formatCurrency(overview.total_expenses)}</p>
          </div>
          <div className="overview-card">
            <h3>Transactions</h3>
            <p className="count">{overview.transaction_count}</p>
          </div>
          <div className="overview-card">
            <h3>Daily Average</h3>
            <p className="amount">{formatCurrency(overview.average_daily_spending)}</p>
          </div>
          <div className="overview-card">
            <h3>Net Amount</h3>
            <p className={`amount ${overview.net_amount >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(overview.net_amount)}
            </p>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {overview?.charts && (
        <div className="charts-section">
          {overview.charts.map((chart, index) => (
            <div key={index} className="chart-container">
              <div className="chart-header">
                <div>
                  <h3>{chart.title}</h3>
                  {chart.subtitle && <p className="chart-subtitle">{chart.subtitle}</p>}
                </div>
                {chart.maximizable && (
                  <button 
                    className="maximize-button"
                    onClick={() => maximizeChart(chart)}
                    title="Maximize Chart"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path d="M1.5 1.5v3h3m7-3v3h3m-3 7v3h3m-7 0v3h-3" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            fill="none"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className="chart-content">
                {renderChart(chart)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trends Section */}
      {trends && (
        <div className="trends-section">
          <h2>Spending Trends</h2>
          <div className="trend-summary">
            <div className="trend-direction">
              <span className={`trend-indicator ${trends.trend_direction}`}>
                {trends.trend_direction === 'increasing' ? '↗' : 
                 trends.trend_direction === 'decreasing' ? '↘' : '→'}
              </span>
              <span>Trend: {trends.trend_direction}</span>
            </div>
            <div className="trend-percentage">
              <span className={trends.trend_percentage >= 0 ? 'positive' : 'negative'}>
                {formatPercentage(trends.trend_percentage)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Categories */}
      {overview?.top_expense_categories && (
        <div className="categories-section">
          <h2>Top Spending Categories</h2>
          <div className="categories-list">
            {overview.top_expense_categories.map((category, index) => (
              <div key={index} className="category-item">
                <div className="category-info">
                  <span className="category-icon">{category.category_icon}</span>
                  <span className="category-name">{category.category_name}</span>
                </div>
                <div className="category-amounts">
                  <span className="amount">{formatCurrency(category.total_amount)}</span>
                  <span className="percentage">({category.percentage_of_total.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {overview?.insights && (
        <div className="insights-section">
          <h2>Insights</h2>
          <div className="insights-list">
            {overview.insights.map((insight, index) => (
              <div key={index} className={`insight-item ${insight.severity}`}>
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maximized Chart Modal */}
      {maximizedChart && (
        <div className="chart-modal-overlay" onClick={closeMaximizedChart}>
          <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{maximizedChart.title}</h2>
              <button 
                className="close-button"
                onClick={closeMaximizedChart}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              {renderChart(maximizedChart, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;