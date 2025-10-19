import React, { useState, useEffect } from 'react';
// Icons replaced with emojis

interface CategoryData {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  parent_id?: string;
  level: number;
  path: string;
  path_ids: string[];
  total_amount: number;
  percentage_of_total: number;
  transaction_count: number;
  children: CategoryData[];
}

interface HierarchicalAnalyticsProps {
  period: string;
  onPeriodChange: (period: string) => void;
}

const HierarchicalAnalytics: React.FC<HierarchicalAnalyticsProps> = ({
  period,
  onPeriodChange
}) => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);

  useEffect(() => {
    loadHierarchicalData();
  }, [period]);

  const loadHierarchicalData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/hierarchical?period=${period}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.hierarchical_categories || []);
        // Auto-expand first level
        const firstLevelIds = result.hierarchical_categories
          ?.filter((cat: CategoryData) => cat.level === 1)
          ?.map((cat: CategoryData) => cat.id) || [];
        setExpandedCategories(new Set(firstLevelIds));
      } else {
        setError(result.error || 'Failed to load analytics data');
      }
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Error loading hierarchical analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTrendIcon = (percentage: number) => {
    if (percentage > 20) return <span className="text-green-500">📈</span>;
    if (percentage < 5) return <span className="text-red-500">📉</span>;
    return null;
  };

  const renderCategoryNode = (category: CategoryData, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const indentLevel = level * 20;

    return (
      <div key={category.id} className="category-node">
        <div
          className={`
            flex items-center py-3 px-4 rounded-lg transition-all duration-200 cursor-pointer
            hover:bg-gray-50 border-l-4
          `}
          style={{ 
            marginLeft: `${indentLevel}px`,
            borderLeftColor: category.color
          }}
          onClick={() => {
            setSelectedCategory(category);
            if (hasChildren) {
              toggleExpanded(category.id);
            }
          }}
        >
          {/* Expand/Collapse Button */}
          <div className="flex items-center w-6">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(category.id);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : null}
          </div>

          {/* Category Icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white mr-3"
            style={{ backgroundColor: category.color }}
          >
            {category.icon}
          </div>

          {/* Category Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {category.description}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-4">
                {getTrendIcon(category.percentage_of_total)}
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(category.total_amount)}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-2 flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(category.percentage_of_total, 100)}%`,
                    backgroundColor: category.color
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 min-w-0">
                {category.percentage_of_total.toFixed(1)}%
              </span>
            </div>
            
            {/* Transaction Count */}
            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span>Level {category.level}</span>
              <span>{category.transaction_count} transactions</span>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4 mt-2 space-y-1">
            {category.children.map(child => renderCategoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading hierarchical analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button
              onClick={loadHierarchicalData}
              className="mt-2 text-sm text-red-600 hover:text-red-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = data.reduce((sum, cat) => sum + cat.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            💰
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Expenses</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            📊
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Categories</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            📈
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Top Category</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.length > 0 ? data[0].name : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchical Tree */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Category Spending Breakdown
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Click on categories to expand and see sub-category spending
          </p>
        </div>

        <div className="p-4">
          {data.length === 0 ? (
            <div className="text-center py-8">
              📊
              <h3 className="mt-2 text-sm font-medium text-gray-900">No spending data</h3>
              <p className="mt-1 text-sm text-gray-500">
                No expenses found for the selected period
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.map(category => renderCategoryNode(category))}
            </div>
          )}
        </div>
      </div>

      {/* Category Details */}
      {selectedCategory && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Category Details
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedCategory.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatCurrency(selectedCategory.total_amount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Percentage</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.percentage_of_total.toFixed(1)}%
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Transactions</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedCategory.transaction_count}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchicalAnalytics;
