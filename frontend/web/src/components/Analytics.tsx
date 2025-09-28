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
import authService from '../services/authService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultCurrency: string;
}

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Function to translate category names
  const getTranslatedCategoryName = (categoryName: string): string => {
    const categoryMap: { [key: string]: string } = {
      'Bills & Utilities': t('categories.billsUtilities'),
      'Food & Dining': t('categories.foodDining'),
      'Transportation': t('categories.transportation'),
      'Shopping': t('categories.shopping'),
      'Entertainment': t('categories.entertainment'),
      'Healthcare': t('categories.healthcare'),
      'Education': t('categories.education'),
      'Travel': t('categories.travel'),
      'Groceries': t('categories.groceries'),
      'Gas': t('categories.gas'),
      'Insurance': t('categories.insurance'),
      'Other': t('categories.other'),
      'Business': t('categories.business'),
      'Business Income': t('categories.businessIncome'),
      'Freelance': t('categories.freelance'),
      'Gifts & Bonuses': t('categories.giftsBonuses'),
      'Gifts & Donations': t('categories.giftsDonations'),
      'Home & Garden': t('categories.homeGarden'),
      'Investment Returns': t('categories.investmentReturns'),
      'Other Expenses': t('categories.otherExpenses'),
      'Other Income': t('categories.otherIncome'),
      'Personal Care': t('categories.personalCare'),
      'Rental Income': t('categories.rentalIncome'),
    };
    return categoryMap[categoryName] || categoryName;
  };
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<SpendingTrends | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      loadAnalyticsData();
    }
  }, [selectedPeriod, user]);

  const loadUserProfile = async () => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
      return;
    }

    const profile = await authService.getProfile();
    if (profile) {
      setUser(profile);
    } else {
      navigate('/login');
    }
  };

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
    const currency = user?.defaultCurrency || 'USD';
    return currencyService.formatCurrency(amount, currency);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Map backend chart titles to translation keys
  const getTranslatedChartTitle = (title: string): string => {
    const titleMap: { [key: string]: string } = {
      'Expense Distribution by Category': t('analytics.expenseDistributionByCategory'),
      'Spending Map - All Transactions (Monthly)': t('analytics.spendingMapAllTransactions'),
      'Monthly Spending Comparison': t('analytics.monthlySpendingComparison'),
      'Top Spending Categories': t('analytics.topCategories'),
    };
    return titleMap[title] || title;
  };


  // Map backend insight content to translation keys
  const getTranslatedInsight = (insight: any): any => {
    if (insight.title === 'Spending Summary') {
      return {
        ...insight,
        title: t('analytics.spendingSummary'),
        description: t('analytics.youSpentAcrossTransactions', {
          amount: formatCurrency(overview?.total_expenses || 0),
          count: overview?.transaction_count || 0,
          average: formatCurrency(overview?.average_daily_spending || 0)
        })
      };
    }
    
    if (insight.title === 'Highest Spending' || insight.title?.toLowerCase().includes('highest spending')) {
      const topCategory = overview?.top_expense_categories?.[0];
      const translatedCategoryName = getTranslatedCategoryName(topCategory?.category_name || '');
      return {
        ...insight,
        title: t('analytics.highestSpending', { category: translatedCategoryName }),
        description: t('analytics.yourLargestExpenseCategory', {
          category: translatedCategoryName,
          amount: formatCurrency(topCategory?.total_amount || 0),
          percentage: topCategory?.percentage_of_total?.toFixed(1) || '0'
        })
      };
    }
    
    if (insight.title === 'Transaction Pattern') {
      return {
        ...insight,
        title: t('analytics.transactionPattern'),
        description: t('analytics.youAveragedPerTransaction', {
          average: formatCurrency((overview?.total_expenses || 0) / (overview?.transaction_count || 1)),
          count: overview?.transaction_count || 0
        })
      };
    }
    
    if (insight.title === 'Spending Trend') {
      return {
        ...insight,
        title: t('analytics.spendingTrend'),
        description: t('analytics.spendingTrendDesc', {
          period: insight.description.match(/this month|last month|this year|last year/i)?.[0] || '',
          trend: insight.description.match(/increased|decreased|stable/i)?.[0] || ''
        })
      };
    }
    
    if (insight.title === 'Category Breakdown') {
      const categoryMatch = insight.description.match(/(\w+(?:\s+\w+)*)/);
      const translatedCategoryName = categoryMatch ? getTranslatedCategoryName(categoryMatch[1]) : '';
      return {
        ...insight,
        title: t('analytics.categoryBreakdown'),
        description: t('analytics.categoryBreakdownDesc', {
          category: translatedCategoryName,
          amount: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/)?.[0] || '0'),
          percentage: insight.description.match(/(\d+\.?\d*)%/)?.[1] || '0'
        })
      };
    }
    
    if (insight.title === 'Monthly Comparison') {
      return {
        ...insight,
        title: t('analytics.monthlyComparison'),
        description: t('analytics.monthlyComparisonDesc', {
          current: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/)?.[0] || '0'),
          previous: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/g)?.[1] || '0')
        })
      };
    }
    
    if (insight.title === 'Daily Average') {
      return {
        ...insight,
        title: t('analytics.dailyAverage'),
        description: t('analytics.dailyAverageDesc', {
          amount: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/)?.[0] || '0')
        })
      };
    }
    
    if (insight.title === 'Transaction Count') {
      return {
        ...insight,
        title: t('analytics.transactionCount'),
        description: t('analytics.transactionCountDesc', {
          count: insight.description.match(/\d+/)?.[0] || '0'
        })
      };
    }
    
    if (insight.title === 'Largest Transaction') {
      const categoryMatch = insight.description.match(/for\s+(\w+(?:\s+\w+)*)/i);
      const translatedCategoryName = categoryMatch ? getTranslatedCategoryName(categoryMatch[1]) : '';
      return {
        ...insight,
        title: t('analytics.largestTransaction'),
        description: t('analytics.largestTransactionDesc', {
          amount: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/)?.[0] || '0'),
          category: translatedCategoryName
        })
      };
    }
    
    if (insight.title === 'Smallest Transaction') {
      const categoryMatch = insight.description.match(/for\s+(\w+(?:\s+\w+)*)/i);
      const translatedCategoryName = categoryMatch ? getTranslatedCategoryName(categoryMatch[1]) : '';
      return {
        ...insight,
        title: t('analytics.smallestTransaction'),
        description: t('analytics.smallestTransactionDesc', {
          amount: formatCurrency(insight.description.match(/\$[\d,]+\.?\d*/)?.[0] || '0'),
          category: translatedCategoryName
        })
      };
    }
    
    // Fallback: try to translate common insight titles
    const commonInsightTitles: { [key: string]: string } = {
      'Highest Spending': t('analytics.highestSpending', { category: getTranslatedCategoryName(insight.title) }),
      'Spending Summary': t('analytics.spendingSummary'),
      'Transaction Pattern': t('analytics.transactionPattern'),
      'Spending Trend': t('analytics.spendingTrend'),
      'Category Breakdown': t('analytics.categoryBreakdown'),
      'Monthly Comparison': t('analytics.monthlyComparison'),
      'Daily Average': t('analytics.dailyAverage'),
      'Transaction Count': t('analytics.transactionCount'),
      'Largest Transaction': t('analytics.largestTransaction'),
      'Smallest Transaction': t('analytics.smallestTransaction')
    };

    return {
      ...insight,
      title: commonInsightTitles[insight.title] || insight.title,
      description: insight.description
    };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  // Modern color palette
  const modernColors = [
    '#1a1a1a', '#666666', '#999999', '#e0e0e0', '#f0f0f0',
    '#2d3748', '#4a5568', '#718096', '#a0aec0', '#cbd5e0'
  ];

  const createGradient = (ctx: any, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '20');
    return gradient;
  };

  // Chart rendering functions
  const renderChart = (chart: any) => {
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart' as const,
      },
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: {
              size: 13,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              weight: 'normal' as const
            },
            color: '#666666',
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#e0e0e0',
          borderWidth: 1,
          borderRadius: 12,
          padding: 16,
          titleFont: {
            size: 14,
            weight: 'bold' as const,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
          },
          bodyFont: {
            size: 13,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
          },
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
            labels: chart.data.map((item: any) => getTranslatedCategoryName(item.label)),
            datasets: [{
              data: chart.data.map((item: any) => item.value),
              backgroundColor: chart.data.map((item: any) => item.color || '#64748b'),
              borderColor: '#ffffff',
              borderWidth: 3,
              hoverBorderWidth: 4,
              hoverOffset: 8,
              borderRadius: 8,
              spacing: 2
            }]
          };
          
          return (
            <div className="chart-wrapper">
              <Doughnut 
                data={chartData} 
                options={{
                  ...commonOptions,
                  cutout: '65%',
                  plugins: {
                    ...commonOptions.plugins,
                    legend: {
                      ...commonOptions.plugins.legend,
                      position: 'right' as const,
                      labels: {
                        ...commonOptions.plugins.legend.labels,
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                      }
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
          const modernBarData = {
            ...chart.data,
            labels: chart.data.labels?.map((label: string) => getTranslatedCategoryName(label)) || chart.data.labels,
            datasets: chart.data.datasets.map((dataset: any, index: number) => ({
              ...dataset,
              backgroundColor: dataset.backgroundColor || modernColors[index % modernColors.length],
              borderColor: dataset.borderColor || dataset.backgroundColor || modernColors[index % modernColors.length],
              borderWidth: 0,
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 40,
              maxBarThickness: 50
            }))
          };

          const options = {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: any) => formatCurrency(value),
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
                  },
                  color: '#666666',
                  padding: 10
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false,
                  lineWidth: 1
                },
                border: {
                  display: false
                }
              },
              x: {
                ticks: {
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
                  },
                  color: '#666666',
                  padding: 10
                },
                grid: {
                  display: false
                },
                border: {
                  display: false
                }
              }
            }
          };

          return (
            <div className="chart-wrapper">
              <Bar data={modernBarData} options={options} />
            </div>
          );
        }
        break;

      case 'line':
      case 'area':
        if (chart.data && chart.data.labels && chart.data.labels.length > 0) {
          const modernLineData = {
            ...chart.data,
            labels: chart.data.labels?.map((label: string) => getTranslatedCategoryName(label)) || chart.data.labels,
            datasets: chart.data.datasets.map((dataset: any, index: number) => {
              const originalColor = dataset.borderColor || dataset.backgroundColor || modernColors[index % modernColors.length];
              return {
                ...dataset,
                borderColor: originalColor,
                backgroundColor: chart.chart_type === 'area' 
                  ? originalColor + '20'
                  : 'transparent',
                borderWidth: 3,
                pointBackgroundColor: originalColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: originalColor,
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3,
                fill: chart.chart_type === 'area'
              };
            })
          };

          const options = {
            ...commonOptions,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: any) => formatCurrency(value),
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
                  },
                  color: '#666666',
                  padding: 10
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                  drawBorder: false,
                  lineWidth: 1
                },
                border: {
                  display: false
                }
              },
              x: {
                ticks: {
                  font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
                  },
                  color: '#666666',
                  padding: 10
                },
                grid: {
                  display: false
                },
                border: {
                  display: false
                }
              }
            },
            elements: {
              line: {
                tension: 0.4,
                capBezierPoints: false
              },
              point: {
                radius: 5,
                hoverRadius: 8,
                hitRadius: 10
              }
            },
            interaction: {
              intersect: false,
              mode: 'index' as const
            }
          };

          return (
            <div className="chart-wrapper">
              <Line data={modernLineData} options={options} />
            </div>
          );
        }
        break;
    }

    // Fallback for charts with no data
    return (
      <div className="chart-no-data">
        <div className="no-data-icon">—</div>
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
          <h3>{t('analytics.errorLoadingAnalytics')}</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            {t('analytics.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <header className="analytics-header">
        <h1>{t('analytics.financialAnalytics')}</h1>
        <div className="analytics-controls">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="period-selector"
          >
            <option value="daily">{t('analytics.daily')}</option>
            <option value="weekly">{t('analytics.weekly')}</option>
            <option value="monthly">{t('analytics.monthly')}</option>
            <option value="quarterly">{t('analytics.quarterly')}</option>
            <option value="yearly">{t('analytics.yearly')}</option>
          </select>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            {t('analytics.backToDashboard')}
          </button>
        </div>
      </header>

      {overview && (
        <>
          {/* Overview Cards */}
          <div className="analytics-overview">
            <div className="overview-cards">
              <div className="overview-card expense">
                <h3>{t('analytics.totalExpenses')}</h3>
                <p className="amount">{formatCurrency(overview.total_expenses)}</p>
                <span className="label">{t('analytics.thisMonth')}</span>
              </div>
              
              <div className="overview-card transactions">
                <h3>{t('analytics.totalTransactions')}</h3>
                <p className="amount">{overview.transaction_count}</p>
                <span className="label">{t('analytics.thisMonth')}</span>
              </div>
              
              <div className="overview-card daily-avg">
                <h3>{t('analytics.dailyAverage')}</h3>
                <p className="amount">{formatCurrency(overview.average_daily_spending)}</p>
                <span className="label">{t('analytics.averagePerDay')}</span>
              </div>
            </div>
          </div>

          {/* Professional Charts Section */}
          {overview.charts && overview.charts.length > 0 && (
            <div className="charts-section">
              <h2>{t('analytics.financialAnalysisCharts')}</h2>
              <div className="charts-grid">
                {overview.charts.map((chart, index) => (
                  <div key={index} className="chart-container">
                    <h3>{getTranslatedChartTitle(chart.title)}</h3>
                    {renderChart(chart)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends Section */}
          {trends && (
            <div className="trends-section">
              <h2>{t('analytics.spendingTrends')}</h2>
              <div className="trend-summary">
                <div className="trend-indicator">
                  <span className={`trend-direction ${trends.trend_direction}`}>
                    {trends.trend_direction === 'increasing' ? '↗' : 
                     trends.trend_direction === 'decreasing' ? '↘' : '→'}
                  </span>
                  <div className="trend-info">
                    <h3>{t('analytics.trend')}: {trends.trend_direction}</h3>
                    <p>{t('analytics.change')}: {formatPercentage(trends.trend_percentage)}</p>
                    <p>{t('analytics.strength')}: {(trends.trend_strength * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Categories */}
          <div className="categories-section">
            <h2>{t('analytics.topCategories')}</h2>
            <div className="categories-list">
              {overview.top_expense_categories.map((category, index) => (
                <div key={index} className="category-item">
                  <div className="category-info">
                    <span className="category-icon">{category.category_icon || '•'}</span>
                    <div className="category-details">
                      <h4>{getTranslatedCategoryName(category.category_name)}</h4>
                      <p>{formatCurrency(category.total_amount)} ({category.percentage_of_total.toFixed(1)}%)</p>
                    </div>
                  </div>
                  <div className="category-bar">
                    <div 
                      className="category-progress" 
                      style={{ 
                        width: `${category.percentage_of_total}%`,
                        backgroundColor: category.category_color || '#1a1a1a'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="insights-section">
            <h2>{t('analytics.financialInsights')}</h2>
            <div className="insights-list">
              {overview.insights.map((insight, index) => {
                const translatedInsight = getTranslatedInsight(insight);
                return (
                  <div key={index} className="insight-item">
                    <div className="insight-indicator"></div>
                    <div className="insight-content">
                      <h4>{translatedInsight.title}</h4>
                      <p>{translatedInsight.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;