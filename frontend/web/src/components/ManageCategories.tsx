import React, { useState, useEffect } from 'react';
import { useMode } from '../contexts/ModeContext';
import categoryService from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';
import type { Category } from '../services/categoryService';
import { getTranslatedCategoryName, getHierarchicalCategoryName, isLeafCategory } from '../utils/categoryUtils';
import CategoryContextMenu from './CategoryContextMenu';
import '../styles/ManageCategories.css';

interface ManageCategoriesProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  type: 'expense' | 'income' | 'both';
  is_active: boolean;
  parent_id?: string;
}


const predefinedIcons = [
  '🍽️', '🚗', '🛍️', '🎬', '📄', '❤️', '📚', '✈️', '🏠', '✨', 
  '🎁', '💼', '🎯', '⚡', '📊', '💡', '🎨', '🎵', '🏃‍♂️', '☕',
  '📱', '💻', '🚀', '🌟', '🔧', '🎉', '💰', '📈', '🎮', '🌍'
];

const predefinedColors = [
  '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#85C1E9', '#F8C471', '#A9DFBF', '#F7DC6F', '#BB8FCE', '#82E0AA',
  '#AED6F1', '#F9E79F', '#D7BDE2', '#A3E4D7', '#FADBD8', '#D5DBDB'
];

interface MergePreview {
  sourceCategory: { id: string; name: string; level: number };
  targetCategory: { id: string; name: string; level: number };
  transactionsToMove: number;
  expenseCount: number;
  incomeCount: number;
  hasSubcategories: boolean;
}

