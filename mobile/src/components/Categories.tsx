import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TextInput, 
  Modal,
  Platform,
  Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
// import { Ionicons } from '@expo/vector-icons'; // Temporarily commented to avoid import issues
import categoryService, { Category } from '../services/categoryService';
import CategoryContextMenu from './CategoryContextMenu';
import BottomNavigation from './BottomNavigation';
import AlertDialog from './AlertDialog';
import { useTranslation } from '../hooks/useTranslation';

interface CategoriesProps {
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
  onSettings?: () => void;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  type: 'income' | 'expense' | 'both';
  is_active: boolean;
  parent_id?: string;
}

const defaultFormData: CategoryFormData = {
  name: '',
  description: '',
  color: '#4A90E2',
  icon: '💰',
  type: 'expense',
  is_active: true
};

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

const Categories: React.FC<CategoriesProps> = ({ activeRoute = 'Categories', onNavigate, onAddExpense, onSettings }) => {
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
    };
    return descriptionMap[categoryName] || '';
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [categoryExpenseStatus, setCategoryExpenseStatus] = useState<Record<string, boolean>>({});
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [formLoading, setFormLoading] = useState(false);
  
  // Hierarchical view state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuCategory, setContextMenuCategory] = useState<Category | null>(null);
  
  // Alert dialog state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'error' | 'warning' | 'info' | 'success',
    buttons: [] as Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }>
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setError(null);
      console.log('Loading categories...');
      // Load ALL categories (both active and inactive) with hierarchical structure
      const result = await categoryService.getCategories({ 
        type: 'expense', 
        active: undefined,
        includeChildren: true // This loads hierarchical structure
      });

      console.log('Categories result:', result);
      console.log('Categories result success:', result.success);
      console.log('Categories result categories:', result.categories);
      console.log('Categories result error:', result.error);

      if (result.success && result.categories && Array.isArray(result.categories)) {
        setCategories(result.categories);
        
        // If no categories exist, create default ones (like web version)
        if (result.categories.length === 0) {
          console.log('No categories found, creating default categories...');
          await categoryService.createDefaultCategories();
          // Reload categories after creating defaults
          const reloadResult = await categoryService.getCategories({ 
            type: 'expense', 
            active: undefined,
            includeChildren: true
          });
          if (reloadResult.success && reloadResult.categories) {
            setCategories(reloadResult.categories);
          }
        }
      } else if (result.success && Array.isArray(result)) {
        // Handle case where backend returns array directly
        console.log('Setting categories from direct array:', result);
        setCategories(result);
      } else {
        console.log('Failed to load categories:', result.error);
        setError(result.error || 'Failed to load categories');
        setCategories([]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };

  // Build hierarchical tree structure
  const buildCategoryTree = (categories: Category[]): (Category & { children: Category[] })[] => {
    // If categories already have children structure, normalize it to ensure type consistency
    if (categories.some(cat => cat.children && cat.children.length > 0)) {
      return categories
        .filter(cat => !cat.parent_id)
        .map(cat => ({
          ...cat,
          children: cat.children || []
        }));
    }
    
    // Otherwise build tree from flat structure
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

  // Get available parent categories (excluding current category being edited and its descendants)
  // Flatten hierarchical categories to a flat list for easier processing
  const flattenCategories = (categories: Category[]): Category[] => {
    const flattened: Category[] = [];
    
    const flatten = (cats: Category[]) => {
      cats.forEach(cat => {
        flattened.push(cat);
        if (cat.children && cat.children.length > 0) {
          flatten(cat.children);
        }
      });
    };
    
    flatten(categories);
    return flattened;
  };

  const getAvailableParents = () => {
    // Always work with flattened data so we can see all categories at all levels
    const flatCategories = flattenCategories(categories);
    console.log('Categories: Flattened categories for parent selection:', flatCategories.length);
    console.log('Categories: Available categories:', flatCategories.map(c => ({
      id: c.id, 
      name: c.name, 
      parent_id: c.parent_id, 
      level: c.level
    })));
    
    if (!editingCategory) {
      console.log('Categories: Creating new category - all active categories available');
      // 🚫 CRITICAL FIX: Exclude categories with expenses/income when creating new category too
      return flatCategories.filter(cat => 
        cat.is_active &&
        !categoryExpenseStatus[cat.id] // Exclude categories with expenses/income
      );
    }
    
    console.log('Categories: Editing category:', {
      id: editingCategory.id,
      name: editingCategory.name,
      parent_id: editingCategory.parent_id,
      level: editingCategory.level
    });
    
    // 🚫 CRITICAL FIX: Also exclude categories that have expenses/income (they must remain leaf categories)
    const availableParents = flatCategories.filter(cat => 
      cat.is_active && 
      cat.id !== editingCategory.id && 
      !isDescendantOf(cat, editingCategory, flatCategories) && // Prevent circular references
      !categoryExpenseStatus[cat.id] // 🚫 CRITICAL: Exclude categories with expenses/income
    );
    
    console.log('Categories: Available parent categories:', availableParents.map(c => ({
      id: c.id, 
      name: c.name, 
      level: c.level
    })));
    
    return availableParents;
  };

  // Check if a category is a descendant of another category
  const isDescendantOf = (potentialDescendant: Category, ancestor: Category, flatCategories?: Category[]): boolean => {
    if (!potentialDescendant.parent_id) return false;
    if (potentialDescendant.parent_id === ancestor.id) return true;
    
    // Use provided flat categories or fallback to flattening current categories
    const searchCategories = flatCategories || flattenCategories(categories);
    const parent = searchCategories.find(cat => cat.id === potentialDescendant.parent_id);
    return parent ? isDescendantOf(parent, ancestor, searchCategories) : false;
  };

  // Helper function to show professional alerts
  const showAlert = (
    title: string, 
    message: string, 
    type: 'error' | 'warning' | 'info' | 'success',
    buttons: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }>
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  // Check if category has expenses using the proper backend endpoint
  const checkCategoryHasExpenses = async (categoryId: string): Promise<boolean> => {
    try {
      console.log('Categories: Checking if category has expenses:', categoryId);
      const usage = await categoryService.checkCategoryUsage(categoryId);
      
      if (usage.success) {
        console.log('Categories: Category usage check result:', usage);
        return usage.hasExpenses === true;
      } else {
        console.error('Categories: Failed to check category usage:', usage.error);
        return false; // Default to allowing subcategory creation on error
      }
    } catch (error) {
      console.error('Error checking category usage:', error);
      return false; // Default to allowing subcategory creation on error
    }
  };

  // Check if category has children
  const checkCategoryHasChildren = (categoryId: string): boolean => {
    const flatCategoriesForCheck = flattenCategories(categories);
    return flatCategoriesForCheck.some(cat => cat.parent_id === categoryId);
  };

  // Find the root parent of a category (top-level category)
  const findRootParent = (categoryId: string): Category | null => {
    const flatCategoriesForCheck = flattenCategories(categories);
    const category = flatCategoriesForCheck.find(cat => cat.id === categoryId);
    
    if (!category) return null;
    if (!category.parent_id) return category; // This is already a root category
    
    // Traverse up the hierarchy to find the root
    let currentCategory = category;
    while (currentCategory.parent_id) {
      const parent = flatCategoriesForCheck.find(cat => cat.id === currentCategory.parent_id);
      if (!parent) break;
      currentCategory = parent;
    }
    
    return currentCategory;
  };

  // Check if all parents in the chain are active
  const areAllParentsActive = (categoryId: string): boolean => {
    const flatCategoriesForCheck = flattenCategories(categories);
    const category = flatCategoriesForCheck.find(cat => cat.id === categoryId);
    
    if (!category || !category.parent_id) return true; // Root categories or not found
    
    // Check immediate parent
    const parent = flatCategoriesForCheck.find(cat => cat.id === category.parent_id);
    if (!parent || !parent.is_active) return false;
    
    // Recursively check up the chain
    return areAllParentsActive(parent.id);
  };

  // Find the immediate inactive parent (the first inactive parent going up the chain)
  const findImmediateInactiveParent = (categoryId: string): Category | null => {
    const flatCategoriesForCheck = flattenCategories(categories);
    const category = flatCategoriesForCheck.find(cat => cat.id === categoryId);
    
    if (!category || !category.parent_id) return null; // Root categories or not found
    
    // Check immediate parent
    const parent = flatCategoriesForCheck.find(cat => cat.id === category.parent_id);
    if (!parent) return null;
    
    if (!parent.is_active) {
      // Found the immediate inactive parent
      return parent;
    }
    
    // Parent is active, check up the chain
    return findImmediateInactiveParent(parent.id);
  };

  // Context menu handlers
  const handleContextMenu = async (category: Category) => {
    setContextMenuCategory(category);
    
    // Check if category has expenses for context menu
    const hasExpenses = await checkCategoryHasExpenses(category.id);
    setCategoryExpenseStatus(prev => ({
      ...prev,
      [category.id]: hasExpenses
    }));
    
    setContextMenuVisible(true);
  };

  const handleCloseContextMenu = () => {
    setContextMenuVisible(false);
    setContextMenuCategory(null);
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'expense':
        return styles.typeBadgeExpense;
      case 'income':
        return styles.typeBadgeIncome;
      case 'both':
        return styles.typeBadgeBoth;
      default:
        return styles.typeBadgeExpense;
    }
  };

  const getTypeBadgeTextStyle = (type: string) => {
    switch (type) {
      case 'expense':
        return styles.typeBadgeTextExpense;
      case 'income':
        return styles.typeBadgeTextIncome;
      case 'both':
        return styles.typeBadgeTextBoth;
      default:
        return styles.typeBadgeTextExpense;
    }
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingCategory(null);
    setShowForm(false);
    setError(null);
    setSuccess(null);
  };

  const handleInputChange = (field: keyof CategoryFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIconSelect = (icon: string) => {
    setFormData(prev => ({ ...prev, icon }));
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setFormLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result;
      if (editingCategory) {
        result = await categoryService.updateCategory(editingCategory.id, formData);
      } else {
        result = await categoryService.createCategory(formData);
      }

      if (result.success) {
        setSuccess(result.message || (editingCategory ? 'Category updated successfully' : 'Category added successfully'));
        resetForm();
        await loadCategories();
      } else {
        setError(result.error || (editingCategory ? 'Failed to update category' : 'Failed to create category'));
      }
    } catch (err) {
      setError(editingCategory ? 'Failed to update category' : 'Failed to create category');
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
    setError(null);
    setSuccess(null);
  };


  const handleDelete = async (categoryId: string, deleteChildren: boolean = false) => {
    try {
      console.log('Categories: Attempting to delete category:', categoryId, 'with children:', deleteChildren);
      
      const result = await categoryService.deleteCategory(categoryId, deleteChildren);
      
      if (result.success) {
        setSuccess(t('categories.categoryDeleted'));
        await loadCategories();
      } else {
        console.log('Categories: Delete failed with error:', result.error);
        console.log('Categories: Full result object:', JSON.stringify(result));
        // Handle specific backend error responses with professional alerts
        if (result.error) {
          if (result.error.includes('has sub-categories')) {
            // Category has children - professional dialog
            showAlert(
              t('categories.cannotDeleteCategoryWithSubcategories'),
              t('categories.deleteSubcategoriesFirst'),
              'error',
              [
                {
                  text: t('common.cancel'),
                  style: 'cancel',
                },
                {
                  text: t('categories.deleteAll'),
                  style: 'destructive',
                  onPress: () => handleDelete(categoryId, true),
                },
              ]
            );
          } else if (result.error.includes('being used in transactions')) {
            // Check if we can extract the expense count from the error
            const expenseCount = 1; // Default fallback
            showAlert(
              t('categories.categoryHasExpensesCannotDelete'),
              t('categories.categoryHasExpensesMessage').replace('{count}', expenseCount.toString()),
              'error',
              [
                {
                  text: t('common.ok'),
                  style: 'default',
                }
              ]
            );
          } else if (result.error.includes('child categories are being used')) {
            showAlert(
              t('categories.subcategoriesInUse'),
              t('categories.subcategoriesInUseMessage'),
              'error',
              [
                {
                  text: t('common.ok'),
                  style: 'default',
                }
              ]
            );
          } else {
            // Show generic professional error for any other delete failure
            showAlert(
              t('categories.failedToDeleteCategory'),
              result.error || t('categories.operationFailedTryAgain'),
              'error',
              [
                {
                  text: t('common.ok'),
                  style: 'default',
                }
              ]
            );
          }
        } else {
          showAlert(
            t('categories.failedToDeleteCategory'),
            t('categories.operationFailedTryAgain'),
            'error',
            [
              {
                text: t('common.ok'),
                style: 'default',
              }
            ]
          );
        }
      }
    } catch (err: any) {
      console.error('Category deletion error:', err);
      showAlert(
        t('categories.failedToDeleteCategory'),
        t('categories.operationFailedTryAgain'),
        'error',
        [
          {
            text: t('common.ok'),
            style: 'default',
          }
        ]
      );
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const hasChildren = checkCategoryHasChildren(category.id);
      const rootParent = findRootParent(category.id);
      const isRootCategory = !category.parent_id;
      
      // If trying to activate a subcategory (not root level)
      if (!category.is_active && !isRootCategory) {
        // Check if ALL parents in the chain are active
        const allParentsActive = areAllParentsActive(category.id);
        
        if (!allParentsActive) {
          // Find the immediate inactive parent that needs to be activated first
          const immediateInactiveParent = findImmediateInactiveParent(category.id);
          const parentToActivate = immediateInactiveParent || rootParent;
          
          console.log(`🔄 REACTIVATION BLOCKED: Category "${category.name}" cannot be reactivated because parent "${parentToActivate?.name}" is inactive`);
          console.log(`🔄 Immediate inactive parent:`, immediateInactiveParent?.name);
          console.log(`🔄 Root parent:`, rootParent?.name);
          
          // Block subcategory reactivation - must activate the immediate inactive parent first
          showAlert(
            t('categories.subcategoryReactivationBlocked'),
            t('categories.subcategoryReactivationMessage').replace('{parentName}', parentToActivate?.name || 'Unknown'),
            'warning',
            [
              {
                text: t('common.ok'),
                style: 'default',
              }
            ]
          );
          return;
        } else {
          // All parents are active, allow direct activation of subcategory
          await performToggleActive(category, false);
          return;
        }
      }
      
      // If deactivating any category (allowed)
      if (category.is_active) {
        if (hasChildren) {
          // Deactivating parent with children - cascade deactivation
          showAlert(
            t('categories.cascadeDeactivateConfirm'),
            t('categories.cascadeDeactivateMessage'),
            'warning',
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('categories.deactivate'),
                style: 'destructive',
                onPress: () => performCascadeActivation(category, false),
              },
            ]
          );
        } else {
          // Leaf category deactivation
          await performToggleActive(category, false);
        }
        return;
      }
      
      // If activating any category (root or intermediate level)
      if (!category.is_active) {
        if (hasChildren) {
          // Activating parent with children - cascade activation (works for any level)
          console.log(`🔄 CASCADING ACTIVATION: Category "${category.name}" (Level ${category.level || 'unknown'}) will cascade activate ${checkCategoryHasChildren(category.id) ? 'its children' : 'no children found'}`);
          
          showAlert(
            t('categories.cascadeActivateConfirm'),
            t('categories.cascadeActivateMessage'),
            'info',
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('categories.activate'),
                style: 'default',
                onPress: () => performCascadeActivation(category, true),
              },
            ]
          );
        } else {
          // Leaf category activation (any level)
          console.log(`🔄 LEAF ACTIVATION: Category "${category.name}" (Level ${category.level || 'unknown'}) is a leaf category - direct activation`);
          await performToggleActive(category, false);
        }
      }
      
    } catch (err) {
      setError(t('categories.failedToUpdateCategory'));
    }
  };

  const performToggleActive = async (category: Category, cascade: boolean = false) => {
    try {
      const newActiveState = !category.is_active;
      
      if (cascade) {
        console.log(`🔄 CALLING BACKEND CASCADE: Category "${category.name}" newActiveState=${newActiveState} cascade=true`);
        const result = await categoryService.updateCategoryWithCascade(
          category.id, 
          { is_active: newActiveState }, 
          true
        );
        console.log(`🔄 BACKEND CASCADE RESULT: Success=${result.success}, Error=${result.error}`);
        
        if (result.success) {
          setSuccess(newActiveState 
            ? t('categories.allSubcategoriesActivated') 
            : t('categories.allSubcategoriesDeactivated')
          );
          await loadCategories();
        } else {
          setError(result.error || t('categories.failedToUpdateCategory'));
        }
      } else {
        const result = await categoryService.updateCategory(category.id, {
          is_active: newActiveState
        });
        
        if (result.success) {
          setSuccess(newActiveState 
            ? t('categories.categoryActivated') 
            : t('categories.categoryDeactivated')
          );
          await loadCategories();
        } else {
          setError(result.error || t('categories.failedToUpdateCategory'));
        }
      }
    } catch (err) {
      setError(t('categories.failedToUpdateCategory'));
    }
  };

  const performCascadeActivation = async (category: Category, activate: boolean) => {
    console.log(`🔄 PERFORMING CASCADE ACTIVATION: Category "${category.name}" activate=${activate} with cascade=true`);
    await performToggleActive(category, true);
  };

  const handleAddSubcategory = async (parentCategory: Category) => {
    try {
      // Check if parent category has expenses
      const hasExpenses = await checkCategoryHasExpenses(parentCategory.id);
      
      if (hasExpenses) {
        // Cannot add subcategory to category with expenses
        showAlert(
          t('categories.cannotAddSubcategoryWithExpenses'),
          t('categories.expensesOnlyInLeafCategories'),
          'error',
          [
            {
              text: t('common.ok'),
              style: 'default',
            }
          ]
        );
        return;
      }
      
      // Proceed with adding subcategory
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        color: parentCategory.color || '#4A90E2',
        icon: '💰',
        type: parentCategory.type,
        is_active: true,
        parent_id: parentCategory.id
      });
      setShowForm(true);
      setError(null);
      setSuccess(null);
    } catch (err) {
      setError(t('categories.failedToCheckCategoryUsage'));
    }
  };

  const renderCategoryTree = (category: Category & { children: Category[] }, level: number = 0): React.JSX.Element => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const isSubcategory = level > 0;
    
    return (
      <View key={category.id} style={styles.categoryTreeItem}>
        {/* Connecting Line for Subcategories */}
        {isSubcategory && (
          <View style={[styles.connectingLine, { marginLeft: (level - 1) * 20 + 16 }]} />
        )}
        
        <View 
          style={[
            isSubcategory ? styles.subcategoryCard : styles.categoryCard,
            { marginLeft: level * 20 },
            !category.is_active && styles.categoryCardInactive
          ]}
        >
          <View style={styles.categoryHeader}>
            {/* Expand/Collapse Button */}
            {hasChildren && (
              <TouchableOpacity
                style={styles.treeExpandBtn}
                onPress={() => toggleCategoryExpansion(category.id)}
              >
                <Text style={{ color: '#666', fontSize: 18 }}>
                  {isExpanded ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Category Icon */}
            <View 
              style={[
                isSubcategory ? styles.subcategoryIcon : styles.categoryIcon
              ]}
            >
              <Text style={[
                styles.categoryIconText,
                isSubcategory && styles.subcategoryIconText
              ]}>
                {category.icon}
              </Text>
            </View>
            
            {/* Category Info */}
            <View style={styles.categoryInfo}>
              <View style={styles.categoryTitleRow}>
                <Text style={[
                  isSubcategory ? styles.subcategoryName : styles.categoryName,
                  !category.is_active && styles.categoryNameInactive
                ]}>
                  {getTranslatedCategoryName(category.name)}
                </Text>
                
              </View>
              
              <View style={styles.categoryMeta}>
                <View style={[styles.typeBadge, getTypeBadgeStyle(category.type)]}>
                  <Text style={[styles.typeBadgeText, getTypeBadgeTextStyle(category.type)]}>
                    {getTranslatedCategoryType(category.type)}
                  </Text>
                </View>
                
              </View>
            </View>
            
            {/* Context Menu Button */}
            <TouchableOpacity
              style={styles.contextMenuButton}
              onPress={() => handleContextMenu(category)}
            >
              <Text style={{ color: '#666', fontSize: 20 }}>⋮</Text>
            </TouchableOpacity>
          </View>
          
          {/* Description (only for parent categories or if explicitly set) */}
          {!isSubcategory && category.description && (
            <Text style={[
              styles.categoryDescription,
              !category.is_active && styles.categoryDescriptionInactive
            ]} numberOfLines={2}>
              {category.description}
            </Text>
          )}
        </View>
        
        {/* Minimalist Hierarchical Subcategories */}
        {isExpanded && hasChildren && (
          <View style={styles.subcategoriesContainer}>
            {category.children.map(child => 
              renderCategoryTree(child as Category & { children: Category[] }, level + 1)
            )}
          </View>
        )}
      </View>
    );
  };


  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.loadingText}>Loading categories...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>{t('categories.failedToLoadCategories')}</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadCategories}>
        <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.emptyIcon}>🏷️</Text>
      <Text style={styles.emptyTitle}>{t('categories.noCategoriesFound')}</Text>
      <Text style={styles.emptyText}>
        No categories found. Contact support if this seems incorrect.
      </Text>
      <TouchableOpacity style={styles.createFirstButton} onPress={() => setShowForm(true)}>
        <Text style={styles.createFirstButtonText}>{t('categories.createFirstCategory')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderForm = () => (
    <Modal
      visible={showForm}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingCategory ? t('categories.editCategory') : t('categories.addNewCategory')}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={resetForm}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.modalContent} 
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {error && (
            <View style={styles.errorMessage}>
              <Text style={styles.errorMessageText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successMessage}>
              <Text style={styles.successMessageText}>{success}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.categoryName')} *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              placeholder={t('categories.enterCategoryName')}
              placeholderTextColor="#999"
              editable={!formLoading}
              maxLength={100}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder={t('categories.optionalDescription')}
              placeholderTextColor="#999"
              editable={!formLoading}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.categoryType')} *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
                style={styles.picker}
                enabled={!formLoading}
              >
                <Picker.Item label={t('categories.expense')} value="expense" />
                <Picker.Item label={t('categories.income')} value="income" />
                <Picker.Item label={t('categories.both')} value="both" />
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.parentCategory')}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.parent_id || ''}
                onValueChange={(value) => handleInputChange('parent_id', value)}
                style={styles.picker}
                enabled={!formLoading}
              >
                <Picker.Item label={t('categories.noParentCategory')} value="" />
                {getAvailableParents().map(category => (
                  <Picker.Item 
                    key={category.id} 
                    label={`${'  '.repeat(category.level - 1)}${getTranslatedCategoryName(category.name)}`} 
                    value={category.id} 
                  />
                ))}
              </Picker>
            </View>
            <Text style={styles.formHelp}>{t('categories.parentCategoryHelp')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.icon')}</Text>
            <ScrollView 
              style={styles.iconSelector} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <View style={styles.iconGrid}>
                {predefinedIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, formData.icon === icon && styles.iconOptionSelected]}
                    onPress={() => handleIconSelect(icon)}
                    disabled={formLoading}
                  >
                    <Text style={styles.iconOptionText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('categories.color')}</Text>
            <View style={styles.colorSelector}>
              {predefinedColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, formData.color === color && styles.colorOptionSelected]}
                  onPress={() => handleColorSelect(color)}
                  disabled={formLoading}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleInputChange('is_active', !formData.is_active)}
              disabled={formLoading}
            >
              <View style={[styles.checkbox, formData.is_active && styles.checkboxChecked]}>
                {formData.is_active && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>{t('categories.activeCategory')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
              disabled={formLoading}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, formLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={formLoading}
            >
              <Text style={styles.submitButtonText}>
                {formLoading ? t('categories.saving') : (editingCategory ? t('categories.updateCategory') : t('categories.createCategory'))}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('categories.title')}</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.addButtonText}>+ {t('categories.addCategory')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {loading ? (
          renderLoadingState()
        ) : error ? (
          renderErrorState()
        ) : categories && categories.length > 0 ? (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.categoriesList}>
              {buildCategoryTree(categories).map(category => renderCategoryTree(category))}
            </View>
          </ScrollView>
        ) : (
          renderEmptyState()
        )}
      </View>

      {/* Form Modal */}
      {renderForm()}

      {/* Context Menu */}
      <CategoryContextMenu
        visible={contextMenuVisible}
        category={contextMenuCategory}
        onClose={handleCloseContextMenu}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onAddSubcategory={handleAddSubcategory}
        hasExpenses={contextMenuCategory ? categoryExpenseStatus[contextMenuCategory.id] || false : false}
      />

      {/* Professional Alert Dialog */}
      <AlertDialog
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={closeAlert}
      />

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        onAddExpense={onAddExpense}
        onSettings={onSettings}
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
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  addButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20, // Reduced space for bottom navigation
  },
  scrollView: {
    flex: 1,
  },
  categoriesList: {
    gap: 20,
    paddingBottom: 100,
  },
  categoryTreeItem: {
    marginBottom: 4,
  },
  categoryTreeControls: {
    alignItems: 'center',
    marginRight: 8,
    width: 40,
  },
  treeSpacer: {
    width: 20,
    height: 20,
  },
  categoryChildren: {
    borderLeftWidth: 2,
    borderLeftColor: '#e1e5e9',
    marginLeft: 24,
    paddingLeft: 12,
    backgroundColor: '#fafbfc',
    borderRadius: 8,
    marginTop: 8,
  },
  levelBadge: {
    fontSize: 10,
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  formHelp: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  subcategoryButton: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  // Minimalist Subcategory Styles
  subcategoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  subcategoriesContainer: {
    marginTop: 8,
    paddingLeft: 16,
  },
  connectingLine: {
    position: 'absolute',
    top: -8,
    width: 2,
    height: 16,
    backgroundColor: '#e0e0e0',
    zIndex: 1,
  },
  subcategoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f8f9fa',
  },
  subcategoryIconText: {
    fontSize: 14,
  },
  subcategoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  contextMenuButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    marginLeft: 8,
  },
  treeExpandBtn: {
    padding: 4,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  categoryCardInactive: {
    opacity: 0.5,
    backgroundColor: '#f8f9fa',
    borderColor: '#e0e0e0',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    marginBottom: 15,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  categoryIconText: {
    fontSize: 22,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryNameInactive: {
    color: '#999999',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  typeBadgeExpense: {
    backgroundColor: '#fee2e2',
  },
  typeBadgeIncome: {
    backgroundColor: '#dcfce7',
  },
  typeBadgeBoth: {
    backgroundColor: '#e0e7ff',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  typeBadgeTextExpense: {
    color: '#dc2626',
  },
  typeBadgeTextIncome: {
    color: '#16a34a',
  },
  typeBadgeTextBoth: {
    color: '#3730a3',
  },
  categoryStatus: {
    alignItems: 'flex-end',
  },
  statusActive: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusActiveText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '500',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusInactiveText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryDescription: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  categoryDescriptionInactive: {
    color: '#999999',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  toggleButton: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  deleteButtonText: {
    color: '#dc2626',
  },
  deleteButtonConfirm: {
    backgroundColor: '#dc2626',
  },
  deleteButtonTextConfirm: {
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  createFirstButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  createFirstButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalScrollContent: {
    paddingBottom: 20, // Minimal padding for form buttons
  },
  errorMessage: {
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  errorMessageText: {
    color: '#e53e3e',
    fontSize: 14,
  },
  successMessage: {
    backgroundColor: '#f0fff4',
    borderColor: '#c6f6d5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  successMessageText: {
    color: '#38a169',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1a1a1a',
  },
  iconSelector: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 15,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  iconOptionSelected: {
    borderColor: '#1a1a1a',
    backgroundColor: '#f8f9fa',
  },
  iconOptionText: {
    fontSize: 20,
  },
  colorSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#1a1a1a',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#2d3748',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 40,
    paddingTop: 20,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  cancelButton: {
    backgroundColor: '#f7fafc',
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default Categories;