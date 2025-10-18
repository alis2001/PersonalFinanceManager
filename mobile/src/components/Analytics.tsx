import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import Svg, { Circle, Path, Text as SvgText, G, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import BottomNavigation from './BottomNavigation';
import analyticsService from '../services/analyticsService';
import authService from '../services/authService';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';
import { useAppRefresh } from '../services/AppRefreshContext';
import { formatDateForDisplay } from '../utils/dateFormatter';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;

interface AnalyticsProps {
  navigation?: any;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
  onSettings?: () => void;
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

  const Analytics: React.FC<AnalyticsProps> = ({ navigation, activeRoute = 'Analytics', onNavigate, onAddExpense, onSettings }) => {
  const { t, currentLanguage } = useTranslation();
  const { refreshTrigger } = useAppRefresh();
  
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

  // Function to translate chart titles
  const getTranslatedChartTitle = (title: string): string => {
    const titleMap: { [key: string]: string } = {
      'Expense Distribution by Category': t('analytics.expenseDistributionByCategory'),
      'Monthly Spending Trends': t('analytics.spendingTrends'),
      'Spending Trends': t('analytics.spendingTrends'),
      'Monthly Overview': t('analytics.monthlyOverview'),
      'Financial Insights': t('analytics.financialInsights'),
      'Top Categories': t('analytics.topCategories'),
      'Expense Breakdown': t('analytics.expenseBreakdown'),
      'Spending Analysis': t('analytics.financialAnalytics'),
      'Category Analysis': t('analytics.expenseDistributionByCategory'),
      'Monthly Analysis': t('analytics.monthlyOverview'),
      'Trend Analysis': t('analytics.spendingTrends'),
    };
    return titleMap[title] || title;
  };

  // Function to translate chart subtitles
  const getTranslatedChartSubtitle = (subtitle: string): string => {
    const subtitleMap: { [key: string]: string } = {
      'This Month': t('analytics.thisMonth'),
      'Last Month': t('analytics.lastMonth'),
      'This Year': t('analytics.thisYear'),
      'Last Year': t('analytics.lastYear'),
      'Daily': t('analytics.daily'),
      'Weekly': t('analytics.weekly'),
      'Monthly': t('analytics.monthly'),
      'Quarterly': t('analytics.quarterly'),
      'Yearly': t('analytics.yearly'),
    };
    return subtitleMap[subtitle] || subtitle;
  };

  // Function to check if current language is RTL
  const isRTLLanguage = (): boolean => {
    return currentLanguage === 'fa' || currentLanguage === 'ar';
  };

  // Function to get proper text direction and alignment for SVG text
  const getTextDirectionProps = () => {
    if (isRTLLanguage()) {
      return {
        direction: 'rtl',
        unicodeBidi: 'embed',
        textAnchor: 'middle' as const,
        writingMode: 'horizontal-tb' as const,
        fontFamily: 'System',
      };
    }
    return {
      direction: 'ltr',
      unicodeBidi: 'normal',
      textAnchor: 'middle' as const,
      fontFamily: 'System',
    };
  };

  // Function to render category name text with proper RTL handling
  const renderCategoryNameText = (x: number, y: number, text: string, isShadow: boolean = false) => {
    const textProps = {
      x: x + (isShadow ? 1 : 0),
      y: y + (isShadow ? 1 : 0),
      fontSize: "10",
      fontWeight: "500",
      fill: isShadow ? "#000000" : "#333333",
      fillOpacity: isShadow ? "0.3" : "1",
      fontFamily: "System",
      textAnchor: "middle" as const,
    };

    if (isRTLLanguage()) {
      // For RTL languages, use a different approach to ensure proper text rendering
      // Use a different font family that handles RTL better
      return (
        <SvgText
          {...textProps}
          fontFamily="Arial, sans-serif"
        >
          {text}
        </SvgText>
      );
    } else {
      // For LTR languages, use standard rendering
      return (
        <SvgText
          {...textProps}
        >
          {text}
        </SvgText>
      );
    }
  };
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Listen for refresh triggers
  useEffect(() => {
    if (refreshTrigger > 0 && user) {
      console.log('🔄 Analytics: Refresh triggered, reloading analytics data');
      loadAnalyticsData();
    }
  }, [refreshTrigger, user]);

  const loadUserProfile = async () => {
    try {
      const profile = await authService.getProfile();
      if (profile) {
        setUser(profile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setError('Failed to load user profile');
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };

  const formatCurrency = (amount: number) => {
    try {
      const currency = user?.defaultCurrency || 'USD';
      return currencyService.formatCurrency(amount, currency, currentLanguage);
    } catch (error) {
      console.error('Currency formatting error:', error);
      // Fallback to simple formatting
      return `$${amount.toFixed(2)}`;
    }
  };

  const formatPercentage = (value: number) => {
    const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    // Convert to Persian digits if language is Persian
    if (currentLanguage === 'fa') {
      return toPersianDigits(formatted);
    }
    return formatted;
  };
  
  // Helper function to convert to Persian digits
  const toPersianDigits = (text: string): string => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return text.replace(/[0-9]/g, (digit) => persianDigits[parseInt(digit)]);
  };

  const getSeverityColor = (severity: string) => {
    return analyticsService.getSeverityColor(severity);
  };

  const getTrendEmoji = (direction: string) => {
    return analyticsService.getTrendEmoji(direction);
  };

  const getTrendColor = (direction: string) => {
    return analyticsService.getTrendColor(direction);
  };

  // Professional Custom SVG Pie Chart Renderer
  const renderPieChart = (chart: any) => {
    console.log('Rendering custom SVG pie chart:', chart.title, 'Data:', chart.data);
    
    if (!chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
      return (
        <View style={styles.pieChartNoData}>
          <Text style={styles.pieChartNoDataText}>No expense data available</Text>
        </View>
      );
    }

    // Sort data by value (descending) like web version
    const sortedData = chart.data.sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    const total = sortedData.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

    // SVG Pie Chart Configuration - Larger Size to accommodate category names
    const size = 320; // Increased to fit category names outside
    const center = size / 2;
    const radius = 110;
    const innerRadius = 70;

    // Generate SVG paths for pie slices with percentage labels
    const generatePieSlice = (startAngle: number, endAngle: number, color: string, index: number, percentage: number, label: string) => {
      const startAngleRad = (startAngle * Math.PI) / 180;
      const endAngleRad = (endAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(startAngleRad);
      const y1 = center + radius * Math.sin(startAngleRad);
      const x2 = center + radius * Math.cos(endAngleRad);
      const y2 = center + radius * Math.sin(endAngleRad);
      
      const x3 = center + innerRadius * Math.cos(endAngleRad);
      const y3 = center + innerRadius * Math.sin(endAngleRad);
      const x4 = center + innerRadius * Math.cos(startAngleRad);
      const y4 = center + innerRadius * Math.sin(startAngleRad);
      
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      
      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z'
      ].join(' ');

      // Calculate label position (middle of the slice)
      const midAngle = (startAngle + endAngle) / 2;
      const midAngleRad = (midAngle * Math.PI) / 180;
      const labelRadius = (radius + innerRadius) / 2; // Position between inner and outer radius
      const labelX = center + labelRadius * Math.cos(midAngleRad);
      const labelY = center + labelRadius * Math.sin(midAngleRad);

      // Calculate category name position (outside the pie chart)
      const categoryNameRadius = radius + 25; // Position outside the pie chart
      const categoryNameX = center + categoryNameRadius * Math.cos(midAngleRad);
      const categoryNameY = center + categoryNameRadius * Math.sin(midAngleRad);

      return (
        <G key={index}>
          {/* 3D Shadow layer for depth */}
          <Path
            d={pathData}
            fill={color}
            fillOpacity="0.3"
            stroke="none"
            transform={`translate(2, 2)`}
          />
          {/* Main slice with gradient effect */}
          <Path
            d={pathData}
            fill={color}
            stroke="#ffffff"
            strokeWidth={3}
            strokeOpacity="0.8"
          />
          {/* Highlight layer for 3D effect */}
          <Path
            d={pathData}
            fill="url(#sliceGradient)"
            stroke="none"
          />
          {/* Percentage label on slice with enhanced shadow effect */}
          {percentage >= 5 && ( // Only show label if slice is big enough (>= 5%)
            <G>
              {/* Multiple text shadows for depth */}
              <SvgText
                x={labelX + 2}
                y={labelY + 2}
                fontSize="14"
                fontWeight="700"
                fill="#000000"
                fillOpacity="0.4"
                textAnchor="middle"
              >
                {percentage}%
              </SvgText>
              <SvgText
                x={labelX + 1}
                y={labelY + 1}
                fontSize="14"
                fontWeight="700"
                fill="#000000"
                fillOpacity="0.2"
                textAnchor="middle"
              >
                {percentage}%
              </SvgText>
              {/* Main text with glow effect */}
              <SvgText
                x={labelX}
                y={labelY}
                fontSize="14"
                fontWeight="700"
                fill="#ffffff"
                textAnchor="middle"
                stroke="#ffffff"
                strokeWidth="0.5"
              >
                {percentage}%
              </SvgText>
            </G>
          )}
          
          {/* Category name label outside the pie chart - only for LTR languages */}
          {!isRTLLanguage() && percentage >= 3 && ( // Only show category name if slice is big enough (>= 3%) and not RTL
            <G>
              {/* Text shadow for category name */}
              {renderCategoryNameText(categoryNameX, categoryNameY, label, true)}
              {/* Main category name text */}
              {renderCategoryNameText(categoryNameX, categoryNameY, label, false)}
            </G>
          )}
        </G>
      );
    };

    // Calculate angles for each slice
    let currentAngle = 0;
    const slices = sortedData.map((item: any, index: number) => {
      const percentage = Math.round((item.value / total) * 100);
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const slice = generatePieSlice(startAngle, endAngle, item.color || '#64748b', index, percentage, getTranslatedCategoryName(item.label));
      currentAngle += angle;
      
      return slice;
    });

    return (
      <View style={styles.pieChartWrapper}>
        {/* Professional Pie Chart - No Background Container */}
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {/* Radial gradient for 3D donut effect */}
            <RadialGradient id="donutGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <Stop offset="70%" stopColor="#f8f9fa" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#e9ecef" stopOpacity="0.7" />
            </RadialGradient>
            
            {/* Linear gradient for slice depth */}
            <LinearGradient id="sliceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#000000" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          
          <G>
            {slices}
          </G>
          
          {/* 3D Center circle with gradient */}
          <Circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="url(#donutGradient)"
            stroke="#ffffff"
            strokeWidth={2}
          />
          
          {/* Center text with shadow effect */}
          <SvgText
            x={center + 1}
            y={center - 9}
            fontSize="18"
            fontWeight="600"
            fill="#000000"
            fillOpacity="0.3"
            textAnchor="middle"
          >
            Total
          </SvgText>
          <SvgText
            x={center}
            y={center - 10}
            fontSize="18"
            fontWeight="600"
            fill="#1a1a1a"
            textAnchor="middle"
          >
            Total
          </SvgText>
          
          <SvgText
            x={center + 1}
            y={center + 16}
            fontSize="16"
            fontWeight="500"
            fill="#000000"
            fillOpacity="0.3"
            textAnchor="middle"
          >
            {formatCurrency(total)}
          </SvgText>
          <SvgText
            x={center}
            y={center + 15}
            fontSize="16"
            fontWeight="500"
            fill="#666666"
            textAnchor="middle"
          >
            {formatCurrency(total)}
          </SvgText>
        </Svg>
        
        {/* Category Legend for RTL Languages */}
        {isRTLLanguage() && (
          <View style={styles.categoryLegend}>
            <Text style={styles.legendTitle}>{t('analytics.categories')}</Text>
            <View style={styles.legendContainer}>
              {chart.data.map((item: any, index: number) => {
                if (item.value === 0) return null;
                const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                if (percentage < 1) return null; // Only show categories with at least 1%
                
                return (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>
                      {getTranslatedCategoryName(item.label || t('categories.other'))} ({percentage}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  // Real chart rendering matching web version
  const renderChart = (chart: any) => {
    console.log('Rendering chart:', chart.title, 'Type:', chart.chart_type);
    
    const chartConfig = {
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      color: (opacity = 1) => `rgba(26, 26, 26, ${opacity})`,
      strokeWidth: 2,
      barPercentage: 0.5,
      useShadowColorFromDataset: false,
      decimalPlaces: 0,
      formatYLabel: (value: string) => {
        try {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return value;
          // Use the proper currency formatting
          return formatCurrency(numValue);
        } catch (error) {
          console.error('Chart formatting error:', error);
          return value;
        }
      },
      // Improved text styling for better readability
      propsForLabels: {
        fontSize: 10,
        fontFamily: 'System',
      },
      propsForDots: {
        r: '4',
        strokeWidth: '2',
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#e0e0e0',
        strokeWidth: 1,
      },
    };

    // Handle different data structures from backend
    let chartData = null;
    
    try {
      if (chart.data) {
        if (Array.isArray(chart.data)) {
          // Direct array data for PieChart - sort by spending amount (descending)
          const sortedData = chart.data.sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
          const total = sortedData.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
          
          chartData = sortedData.map((item: any) => {
            const percentage = total > 0 ? Math.round(((item.value || 0) / total) * 100) : 0;
            // Shorten category names for better display on pie slices
            const translatedLabel = getTranslatedCategoryName(item.label || t('categories.other'));
            const shortName = translatedLabel.length > 6 
              ? translatedLabel.substring(0, 6) + '...'
              : translatedLabel;
            
            return {
              name: `${shortName}\n${percentage}%`,
              population: item.value || 0,
              color: item.color || '#3b82f6',
              legendFontColor: '#333333',
              legendFontSize: 11,
            };
          });
          console.log('PieChart data (sorted by spending):', chartData);
        } else if (chart.data.labels && chart.data.datasets) {
          // Chart.js style data structure for BarChart/LineChart
          const labels = chart.data.labels || [];
          const values = chart.data.datasets?.[0]?.data || [];
          
          if (chart.chart_type === 'doughnut') {
            // Convert to PieChart format - sort by spending amount (descending)
            const total = values.reduce((sum: number, val: number) => sum + (val || 0), 0);
            
            const dataWithColors = labels.map((label: string, index: number) => {
              const colors = chart.data.datasets?.[0]?.backgroundColor || chart.data.datasets?.[0]?.pointBackgroundColor || [];
              const color = Array.isArray(colors) ? colors[index] : colors || '#3b82f6';
              const percentage = total > 0 ? Math.round(((values[index] || 0) / total) * 100) : 0;
              
              // Shorten category names for better display on pie slices
              const shortName = label.length > 6 ? label.substring(0, 6) + '...' : label;
              
              return {
                name: `${shortName}\n${percentage}%`,
                population: values[index] || 0,
                color: color,
                legendFontColor: '#333333',
                legendFontSize: 11,
              };
            });
            
            // Sort by spending amount (descending) - highest spending first
            chartData = dataWithColors.sort((a: any, b: any) => b.population - a.population);
            console.log('Doughnut data (sorted by spending):', chartData);
          } else {
            // BarChart/LineChart format
            const colors = chart.data.datasets?.[0]?.backgroundColor || [];
            const borderColors = chart.data.datasets?.[0]?.borderColor || colors;
            
            if (chart.chart_type === 'bar') {
              // For BarChart, create individual datasets for each bar with its own color
              const datasets = values.map((value: number, index: number) => {
                const color = Array.isArray(colors) ? colors[index] : colors;
                const barColor = typeof color === 'string' ? color : '#3b82f6';
                
                // Create an array with zeros except for the current bar
                const barData = new Array(values.length).fill(0);
                barData[index] = value;
                
                return {
                  data: barData,
                  color: (opacity = 1) => barColor,
                  strokeWidth: 0
                };
              });
              
              chartData = {
                labels: labels,
                datasets: datasets
              };
            } else {
              // For LineChart, use single dataset
              chartData = {
                labels: labels,
                datasets: [{
                  data: values,
                  color: (opacity = 1) => {
                    const defaultColor = Array.isArray(borderColors) ? borderColors[0] : borderColors;
                    return typeof defaultColor === 'string' ? defaultColor : `rgba(59, 130, 246, ${opacity})`;
                  },
                  strokeWidth: 2
                }]
              };
            }
            console.log('Bar/Line data:', chartData);
          }
        }
      }
    } catch (error) {
      console.error('Chart data processing error:', error);
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
          <View style={styles.chartNoData}>
            <Text style={styles.chartNoDataText}>{t('analytics.chartError')}</Text>
          </View>
        </View>
      );
    }

    // If no chart data, don't render anything
    if (!chartData || (chartData.datasets && chartData.datasets.length === 0) || (Array.isArray(chartData) && chartData.length === 0)) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
          <View style={styles.chartNoData}>
            <Text style={styles.chartNoDataText}>{t('analytics.noDataAvailable')}</Text>
          </View>
        </View>
      );
    }

    const chartWidth = screenWidth - 60;
    const chartHeight = 200;

    switch (chart.chart_type) {
      case 'doughnut':
        try {
          return (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
              {chart.subtitle && (
                <Text style={{fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 10}}>
                  {getTranslatedChartSubtitle(chart.subtitle)}
                </Text>
              )}
              <View style={styles.chartWrapper}>
                <PieChart
                  data={chartData}
                  width={chartWidth}
                  height={chartHeight}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  center={[10, 0]}
                  absolute={false}
                  hasLegend={true}
                  chartConfig={{
                    ...chartConfig,
                    propsForLabels: {
                      fontSize: 9,
                      fontFamily: 'System',
                      fontWeight: '700',
                      fill: '#FFFFFF',
                    },
                  }}
                />
              </View>
            </View>
          );
        } catch (error) {
          console.error('PieChart rendering error:', error);
          return (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
              <View style={styles.chartNoData}>
                <Text style={styles.chartNoDataText}>{t('analytics.pieChartError')}</Text>
              </View>
            </View>
          );
        }

      case 'bar':
        // Skip bar charts for mobile version - only show on web
        return null;

      case 'line':
      case 'area':
        try {
          return (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
              {chart.subtitle && (
                <Text style={{fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 10}}>
                  {getTranslatedChartSubtitle(chart.subtitle)}
                </Text>
              )}
              <View style={styles.chartWrapper}>
                <LineChart
                  data={chartData}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={{
                    ...chartConfig,
                    fillShadowGradient: chart.chart_type === 'area' ? '#3b82f6' : 'transparent',
                    fillShadowGradientOpacity: chart.chart_type === 'area' ? 0.2 : 0
                  }}
                  bezier={true}
                  style={styles.chart}
                  withInnerLines={false}
                  withOuterLines={true}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                />
              </View>
            </View>
          );
        } catch (error) {
          console.error('LineChart rendering error:', error);
          return (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
              <View style={styles.chartNoData}>
                <Text style={styles.chartNoDataText}>{t('analytics.lineChartError')}</Text>
              </View>
            </View>
          );
        }

      default:
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{getTranslatedChartTitle(chart.title) || t('analytics.financialAnalysisCharts')}</Text>
            <View style={styles.chartNoData}>
              <Text style={styles.chartNoDataText}>{t('analytics.unsupportedChartType', { type: chart.chart_type })}</Text>
            </View>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('analytics.title')}</Text>
          <Text style={styles.subtitle}>{t('analytics.financialAnalytics')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>{t('analytics.loading')}</Text>
        </View>
        <BottomNavigation 
          activeRoute={activeRoute} 
          onNavigate={handleNavigate}
          onAddExpense={onAddExpense}
          onSettings={onSettings}
        />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('analytics.title')}</Text>
          <Text style={styles.subtitle}>{t('analytics.financialAnalytics')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{t('analytics.errorLoadingAnalytics')}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalyticsData}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
        <BottomNavigation 
          activeRoute={activeRoute} 
          onNavigate={handleNavigate}
          onAddExpense={onAddExpense}
          onSettings={onSettings}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics.title')}</Text>
        <Text style={styles.subtitle}>{t('analytics.financialAnalytics')}</Text>
        
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                {t(`analytics.${period}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {overview ? (
          <>

            {/* Professional Pie Chart Section - Top Priority */}
            {overview.charts && overview.charts.length > 0 && (
              <View style={styles.chartsSection}>
                <Text style={styles.sectionTitle}>{t('analytics.expenseDistributionByCategory')}</Text>
                {overview.charts
                  .filter(chart => chart.chart_type === 'doughnut')
                  .map((chart, index) => (
                    <View key={index} style={styles.pieChartContainer}>
                      {renderPieChart(chart)}
                    </View>
                  ))}
              </View>
            )}

            {/* Professional Charts Section */}
            {overview.charts && overview.charts.length > 0 && (
              <View style={styles.chartsSection}>
                <Text style={styles.sectionTitle}>{t('analytics.spendingTrends')}</Text>
                {overview.charts
                  .filter(chart => chart.chart_type === 'line' || chart.chart_type === 'area')
                  .map((chart, index) => (
                    <View key={index} style={styles.chartWrapper}>
                      {renderChart(chart)}
                    </View>
                  ))}
              </View>
            )}



            {/* Overview Cards - Horizontal Layout */}
            <View style={styles.overviewSection}>
              <Text style={styles.sectionTitle}>{t('analytics.monthlyOverview')}</Text>
              
              {/* Total Expenses Card - Full Width Row */}
              <View style={styles.horizontalCard}>
                <View style={styles.horizontalCardContent}>
                  <Text style={styles.horizontalCardLabel}>{t('analytics.totalExpenses')}</Text>
                  <Text style={styles.horizontalCardValue}>{formatCurrency(overview.total_expenses || 0)}</Text>
                  <Text style={styles.horizontalCardPeriod}>{t('analytics.thisMonth')}</Text>
                </View>
              </View>

              {/* Transactions Card - Full Width Row */}
              <View style={styles.horizontalCard}>
                <View style={styles.horizontalCardContent}>
                  <Text style={styles.horizontalCardLabel}>{t('analytics.totalTransactions')}</Text>
                  <Text style={styles.horizontalCardValue}>{overview.transaction_count || 0}</Text>
                  <Text style={styles.horizontalCardPeriod}>{t('analytics.thisMonth')}</Text>
                </View>
              </View>

              {/* Daily Average Card - Full Width Row */}
              <View style={styles.horizontalCard}>
                <View style={styles.horizontalCardContent}>
                  <Text style={styles.horizontalCardLabel}>{t('analytics.dailyAverage')}</Text>
                  <Text style={styles.horizontalCardValue}>{formatCurrency(overview.average_daily_spending || 0)}</Text>
                  <Text style={styles.horizontalCardPeriod}>{t('analytics.averagePerDay')}</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataIcon}>📊</Text>
            <Text style={styles.noDataTitle}>{t('analytics.errorLoadingAnalytics')}</Text>
            <Text style={styles.noDataText}>
              {t('analytics.noDataMessage')}
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomNavigation 
        activeRoute={activeRoute} 
        onNavigate={handleNavigate}
        onAddExpense={onAddExpense}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 3,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  periodButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
  },
  periodButtonTextActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  overviewSection: {
    padding: 20,
    paddingBottom: 100, // Extra space for bottom navigation
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  horizontalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  horizontalCardContent: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horizontalCardLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    flex: 1,
  },
  horizontalCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'right',
    marginRight: 8,
  },
  horizontalCardPeriod: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    minWidth: 80,
  },
  insightIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  chartsSection: {
    padding: 20,
  },
  pieChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  customPieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  pieChartLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  pieChartNoData: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  pieChartNoDataText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'visible',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
    overflow: 'visible',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartNoData: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartNoDataText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  simpleChart: {
    padding: 16,
  },
  chartItem: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  chartItemValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  chartItemBar: {
    height: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginTop: 8,
  },
  chartItemProgress: {
    height: '100%',
    borderRadius: 8,
    minWidth: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trendsSection: {
    padding: 20,
  },
  trendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  trendInfo: {
    flex: 1,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  trendChange: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  trendStrength: {
    fontSize: 14,
    color: '#666666',
  },
  categoryBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgress: {
    height: '100%',
    borderRadius: 2,
  },
  insightsSection: {
    padding: 20,
    paddingBottom: 100, // Extra space for bottom navigation
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100,
  },
  noDataIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  categoryLegend: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
});

export default Analytics;