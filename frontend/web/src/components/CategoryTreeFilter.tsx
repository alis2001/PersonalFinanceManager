import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { getTranslatedCategoryName, buildCategoryTreeForSelector } from '../utils/categoryUtils';
import type { Category } from '../services/categoryService';
import '../styles/CategoryTreeFilter.css';

interface CategoryTreeFilterProps {
  categories: Category[];
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
  placeholder?: string;
}

const CategoryTreeFilter: React.FC<CategoryTreeFilterProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect,
  placeholder = 'Select category'
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const categoryTree = buildCategoryTreeForSelector(categories, t);
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

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

  const handleCategorySelect = (categoryId: string) => {
    onCategorySelect(categoryId);
    setIsOpen(false);
  };

  const renderCategoryTree = (categoryTree: Array<Category & { children: Category[] }>, level: number = 0) => {
    return categoryTree.map((category) => (
      <div key={category.id} className="category-tree-node">
        <div 
          className={`category-tree-item ${selectedCategoryId === category.id ? 'selected' : ''}`}
          onClick={() => handleCategorySelect(category.id)}
        >
          <div className="category-item-content" style={{ paddingLeft: `${level * 20 + 8}px` }}>
            {category.children.length > 0 && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(category.id);
                }}
              >
                {expandedCategories.has(category.id) ? '▼' : '▶'}
              </button>
            )}
            {category.children.length === 0 && <span className="expand-spacer" />}
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">
              {getTranslatedCategoryName(category.name, t)}
            </span>
            {category.children.length > 0 && (
              <span className="subcategory-indicator">
                {t('hasSubcategories')} ({category.children.length})
              </span>
            )}
          </div>
        </div>
        
        {category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="category-children">
            {renderCategoryTree(category.children as (Category & { children: Category[] })[], level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="category-tree-filter">
      <div 
        className="category-filter-dropdown"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="selected-category">
          {selectedCategory ? (
            <>
              <span className="category-icon">{selectedCategory.icon}</span>
              <span className="category-name">
                {getTranslatedCategoryName(selectedCategory.name, t)}
              </span>
            </>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <>
          <div className="category-tree-overlay" onClick={() => setIsOpen(false)} />
          <div className="category-tree-popup">
            <div className="category-tree-header">
              <h3>{t('transactions.selectCategory')}</h3>
              <button 
                className="close-button"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="category-tree-content">
              <div 
                className={`category-tree-item ${selectedCategoryId === '' ? 'selected' : ''}`}
                onClick={() => handleCategorySelect('')}
              >
                <span className="expand-spacer" />
                <span className="category-icon">🏷️</span>
                <span className="category-name">{t('transactions.allCategories')}</span>
              </div>
              {renderCategoryTree(categoryTree)}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryTreeFilter;