const ManageCategories: React.FC<ManageCategoriesProps> = ({ 
  isOpen, 
  onClose, 
  onCategoriesUpdated 
}) => {
  const { t } = useTranslation();
  const { mode, isExpenseMode } = useMode();
  const [categories, setCategories] = useState<Category[]>([]);


  // Function to translate category types
  const getTranslatedCategoryType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'expense': t('categories.expense'),
      'income': t('categories.income'),
      'both': t('categories.both'),
    };
    return typeMap[type] || type;
  };

  // Function to translate category descriptions
  const getTranslatedCategoryDescription = (categoryName: string): string => {
    const descriptionMap: { [key: string]: string } = {
      'Bills & Utilities': t('categories.billsUtilitiesDesc'),
      'Food & Dining': t('categories.foodDiningDesc'),
      'Transportation': t('categories.transportationDesc'),
      'Shopping': t('categories.shoppingDesc'),
      'Entertainment': t('categories.entertainmentDesc'),
      'Healthcare': t('categories.healthcareDesc'),
      'Education': t('categories.educationDesc'),
      'Travel': t('categories.travelDesc'),
      'Groceries': t('categories.groceriesDesc'),
      'Gas': t('categories.gasDesc'),
      'Insurance': t('categories.insuranceDesc'),
      'Other': t('categories.otherDesc'),
      'Business': t('categories.businessDesc'),
      'Business Income': t('categories.businessIncomeDesc'),
      'Freelance': t('categories.freelanceDesc'),
      'Gifts & Bonuses': t('categories.giftsBonusesDesc'),
      'Gifts & Donations': t('categories.giftsDonationsDesc'),
      'Home & Garden': t('categories.homeGardenDesc'),
      'Investment Returns': t('categories.investmentReturnsDesc'),
      'Other Expenses': t('categories.otherExpensesDesc'),
      'Other Income': t('categories.otherIncomeDesc'),
      'Personal Care': t('categories.personalCareDesc'),
      'Rental Income': t('categories.rentalIncomeDesc'),
      'Work': t('categories.workDesc'),
    };
    return descriptionMap[categoryName] || '';
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4A90E2',
    icon: '💰',
    type: 'expense',
    is_active: true,
    parent_id: undefined
  });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryExpenseStatus, setCategoryExpenseStatus] = useState<Record<string, boolean>>({});
  
  // Merge Categories Interface State
  const [showMergeInterface, setShowMergeInterface] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<Category | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<Category | null>(null);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [showConfirmMerge, setShowConfirmMerge] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuCategory, setContextMenuCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      resetMessages();
    }
  }, [isOpen, mode]);

  // Update formData type when mode changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      type: mode
    }));
  }, [mode]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      // Load categories based on current mode
      const result = await categoryService.getCategories({ 
        type: mode, // Filter by current mode (expense or income)
        active: undefined 
      });
      if (result.success && result.categories) {
        setCategories(result.categories);
        
        // Load expense status for each category (like mobile version)
        const expenseStatusPromises = result.categories.map(async (category) => {
          const usage = await categoryService.checkCategoryUsage(category.id);
          if (usage.success) {
            return {
              categoryId: category.id,
              hasExpenses: usage.hasExpenses === true
            };
          } else {
            console.error('Failed to check usage for category:', category.id, usage.error);
            return {
              categoryId: category.id,
              hasExpenses: false // Default to allowing subcategory creation on error
            };
          }
        });
        
        const expenseStatusResults = await Promise.all(expenseStatusPromises);
        const expenseStatusMap = expenseStatusResults.reduce((acc, { categoryId, hasExpenses }) => {
          acc[categoryId] = hasExpenses;
          return acc;
        }, {} as Record<string, boolean>);
        
        setCategoryExpenseStatus(expenseStatusMap);
      } else {
        setError(t('categories.failedToLoadCategories'));
      }
    } catch (err) {
        setError(t('categories.failedToLoadCategories'));
    }
    setLoading(false);
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  // Category Merge Handlers
  const handleDragStart = (e: React.DragEvent, category: Category) => {
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', category.id);
  };

  const handleDragOver = (e: React.DragEvent, category: Category) => {
    e.preventDefault();
    
    // Check if target category is a parent (has children) - can't merge into parent categories
    const hasChildren = categories.some(cat => cat.parent_id === category.id);
    
    if (hasChildren) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!draggedCategory || draggedCategory.id === targetCategory.id) {
      console.log('🚫 Drop cancelled: same category or no dragged category');
      return;
    }

    // CRITICAL: Check if target category is a parent (has children) - CANNOT merge into parent categories
    const targetHasChildren = categories.some(cat => cat.parent_id === targetCategory.id);
    if (targetHasChildren) {
      console.log('🚫 Drop cancelled: cannot merge into parent category');
      setError(t('categories.cannotMergeIntoParentCategory'));
      setDraggedCategory(null);
      return;
    }

    console.log('🔄 DROP: Attempting to merge', draggedCategory.name, '→', targetCategory.name);

    try {
      setMergeLoading(true);
      
      // Preview the merge first
      console.log('📋 Requesting merge preview...');
      const preview = await categoryService.previewMerge(draggedCategory.id, targetCategory.id);
      
      console.log('📋 Preview response:', preview);
      
      if (preview.success && preview.canMerge) {
        console.log('✅ Merge preview successful, showing confirmation');
        setMergePreview(preview.preview);
        setShowConfirmMerge(true);
      } else {
        console.log('❌ Cannot merge:', preview.message);
        setError(preview.message || 'Cannot merge these categories');
      }
    } catch (err: any) {
      console.error('❌ Merge preview error:', err);
      setError(err.message || 'Failed to preview merge');
    } finally {
      setMergeLoading(false);
      setDraggedCategory(null);
    }
  };

  const handleExecuteMerge = async () => {
    if (!mergePreview) {
      console.log('❌ No merge preview available');
      return;
    }

    console.log('🚀 EXECUTING MERGE:', mergePreview.sourceCategory.name, '→', mergePreview.targetCategory.name);

    try {
      setMergeLoading(true);
      
      const result = await categoryService.executeMerge(
        mergePreview.sourceCategory.id,
        mergePreview.targetCategory.id
      );

      console.log('🚀 Merge execution result:', result);

      if (result.success) {
        console.log('✅ Merge successful!');
        setSuccess(`Merged "${mergePreview.sourceCategory.name}" into "${mergePreview.targetCategory.name}" successfully!`);
        setShowConfirmMerge(false);
        setMergePreview(null);
        setShowMergeInterface(false);
        loadCategories();
        onCategoriesUpdated();
      } else {
        console.log('❌ Merge failed:', result.error);
        setError(result.error || 'Failed to merge categories');
      }
    } catch (err: any) {
      console.error('❌ Merge execution error:', err);
      setError(err.message || 'Failed to merge categories');
    } finally {
      setMergeLoading(false);
    }
  };

  const handleCancelMerge = () => {
    setShowConfirmMerge(false);
    setMergePreview(null);
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  const getDefaultFormData = (): CategoryFormData => ({
    name: '',
    description: '',
    color: '#4A90E2',
    icon: '💰',
    type: mode, // Use current mode
    is_active: true,
    parent_id: undefined
  });

  const resetForm = () => {
    setFormData(getDefaultFormData());
    setEditingCategory(null);
    setShowForm(false);
    setExpandedCategories(new Set());
  };

  // Build hierarchical tree structure
  const buildCategoryTree = (categories: Category[]) => {
    const map = new Map<string, Category & { children: Category[] }>();
    const roots: (Category & { children: Category[] })[] = [];
    
    // Create map with empty children arrays
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });
    
    // Build tree structure
    categories.forEach(cat => {
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children.push(map.get(cat.id)!);
        }
      } else {
        roots.push(map.get(cat.id)!);
      }
    });
    
    return roots;
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Get root categories that can be parents (excluding the current category being edited)
  const getRootCategories = () => {
    return categories.filter(cat => 
      !cat.parent_id && 
      cat.is_active && 
      (!editingCategory || cat.id !== editingCategory.id)
    );
  };

  // Get all categories that can be parents (excluding the current category being edited and its descendants)
  // 🚫 CRITICAL FIX: Also exclude categories that have expenses/income (they must remain leaf categories)
  const getAvailableParents = () => {
    return categories.filter(cat => 
      cat.is_active && 
      (!editingCategory || (
        cat.id !== editingCategory.id && 
        !editingCategory.path_ids.includes(cat.id) // Prevent setting parent to descendant
      )) &&
      !categoryExpenseStatus[cat.id] // 🚫 CRITICAL: Exclude categories with expenses/income
    );
  };

  const renderCategoryTree = (category: Category & { children: Category[] }, level: number = 0): JSX.Element => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    
    return (
      <div key={category.id} className="category-tree-item">
        <div 
          className={`category-card ${!category.is_active ? 'inactive' : ''}`}
        >
          <div className="category-header">
            <div className="category-tree-controls">
              {hasChildren && (
                <button
                  className="tree-expand-btn"
                  onClick={() => toggleCategoryExpansion(category.id)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!hasChildren && <div className="tree-spacer" />}
            </div>
            
            <div 
              className="category-icon"
              style={{ backgroundColor: category.color + '20', color: category.color }}
            >
              {category.icon}
            </div>
            <div className="category-info">
              <h4>{getHierarchicalCategoryName(category, categories, t)}</h4>
                        <span className={`type-badge ${category.type}`}>
                          {t(`categories.types.${category.type}`)}
                        </span>
              {category.level > 1 && (
                <span className="level-badge">Level {category.level}</span>
              )}
            </div>
          </div>
          
          <div className="category-actions">
            {/* Context Menu Button - All actions organized in one beautiful menu */}
            <button 
              className="btn-context-menu"
              onClick={() => handleContextMenu(category)}
              disabled={formLoading}
              aria-label="Category options"
              title={t('common.options') || 'Options'}
            >
              ⋮
            </button>
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleIconSelect = (icon: string) => {
    setFormData(prev => ({ ...prev, icon }));
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(t('categories.categoryNameRequired'));
      return;
    }

    setFormLoading(true);
    resetMessages();

    try {
      let result;
      if (editingCategory) {
        result = await categoryService.updateCategory(editingCategory.id, formData);
      } else {
        result = await categoryService.createCategory(formData);
      }

      if (result.success) {
        setSuccess(result.message || t(editingCategory ? 'categories.categoryUpdated' : 'categories.categoryAdded'));
        resetForm();
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || t('categories.operationFailed'));
      }
    } catch (err) {
      setError(t('categories.operationFailedTryAgain'));
    }

    setFormLoading(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#4A90E2',
      icon: category.icon || '💰',
      type: category.type,
      is_active: category.is_active,
      parent_id: category.parent_id
    });
    setShowForm(true);
    resetMessages();
  };

  const handleAddSubcategory = async (parentCategory: Category) => {
    // Double-check if parent category has expenses (like mobile version)
    const usage = await categoryService.checkCategoryUsage(parentCategory.id);
    
    if (usage.success && usage.hasExpenses) {
      // Cannot add subcategory to category with expenses
      setError(t('categories.cannotAddSubcategoryWithExpenses'));
      return;
    }
    
    // Proceed with adding subcategory
    setEditingCategory(null);
    setFormData({
      ...getDefaultFormData(),
      parent_id: parentCategory.id
    });
    setShowForm(true);
    resetMessages();
  };

  const handleDelete = async (categoryId: string) => {
    try {
      // Check if category has children
      const category = categories.find(cat => cat.id === categoryId);
      const hasChildren = categories.some(cat => cat.parent_id === categoryId);
      
      if (hasChildren) {
        // Show error - cannot delete parent categories
        const subcategoryCount = categories.filter(cat => cat.parent_id === categoryId).length;
        setError(t('categories.cannotDeleteParentCategory', { 
          categoryName: getTranslatedCategoryName(category?.name || '', t),
          subcategoryCount: subcategoryCount
        }));
        handleCloseContextMenu();
        return;
      }

      const result = await categoryService.deleteCategory(categoryId);
      if (result.success) {
        setSuccess(t('categories.categoryDeleted'));
        await loadCategories();
        onCategoriesUpdated();
        handleCloseContextMenu();
      } else {
        setError(result.error || t('categories.failedToDeleteCategory'));
        handleCloseContextMenu();
      }
    } catch (err) {
      setError(t('categories.failedToDeleteCategory'));
      handleCloseContextMenu();
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      // Check if this is a subcategory trying to be activated while parent is inactive
      if (!category.is_active && category.parent_id) {
        const parentCategory = categories.find(cat => cat.id === category.parent_id);
        if (parentCategory && !parentCategory.is_active) {
          setError(t('categories.cannotActivateSubcategoryInactiveParent'));
          return;
        }
      }

      // If we're deactivating a parent category, we need to deactivate all its subcategories too
      if (category.is_active) {
        // Find all subcategories (children and their children recursively)
        const getAllSubcategories = (parentId: string): string[] => {
          const directChildren = categories.filter(cat => cat.parent_id === parentId);
          const allSubcategories: string[] = [];
          
          directChildren.forEach(child => {
            allSubcategories.push(child.id);
            allSubcategories.push(...getAllSubcategories(child.id));
          });
          
          return allSubcategories;
        };

        const subcategoryIds = getAllSubcategories(category.id);
        
        // Deactivate all subcategories first
        if (subcategoryIds.length > 0) {
          const subcategoryPromises = subcategoryIds.map(subId => 
            categoryService.updateCategory(subId, { is_active: false })
          );
          
          await Promise.all(subcategoryPromises);
        }
      }

      // Now update the main category
      const result = await categoryService.updateCategory(category.id, {
        is_active: !category.is_active
      });
      
      if (result.success) {
        const actionText = !category.is_active ? 'categories.categoryActivated' : 'categories.categoryDeactivated';
        setSuccess(t(actionText));
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || t('categories.failedToUpdateCategory'));
      }
    } catch (err) {
      setError(t('categories.failedToUpdateCategory'));
    }
  };

  // Context menu handlers
  const handleContextMenu = async (category: Category) => {
    setContextMenuCategory(category);
    setContextMenuVisible(true);
    
    // Check if category has expenses for context menu (if not already loaded)
    if (categoryExpenseStatus[category.id] === undefined) {
      const usage = await categoryService.checkCategoryUsage(category.id);
      if (usage.success) {
        setCategoryExpenseStatus(prev => ({
          ...prev,
          [category.id]: usage.hasExpenses === true
        }));
      }
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuCategory(null);
  };

  const handleClose = () => {
    resetForm();
    resetMessages();
    setDeleteConfirm(null);
    onClose();
  };

  // Render draggable category tree for merge interface
  const renderMergeableCategory = (category: Category): JSX.Element => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isDraggedOver = dragOverCategory?.id === category.id;
    const isDragging = draggedCategory?.id === category.id;

    return (
      <div key={category.id} className="category-tree-item">
        <div 
          className={`category-tree-node ${isDraggedOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''} ${!category.is_active ? 'inactive' : ''}`}
          draggable={!hasChildren} // Only leaf categories can be dragged
          onDragStart={(e) => handleDragStart(e, category)}
          onDragOver={(e) => handleDragOver(e, category)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, category)}
        >
          <div className="category-header">
            <div className="category-tree-controls">
              {hasChildren && (
                <button
                  className="tree-expand-btn"
                  onClick={() => toggleCategoryExpansion(category.id)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!hasChildren && <div className="tree-spacer" />}
            </div>
            
            <div 
              className="category-icon"
              style={{ backgroundColor: category.color + '20', color: category.color }}
            >
              {category.icon}
            </div>
            
            <div className="category-info">
              <h4>{getHierarchicalCategoryName(category, categories, t)}</h4>
              <div className="category-meta">
                <span className={`type-badge ${category.type}`}>
                  {t(`categories.types.${category.type}`)}
                </span>
                {category.level > 1 && (
                  <span className="level-badge">Level {category.level}</span>
                )}
                <span className={`status-badge ${category.is_active ? 'active' : 'inactive'}`}>
                  {category.is_active ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
            </div>
          </div>
          
          {category.description && (
            <p className="category-description">{category.description}</p>
          )}

          {!hasChildren && (
            <div className="merge-hint">🔄 Drag to merge with another category</div>
          )}
          {hasChildren && (
            <div className="merge-hint">⚠️ Contains subcategories - cannot be merged or used as merge target</div>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="category-children">
            {category.children?.map(child => renderMergeableCategory(child))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="manage-categories-overlay" onClick={handleClose}>
      <div className={`manage-categories-modal ${showForm || editingCategory ? 'form-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="manage-categories-header">
          <h2>{t('categories.manageCategories')}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="manage-categories-content">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {showMergeInterface ? (
            <div className="categories-list">
              <div className="list-header">
                <h3>{t('categories.mergeCategories')}</h3>
                <button 
                  className="btn-back"
                  onClick={() => setShowMergeInterface(false)}
                >
                  ← {t('categories.backToList')}
                </button>
              </div>

              <div className="merge-instructions">
                <p><strong>📋 {t('categories.howToMerge')}</strong></p>
                <p>{t('categories.mergeInstructions')}</p>
                <ul>
                  <li>{t('categories.mergeRule1')}</li>
                  <li>{t('categories.mergeRule2')}</li>
                  <li>{t('categories.mergeRule3')}</li>
                </ul>
              </div>

              {mergeLoading ? (
                <div className="loading-state">{t('categories.loadingMerge')}</div>
              ) : (
                <div className="categories-container">
                  <div className="categories-tree">
                    <div className="root-categories">
                      {buildCategoryTree(categories).map(category => renderMergeableCategory(category))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : !showForm ? (
            <div className="categories-list">
              <div className="list-header">
                <h3>{t('categories.yourCategories', { count: categories.length })}</h3>
                <div className="list-header-buttons">
                  <button 
                    className="btn-add-category"
                    onClick={() => {
                      setFormData(getDefaultFormData());
                      setEditingCategory(null);
                      setShowForm(true);
                      resetMessages();
                    }}
                  >
                    <span>+</span> {t('categories.addCategory')}
                  </button>
                  <button 
                    className="btn-merge-categories"
                    onClick={() => setShowMergeInterface(true)}
                    disabled={categories.length < 2}
                  >
                    <span>🔄</span> {t('categories.mergeCategories')}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">{t('categories.loadingCategories')}</div>
              ) : categories.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏷️</div>
                  <p>{t('categories.noCategoriesFound')}</p>
                  <button 
                    className="btn-primary"
                    onClick={() => {
                      setFormData(getDefaultFormData());
                      setEditingCategory(null);
                      setShowForm(true);
                      resetMessages();
                    }}
                  >
                    {t('categories.createFirstCategory')}
                  </button>
                </div>
              ) : (
                <div className="categories-container">
                  <div className="categories-tree">
                    <div className="root-categories">
                      {buildCategoryTree(categories).map(category => renderCategoryTree(category))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="category-form">
              <div className="form-header">
                <h3>{editingCategory ? t('categories.editCategory') : t('categories.addNewCategory')}</h3>
                <button 
                  className="btn-back"
                  onClick={resetForm}
                >
                  ← {t('categories.backToList')}
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">{t('categories.categoryName')} *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={formLoading}
                    maxLength={100}
                    placeholder={t('categories.enterCategoryName')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">{t('categories.description')}</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={formLoading}
                    maxLength={500}
                    placeholder={t('categories.optionalDescription')}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="type">{t('categories.categoryType')} *</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    disabled={true}
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  >
                <option value="expense">{t('categories.types.expense')}</option>
                <option value="income">{t('categories.types.income')}</option>
                <option value="both">{t('categories.types.both')}</option>
                  </select>
                  <small style={{ color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                    {isExpenseMode ? t('categories.typeSetToExpense') : t('categories.typeSetToIncome')}
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="parent_id">{t('categories.parentCategory')}</label>
                  <select
                    id="parent_id"
                    name="parent_id"
                    value={formData.parent_id || ''}
                    onChange={handleInputChange}
                    disabled={formLoading}
                  >
                    <option value="">{t('categories.noParentCategory')}</option>
                    {getAvailableParents().map(category => (
                      <option key={category.id} value={category.id}>
                        {'  '.repeat(category.level - 1)}{getTranslatedCategoryName(category.name, t)}
                      </option>
                    ))}
                  </select>
                  <small className="form-help">{t('categories.parentCategoryHelp')}</small>
                </div>

                <div className="form-group">
                  <label>{t('categories.icon')}</label>
                  <div className="icon-selector">
                    {predefinedIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-option ${formData.icon === icon ? 'selected' : ''}`}
                        onClick={() => handleIconSelect(icon)}
                        disabled={formLoading}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('categories.color')}</label>
                  <div className="color-selector">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorSelect(color)}
                        disabled={formLoading}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      disabled={formLoading}
                    />
                    <span className="checkmark"></span>
                    {t('categories.activeCategory')}
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={resetForm}
                    disabled={formLoading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={formLoading}
                  >
                    {formLoading ? t('categories.saving') : (editingCategory ? t('categories.updateCategory') : t('categories.createCategory'))}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Merge Confirmation Modal */}
      {showConfirmMerge && mergePreview && (
        <div className="manage-categories-overlay" onClick={handleCancelMerge}>
          <div className="manage-categories-modal form-mode" onClick={(e) => e.stopPropagation()}>
            <div className="manage-categories-header">
              <h2>⚠️ {t('categories.confirmMerge')}</h2>
              <button className="close-button" onClick={handleCancelMerge}>×</button>
            </div>

            <div className="manage-categories-content">
              <div className="merge-confirmation-details">
                <div className="confirmation-section">
                  <h3>{t('categories.sourceCategory')}: {mergePreview.sourceCategory.name}</h3>
                  <p>↓ {t('categories.transactionsWillMove')}</p>
                  <h3>{t('categories.targetCategory')}: {mergePreview.targetCategory.name}</h3>
                </div>

                <div className="confirmation-section">
                  <h4>📊 {t('categories.whatWillHappen')}</h4>
                  <ul>
                    <li><strong>{mergePreview.transactionsToMove}</strong> {t('categories.transactionsWillMove')}</li>
                    <li><strong>{mergePreview.expenseCount}</strong> {t('categories.expenseTransactions')}</li>
                    <li><strong>{mergePreview.incomeCount}</strong> {t('categories.incomeTransactions')}</li>
                    <li>{t('categories.sourceCategoryWillBeDeleted')}</li>
                  </ul>
                </div>

                <div className="error-message">
                  ⚠️ {t('categories.mergeWarning')}
                </div>

                <div className="form-actions">
                  <button 
                    type="button"
                    className="btn-cancel"
                    onClick={handleCancelMerge}
                    disabled={mergeLoading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="button"
                    className="btn-submit"
                    onClick={handleExecuteMerge}
                    disabled={mergeLoading}
                  >
                    {mergeLoading ? t('categories.merging') : t('categories.confirmMergeButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Context Menu */}
      <CategoryContextMenu
        visible={contextMenuVisible}
        category={contextMenuCategory}
        onClose={handleCloseContextMenu}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onAddSubcategory={handleAddSubcategory}
        hasExpenses={contextMenuCategory ? categoryExpenseStatus[contextMenuCategory.id] : false}
        t={t}
      />
    </div>
  );
};

export default ManageCategories;