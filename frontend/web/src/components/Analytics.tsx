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
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import analyticsService from '../services/analyticsService';
import '../styles/Analytics.css';

// Register Chart.js components
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
  Filler
);

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
        period: selectedPeriod
      });

      if (overviewResult.success) {
        setOverview(overviewResult.data);
      } else {
        setError(overviewResult.error || 'Failed to load analytics overview');
      }

      // Load spending trends
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  // Chart rendering functions
  const renderChart = (chart: any) => {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#3182ce',
          borderWidth: 1,
          callbacks: {
            label: (context: any) => {
              if (chart.chart_type === 'doughnut') {
                return `${context.label}: ${formatCurrency(context.raw)} (${context.parsed}%)`;
              }
              return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    };

    switch (chart.chart_type) {
      case 'doughnut':
        if (chart.data && chart.data.length > 0) {
          const chartData = {
            labels: chart.data.map((item: any) => item.label),
            datasets: [{
              data: chart.data.map((item: any) => item.value),
              backgroundColor: chart.data.map((item: any) => item.color || '#64748b'),
              borderColor: '#ffffff',
              borderWidth: 2,
              hoverBorderWidth: 3
            }]
          };
          
          return (
            <div className="chart-wrapper">
              <Doughnut 
                data={chartData} 
                options={{
                  ...commonOptions,
                  cutout: '60%',
                  plugins: {
                    ...commonOptions.plugins,
                    legend: {
                      ...commonOptions.plugins.legend,
                      position: 'right' as const
                    }
                  }
                }} 
              />
            </div>
          );
        }
        break;

      case 'bar':
        if (chart.data && chart.data.labels && chart.data.labels.length > 0) {
          const options = {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: any) => formatCurrency(value)
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)'
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          };

          return (
            <div className="chart-wrapper">
              <Bar data={chart.data} options={options} />
            </div>
          );
        }
        break;

      case 'line':
      case 'area':
        if (chart.data && chart.data.labels && chart.data.labels.length > 0) {
          const options = {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: any) => formatCurrency(value)
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)'
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            },
            elements: {
              line: {
                tension: 0.4
              },
              point: {
                radius: 4,
                hoverRadius: 6
              }
            }
          };

          return (
            <div className="chart-wrapper">
              <Line data={chart.data} options={options} />
            </div>
          );
        }
        break;
    }

    // Fallback for charts with no data
    return (
      <div className="chart-no-data">
        <div className="no-data-icon">📊</div>
        <p>No data available for this period</p>
        <small>Try selecting a different time period</small>
      </div>
    );
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
            <option value="daily">Daily</option>
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
              <div className="overview-card expense">
                <h3>Total Expenses</h3>
                <p className="amount">{formatCurrency(overview.total_expenses)}</p>
                <span className="label">This {selectedPeriod}</span>
              </div>
              
              <div className="overview-card transactions">
                <h3>Total Transactions</h3>
                <p className="amount">{overview.transaction_count}</p>
                <span className="label">This {selectedPeriod}</span>
              </div>
              
              <div className="overview-card daily-avg">
                <h3>Daily Average</h3>
                <p className="amount">{formatCurrency(overview.average_daily_spending)}</p>
                <span className="label">Average per day</span>
              </div>
            </div>
          </div>

          {/* Professional Charts Section */}
          {overview.charts && overview.charts.length > 0 && (
            <div className="charts-section">
              <h2>📈 Financial Analysis Charts</h2>
              <div className="charts-grid">
                {overview.charts.map((chart, index) => (
                  <div key={index} className="chart-container">
                    <h3>{chart.title}</h3>
                    {renderChart(chart)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends Section */}
          {trends && (
            <div className="trends-section">
              <h2>📊 Spending Trends</h2>
              <div className="trend-summary">
                <div className="trend-indicator">
                  <span className={`trend-direction ${trends.trend_direction}`}>
                    {trends.trend_direction === 'increasing' ? '📈' : 
                     trends.trend_direction === 'decreasing' ? '📉' : '➡️'}
                  </span>
                  <div className="trend-info">
                    <h3>Trend: {trends.trend_direction}</h3>
                    <p>Change: {formatPercentage(trends.trend_percentage)}</p>
                    <p>Strength: {(trends.trend_strength * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Categories */}
          <div className="categories-section">
            <h2>🏆 Top Spending Categories</h2>
            <div className="categories-list">
              {overview.top_expense_categories.map((category, index) => (
                <div key={index} className="category-item">
                  <div className="category-info">
                    <span className="category-icon">{category.category_icon || '💰'}</span>
                    <div className="category-details">
                      <h4>{category.category_name}</h4>
                      <p>{formatCurrency(category.total_amount)} ({category.percentage_of_total.toFixed(1)}%)</p>
                    </div>
                  </div>
                  <div className="category-bar">
                    <div 
                      className="category-progress" 
                      style={{ 
                        width: `${category.percentage_of_total}%`,
                        backgroundColor: category.category_color || '#64748b'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="insights-section">
            <h2>💡 Financial Insights</h2>
            <div className="insights-list">
              {overview.insights.map((insight, index) => (
                <div key={index} className="insight-item">
                  <div 
                    className="insight-indicator"
                    style={{ backgroundColor: getSeverityColor(insight.severity) }}
                  ></div>
                  <div className="insight-content">
                    <h4>{insight.title}</h4>
                    <p>{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;