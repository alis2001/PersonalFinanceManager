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
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import categoryService, { Category } from '../services/categoryService';
import BottomNavigation from './BottomNavigation';

interface CategoriesProps {
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  type: 'income' | 'expense' | 'both';
  is_active: boolean;
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

const Categories: React.FC<CategoriesProps> = ({ activeRoute = 'Categories', onNavigate, onAddExpense }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setError(null);
      console.log('Loading categories...');
      // Load ALL categories (both active and inactive) like web version
      const result = await categoryService.getCategories({ 
        type: 'expense', 
        active: undefined // This loads both active and inactive categories
      });

      console.log('Categories result:', result);
      console.log('Categories result success:', result.success);
      console.log('Categories result categories:', result.categories);
      console.log('Categories result error:', result.error);

      if (result.success && result.categories && Array.isArray(result.categories)) {
        console.log('Setting categories:', result.categories);
        setCategories(result.categories);
        
        // If no categories exist, create default ones (like web version)
        if (result.categories.length === 0) {
          console.log('No categories found, creating default categories...');
          await categoryService.createDefaultCategories();
          // Reload categories after creating defaults
          const reloadResult = await categoryService.getCategories({ 
            type: 'expense', 
            active: undefined 
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
      is_active: category.is_active
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (categoryId: string) => {
    if (deleteConfirm !== categoryId) {
      setDeleteConfirm(categoryId);
      return;
    }

    try {
      const result = await categoryService.deleteCategory(categoryId);
      if (result.success) {
        setSuccess('Category deleted successfully');
        setDeleteConfirm(null);
        await loadCategories();
      } else {
        setError(result.error || 'Failed to delete category');
      }
    } catch (err: any) {
      console.log('Category deletion error:', err);
      // Handle specific error cases
      if (err.message && err.message.includes('being used in transactions')) {
        setError('Cannot delete category that is being used in transactions. Please go to Transactions and remove or change the category for all transactions using this category first.');
      } else {
        setError('Failed to delete category');
      }
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const result = await categoryService.updateCategory(category.id, {
        is_active: !category.is_active
      });
      
      if (result.success) {
        setSuccess(category.is_active ? 'Category deactivated successfully' : 'Category activated successfully');
        await loadCategories();
      } else {
        setError(result.error || 'Failed to update category');
      }
    } catch (err) {
      setError('Failed to update category');
    }
  };

  const renderCategoryCard = (category: Category) => (
    <View key={category.id} style={[styles.categoryCard, !category.is_active && styles.categoryCardInactive]}>
      <View style={styles.categoryHeader}>
        <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
          <Text style={styles.categoryIconText}>{category.icon}</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryName, !category.is_active && styles.categoryNameInactive]}>{category.name}</Text>
          <View style={[styles.typeBadge, getTypeBadgeStyle(category.type)]}>
            <Text style={[styles.typeBadgeText, getTypeBadgeTextStyle(category.type)]}>
              {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.categoryStatus}>
          {category.is_active ? (
            <View style={styles.statusActive}>
              <Text style={styles.statusActiveText}>Active</Text>
            </View>
          ) : (
            <View style={styles.statusInactive}>
              <Text style={styles.statusInactiveText}>Inactive</Text>
            </View>
          )}
        </View>
      </View>
      
      {category.description && (
        <Text style={[styles.categoryDescription, !category.is_active && styles.categoryDescriptionInactive]} numberOfLines={2}>
          {category.description}
        </Text>
      )}
      
      <View style={styles.categoryActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEdit(category)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => handleToggleActive(category)}
        >
          <Text style={styles.actionButtonText}>
            {category.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton, deleteConfirm === category.id && styles.deleteButtonConfirm]}
          onPress={() => handleDelete(category.id)}
        >
          <Text style={[styles.actionButtonText, deleteConfirm === category.id && styles.deleteButtonTextConfirm]}>
            {deleteConfirm === category.id ? 'Confirm' : 'Delete'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.loadingText}>Loading categories...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>Error Loading Categories</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadCategories}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.emptyIcon}>🏷️</Text>
      <Text style={styles.emptyTitle}>No Categories</Text>
      <Text style={styles.emptyText}>
        No categories found. Contact support if this seems incorrect.
      </Text>
      <TouchableOpacity style={styles.createFirstButton} onPress={() => setShowForm(true)}>
        <Text style={styles.createFirstButtonText}>Create Your First Category</Text>
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
            {editingCategory ? 'Edit Category' : 'Add New Category'}
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
            <Text style={styles.label}>Category Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              placeholder="Enter category name"
              placeholderTextColor="#999"
              editable={!formLoading}
              maxLength={100}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Optional description"
              placeholderTextColor="#999"
              editable={!formLoading}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
                style={styles.picker}
                enabled={!formLoading}
              >
                <Picker.Item label="Expense" value="expense" />
                <Picker.Item label="Income" value="income" />
                <Picker.Item label="Both" value="both" />
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Icon</Text>
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
            <Text style={styles.label}>Color</Text>
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
              <Text style={styles.checkboxLabel}>Active Category</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
              disabled={formLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, formLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={formLoading}
            >
              <Text style={styles.submitButtonText}>
                {formLoading ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
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
          <Text style={styles.headerTitle}>Categories</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
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
              {categories.map(renderCategoryCard)}
            </View>
          </ScrollView>
        ) : (
          renderEmptyState()
        )}
      </View>

      {/* Form Modal */}
      {renderForm()}

      {/* Bottom Navigation */}
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
    fontWeight: '300',
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