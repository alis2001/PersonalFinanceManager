import React, { useState } from 'react';
import type { Category } from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';
import { getTranslatedCategoryName, buildCategoryTreeForSelector, isLeafCategory } from '../utils/categoryUtils';
import '../styles/CategoryTreeSelector.css';

interface CategoryTreeSelectorProps {
  categories: Category[];
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const CategoryTreeSelector: React.FC<CategoryTreeSelectorProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect,
  disabled = false,
  placeholder = 'Select Category'
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  const toggleCategoryExpansion = (categoryId: string) => {
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

  const handleCategoryClick = (category: Category, event: React.MouseEvent) => {
    event.stopPropagation();
    // Only allow selection of leaf categories (categories without subcategories)
    if (isLeafCategory(category, categories)) {
      onCategorySelect(category.id);
      setIsOpen(false);
    } else {
      // If it has subcategories, toggle expansion instead
      toggleCategoryExpansion(category.id);
    }
  };

  const renderCategoryTree = (category: Category & { children: Category[] }, level: number = 0): JSX.Element => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const isLeaf = isLeafCategory(category, categories);
    const isSelected = selectedCategoryId === category.id;

    return (
      <div key={category.id} className="category-tree-item">
        <div 
          className={`category-tree-node ${isSelected ? 'selected' : ''} ${isLeaf ? 'selectable' : 'non-selectable'}`}
          onClick={(e) => handleCategoryClick(category, e)}
        >
          <div className="category-item-content" style={{ marginLeft: `${level * 20}px` }}>
            <div className="category-tree-controls">
              {hasChildren && (
                <button
                  className="tree-expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategoryExpansion(category.id);
                  }}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!hasChildren && <div className="tree-spacer" />}
            </div>
            
            <div className="category-info">
              <div 
                className="category-icon-small"
                style={{ backgroundColor: category.color + '20', color: category.color }}
              >
                {category.icon}
              </div>
              <span className="category-name">
                {getTranslatedCategoryName(category.name, t)}
              </span>
              {!isLeaf && (
                <span className="non-selectable-indicator">
                  {t('categories.hasSubcategories')}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="category-children">
            {category.children?.map(child => renderCategoryTree(child as Category & { children: Category[] }, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const categoryTree = buildCategoryTreeForSelector(categories, t);

  return (
    <div className="category-tree-selector">
      <div 
        className={`category-selector-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {selectedCategory ? (
          <div className="selected-category">
            <div 
              className="category-icon-small"
              style={{ backgroundColor: selectedCategory.color + '20', color: selectedCategory.color }}
            >
              {selectedCategory.icon}
            </div>
            <span className="selected-category-name">
              {getTranslatedCategoryName(selectedCategory.name, t)}
            </span>
          </div>
        ) : (
          <span className="placeholder">{t(placeholder)}</span>
        )}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      
      {isOpen && (
        <div className="category-tree-dropdown">
          <div className="category-tree-header">
            <span className="tree-header-text">{t('categories.selectLeafCategory')}</span>
          </div>
          <div className="category-tree-content">
            {categoryTree.length === 0 ? (
              <div className="no-categories">
                <span>{t('categories.noCategoriesAvailable')}</span>
              </div>
            ) : (
              categoryTree.map(category => renderCategoryTree(category))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryTreeSelector;
