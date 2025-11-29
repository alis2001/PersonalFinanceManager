import React, { useState, useEffect } from 'react';
import type { Category } from '../services/categoryService';
import '../styles/CategoryContextMenu.css';

interface CategoryContextMenuProps {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleActive: (category: Category) => void;
  onAddSubcategory: (category: Category) => void;
  hasExpenses?: boolean;
  t: (key: string) => string;
}

const CategoryContextMenu: React.FC<CategoryContextMenuProps> = ({
  visible,
  category,
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onAddSubcategory,
  hasExpenses = false,
  t,
}) => {
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);

  // Reset delete confirm mode when menu becomes visible or category changes
  useEffect(() => {
    if (visible) {
      setIsDeleteConfirmMode(false);
    }
  }, [visible, category?.id]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };
    
    if (visible) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [visible, onClose]);

  if (!category || !visible) return null;

  // Base menu items - conditionally include subcategory option
  const baseMenuItems = [
    {
      icon: '✏️',
      label: t('common.edit'),
      action: () => {
        onEdit(category);
        onClose();
      },
      color: '#2196f3',
    },
    // Only show "Add Subcategory" if category doesn't have expenses
    ...(hasExpenses ? [] : [{
      icon: '➕',
      label: t('categories.addSubcategory'),
      action: () => {
        onAddSubcategory(category);
        onClose();
      },
      color: '#4caf50',
    }]),
    {
      icon: category.is_active ? '⏸️' : '▶️',
      label: category.is_active ? t('categories.deactivate') : t('categories.activate'),
      action: () => {
        onToggleActive(category);
        onClose();
      },
      color: category.is_active ? '#ff9800' : '#4caf50',
    },
  ];

  // Delete-related menu items based on confirmation state
  const deleteMenuItems = isDeleteConfirmMode ? [
    {
      icon: '✅',
      label: t('categories.confirmDelete'),
      action: () => {
        onDelete(category.id);
        onClose();
      },
      color: '#ff5722',
    },
    {
      icon: '❌',
      label: t('common.cancel'),
      action: () => {
        setIsDeleteConfirmMode(false);
      },
      color: '#757575',
    },
  ] : [
    {
      icon: '🗑️',
      label: t('common.delete'),
      action: () => {
        setIsDeleteConfirmMode(true);
      },
      color: '#f44336',
    },
  ];

  const menuItems = [...baseMenuItems, ...deleteMenuItems];

  return (
    <div className="category-context-menu-overlay" onClick={onClose}>
      <div className="category-context-menu-container" onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div 
          className={`category-context-menu-header ${isDeleteConfirmMode ? 'delete-mode' : ''}`}
        >
          <div className="category-context-menu-header-content">
            <div 
              className="category-context-menu-indicator"
              style={{ backgroundColor: isDeleteConfirmMode ? '#ff5722' : (category.color || '#4A90E2') }}
            />
            <h3 className="category-context-menu-title">
              {isDeleteConfirmMode 
                ? `${t('common.delete')} "${category.name}"?` 
                : `${category.name}${!category.is_active ? ` (${t('categories.inactive')})` : ''}`
              }
            </h3>
          </div>
          <button
            className="category-context-menu-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Menu items */}
        <div className="category-context-menu-content">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="category-context-menu-item"
              onClick={item.action}
            >
              <div 
                className="category-context-menu-icon"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <span style={{ color: item.color }}>{item.icon}</span>
              </div>
              <span className="category-context-menu-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryContextMenu;

