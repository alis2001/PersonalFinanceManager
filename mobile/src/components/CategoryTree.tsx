import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanGestureHandler,
  State,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import categoryService, { Category } from '../services/categoryService';

interface CategoryTreeProps {
  onCategorySelect?: (category: Category) => void;
  showActions?: boolean;
  type?: 'income' | 'expense' | 'both';
}

interface CategoryNodeProps {
  category: Category;
  level: number;
  onCategorySelect?: (category: Category) => void;
  onCategoryCreate?: (parentId?: string) => void;
  onCategoryEdit?: (category: Category) => void;
  onCategoryDelete?: (category: Category) => void;
  onCategoryMove?: (category: Category, newParentId?: string) => void;
  showActions?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const CategoryNode: React.FC<CategoryNodeProps> = ({
  category,
  level,
  onCategorySelect,
  onCategoryCreate,
  onCategoryEdit,
  onCategoryDelete,
  onCategoryMove,
  showActions = false,
  isExpanded = true,
  onToggleExpand,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showSubActions, setShowSubActions] = useState(false);
  const translateX = new Animated.Value(0);

  const hasChildren = category.children && category.children.length > 0;
  const indentLevel = level * 20;

  const getCategoryIcon = () => {
    if (category.icon) return category.icon;
    return hasChildren ? '📁' : '📄';
  };

  const getCategoryColor = () => {
    return category.color || '#64748b';
  };

  const handlePress = () => {
    if (onCategorySelect) {
      onCategorySelect(category);
    }
    if (hasChildren && onToggleExpand) {
      onToggleExpand();
    }
  };

  const handleLongPress = () => {
    if (showActions) {
      setShowSubActions(true);
    }
  };

  const handleGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      translateX.setValue(Math.max(-80, Math.min(0, translationX)));
    } else if (state === State.END) {
      if (translationX < -40) {
        // Swipe left - show actions
        Animated.spring(translateX, {
          toValue: -80,
          useNativeDriver: true,
        }).start();
        setShowSubActions(true);
      } else {
        // Return to original position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleActionPress = (action: 'edit' | 'delete' | 'add') => {
    setShowSubActions(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    switch (action) {
      case 'edit':
        if (onCategoryEdit) onCategoryEdit(category);
        break;
      case 'delete':
        if (onCategoryDelete) {
          Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${category.name}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onCategoryDelete(category) }
            ]
          );
        }
        break;
      case 'add':
        if (onCategoryCreate) onCategoryCreate(category.id);
        break;
    }
  };

  return (
    <View style={styles.categoryNode}>
      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureEvent}
      >
        <Animated.View
          style={[
            styles.categoryContent,
            { transform: [{ translateX }] }
          ]}
        >
          {/* Main Category Row */}
          <TouchableOpacity
            style={[
              styles.categoryRow,
              { marginLeft: indentLevel },
              isPressed && styles.categoryRowPressed
            ]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => setIsPressed(false)}
            activeOpacity={0.7}
          >
            {/* Expand/Collapse Button */}
            <View style={styles.expandButton}>
              {hasChildren ? (
                <TouchableOpacity onPress={onToggleExpand}>
                  <Ionicons
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={16}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 16 }} />
              )}
            </View>

            {/* Category Icon */}
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: getCategoryColor() }
              ]}
            >
              <Text style={styles.categoryIconText}>{getCategoryIcon()}</Text>
            </View>

            {/* Category Info */}
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
              {category.description && (
                <Text style={styles.categoryDescription}>{category.description}</Text>
              )}
              <Text style={styles.categoryMeta}>
                Level {category.level} • {category.type}
              </Text>
            </View>

            {/* Arrow for selection */}
            {onCategorySelect && (
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            )}
          </TouchableOpacity>

          {/* Swipe Actions */}
          {showSubActions && (
            <View style={styles.swipeActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleActionPress('edit')}
              >
                <Ionicons name="pencil" size={16} color="white" />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => handleActionPress('add')}
              >
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.actionText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleActionPress('delete')}
              >
                <Ionicons name="trash" size={16} color="white" />
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </PanGestureHandler>

      {/* Children */}
      {hasChildren && isExpanded && (
        <View style={styles.childrenContainer}>
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              level={level + 1}
              onCategorySelect={onCategorySelect}
              onCategoryCreate={onCategoryCreate}
              onCategoryEdit={onCategoryEdit}
              onCategoryDelete={onCategoryDelete}
              onCategoryMove={onCategoryMove}
              showActions={showActions}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const CategoryTree: React.FC<CategoryTreeProps> = ({
  onCategorySelect,
  showActions = false,
  type = 'expense'
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await categoryService.getCategoryTree(type);
      if (result.success && result.categories) {
        setCategories(result.categories as Category[]);
        // Auto-expand first level
        const firstLevelIds = result.categories
          .filter((cat: Category) => cat.level === 1)
          .map((cat: Category) => cat.id);
        setExpandedCategories(new Set(firstLevelIds));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
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

  const handleCategoryCreate = async (parentId?: string) => {
    setShowCreateModal(true);
    // Modal will handle the actual creation
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setShowCreateModal(true);
  };

  const handleCategoryDelete = async (category: Category) => {
    try {
      const result = await categoryService.deleteCategory(category.id, true);
      if (result.success) {
        await loadCategories();
      } else {
        Alert.alert('Error', result.error || 'Failed to delete category');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete category');
    }
  };

  const handleCategoryMove = async (category: Category, newParentId?: string) => {
    try {
      const result = await categoryService.moveCategory(category.id, newParentId);
      if (result.success) {
        await loadCategories();
      } else {
        Alert.alert('Error', result.error || 'Failed to move category');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to move category');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.emptySubtitle}>Create your first category to get started</Text>
          </View>
        ) : (
          categories.map((category) => (
            <CategoryNode
              key={category.id}
              category={category}
              level={0}
              onCategorySelect={onCategorySelect}
              onCategoryCreate={handleCategoryCreate}
              onCategoryEdit={handleCategoryEdit}
              onCategoryDelete={handleCategoryDelete}
              onCategoryMove={handleCategoryMove}
              showActions={showActions}
              isExpanded={expandedCategories.has(category.id)}
              onToggleExpand={() => toggleExpanded(category.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {showActions && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => handleCategoryCreate()}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Create/Edit Modal */}
      <CategoryModal
        visible={showCreateModal}
        category={editingCategory}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCategory(null);
        }}
        onSave={async () => {
          setShowCreateModal(false);
          setEditingCategory(null);
          await loadCategories();
        }}
        type={type}
      />
    </View>
  );
};

// Category Modal Component
interface CategoryModalProps {
  visible: boolean;
  category?: Category | null;
  onClose: () => void;
  onSave: () => void;
  type: 'income' | 'expense' | 'both';
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  category,
  onClose,
  onSave,
  type
}) => {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [color, setColor] = useState(category?.color || '#3b82f6');
  const [icon, setIcon] = useState(category?.icon || '📄');
  const [loading, setLoading] = useState(false);

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const handleSave = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (category) {
        // Update existing category
        const result = await categoryService.updateCategory(category.id, {
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          type
        });
        if (result.success) {
          onSave();
        } else {
          Alert.alert('Error', result.error || 'Failed to update category');
        }
      } else {
        // Create new category
        const result = await categoryService.createCategory({
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          type
        });
        if (result.success) {
          onSave();
        } else {
          Alert.alert('Error', result.error || 'Failed to create category');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {category ? 'Edit Category' : 'Create Category'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !name.trim()}>
            <Text style={[
              styles.modalSave,
              (!name.trim() || loading) && styles.modalSaveDisabled
            ]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Category name"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              maxLength={500}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Icon</Text>
            <TextInput
              style={styles.textInput}
              value={icon}
              onChangeText={setIcon}
              placeholder="📄"
              maxLength={2}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {colors.map((colorOption) => (
                <TouchableOpacity
                  key={colorOption}
                  style={[
                    styles.colorOption,
                    { backgroundColor: colorOption },
                    color === colorOption && styles.colorOptionSelected
                  ]}
                  onPress={() => setColor(colorOption)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  categoryNode: {
    marginBottom: 2,
  },
  categoryContent: {
    position: 'relative',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryRowPressed: {
    backgroundColor: '#f3f4f6',
  },
  expandButton: {
    width: 24,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  categoryIconText: {
    fontSize: 14,
    color: 'white',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  categoryMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  actionButton: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: 'white',
    marginTop: 2,
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  childrenContainer: {
    backgroundColor: '#f9fafb',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalSave: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  modalSaveDisabled: {
    color: '#9ca3af',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#374151',
  },
});

export default CategoryTree;
