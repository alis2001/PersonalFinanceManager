import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PanGestureHandler, State, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
// Note: Using Text as placeholder for Ionicons to avoid import issues
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
                  <Text style={{ color: '#6b7280', fontSize: 16 }}>
                    {isExpanded ? '▼' : '▶'}
                  </Text>
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
              <Text style={{ color: '#9ca3af', fontSize: 16 }}>▶</Text>
            )}
          </TouchableOpacity>

          {/* Swipe Actions */}
          {showSubActions && (
            <View style={styles.swipeActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleActionPress('edit')}
              >
                <Text style={{ color: 'white', fontSize: 16 }}>✏️</Text>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => handleActionPress('add')}
              >
                <Text style={{ color: 'white', fontSize: 16 }}>➕</Text>
                <Text style={styles.actionText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleActionPress('delete')}
              >
                <Text style={{ color: 'white', fontSize: 16 }}>🗑️</Text>
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
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
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
      console.log('CategoryTree: Loading categories with type:', type);
      
      // Get flat structure first to ensure all parent_id relationships are correct
      const flatResult = await categoryService.getCategories({ 
        type, 
        active: true 
      });
      console.log('CategoryTree: Flat categories result:', flatResult);
      
      if (flatResult.success && flatResult.categories) {
        console.log('CategoryTree: Raw flat categories from API:', JSON.stringify(flatResult.categories, null, 2));
        
        // Store the flat data for the modal
        setFlatCategories(flatResult.categories);
        
        // Build hierarchical structure from flat data for display
        const hierarchicalCategories = buildCategoryTreeFromFlat(flatResult.categories);
        console.log('CategoryTree: Built hierarchical structure:', hierarchicalCategories.length);
        
        setCategories(hierarchicalCategories);
        
        // Auto-expand first level
        const firstLevelIds = hierarchicalCategories
          .filter((cat: Category) => cat.level === 1)
          .map((cat: Category) => cat.id);
        console.log('CategoryTree: Auto-expanding first level categories:', firstLevelIds);
        setExpandedCategories(new Set(firstLevelIds));
      } else {
        console.error('CategoryTree: Failed to load categories:', flatResult.error);
      }
    } catch (error) {
      console.error('CategoryTree: Exception loading categories:', error);
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
    console.log('=== CategoryTree: Editing category ===');
    console.log('CategoryTree: Selected category for editing:', {
      id: category.id,
      name: category.name,
      parent_id: category.parent_id,
      level: category.level,
      path: category.path,
      path_ids: category.path_ids
    });
    console.log('CategoryTree: Full category object:', JSON.stringify(category, null, 2));
    
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

  // Build hierarchical structure from flat category data
  const buildCategoryTreeFromFlat = (flatCategories: Category[]): Category[] => {
    console.log('CategoryTree: Building tree from flat data:', flatCategories.length);
    
    // Create a map for quick lookup
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    
    // First pass: create all categories with empty children arrays
    flatCategories.forEach(cat => {
      console.log('CategoryTree: Processing flat category:', {
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        level: cat.level
      });
      
      categoryMap.set(cat.id, {
        ...cat,
        children: []
      });
    });
    
    const rootCategories: Category[] = [];
    
    // Second pass: build the tree structure
    flatCategories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parent_id) {
        // This is a child category
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(categoryWithChildren);
          console.log(`CategoryTree: Added "${cat.name}" as child of "${parent.name}"`);
        } else {
          console.warn(`CategoryTree: Parent not found for category "${cat.name}" (parent_id: ${cat.parent_id})`);
          // If parent not found, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        // This is a root category
        rootCategories.push(categoryWithChildren);
        console.log(`CategoryTree: Added "${cat.name}" as root category`);
      }
    });
    
    console.log('CategoryTree: Tree building complete. Root categories:', rootCategories.length);
    return rootCategories;
  };

  // Flatten hierarchical categories to a flat list for easier processing
  const flattenCategories = (categories: Category[]): Category[] => {
    const flattened: Category[] = [];
    
    const flatten = (cats: Category[], depth: number = 0) => {
      console.log(`CategoryTree: Flattening at depth ${depth}, categories:`, cats.length);
      
      cats.forEach((cat, index) => {
        console.log(`CategoryTree: Processing category ${index} at depth ${depth}:`, {
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id,
          level: cat.level,
          hasChildren: !!(cat.children && cat.children.length > 0),
          childrenCount: cat.children?.length || 0
        });
        
        flattened.push(cat);
        
        if (cat.children && cat.children.length > 0) {
          console.log(`CategoryTree: Flattening ${cat.children.length} children of "${cat.name}"`);
          flatten(cat.children, depth + 1);
        }
      });
    };
    
    console.log('CategoryTree: Starting to flatten categories:', categories.length);
    flatten(categories);
    console.log('CategoryTree: Flattened result:', flattened.map(c => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id,
      level: c.level
    })));
    
    return flattened;
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
            <Text style={{ color: '#9ca3af', fontSize: 48 }}>📁</Text>
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
          <Text style={{ color: 'white', fontSize: 24 }}>➕</Text>
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
        availableCategories={(() => {
          console.log('CategoryTree: Passing flat categories to modal:', flatCategories.length);
          console.log('CategoryTree: Flat categories for modal:', flatCategories.map(c => ({
            id: c.id,
            name: c.name,
            parent_id: c.parent_id,
            level: c.level
          })));
          return flatCategories;
        })()}
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
  availableCategories?: Category[];
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  category,
  onClose,
  onSave,
  type,
  availableCategories = []
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('📄');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // Reset form when category changes or modal becomes visible
  React.useEffect(() => {
    if (visible) {
      console.log('=== CategoryModal: Modal opened ===');
      console.log('CategoryModal: Initializing form with category:', category);
      console.log('CategoryModal: Category parent_id:', category?.parent_id);
      console.log('CategoryModal: Available categories count:', availableCategories.length);
      
      setName(category?.name || '');
      setDescription(category?.description || '');
      setColor(category?.color || '#3b82f6');
      setIcon(category?.icon || '📄');
      
      // Handle parent_id properly - convert null/undefined to empty string
      let initialParentId = '';
      if (category?.parent_id) {
        initialParentId = String(category.parent_id);
      }
      
      console.log('CategoryModal: Setting parentId to:', `"${initialParentId}"`);
      setParentId(initialParentId);
      console.log('=== CategoryModal: Form initialization complete ===');
    } else {
      // Clear form when modal is closed
      console.log('CategoryModal: Modal closed, clearing form');
      setName('');
      setDescription('');
      setColor('#3b82f6');
      setIcon('📄');
      setParentId('');
    }
  }, [category, visible, availableCategories]);

  // Get available parent categories (exclude self and descendants to prevent circular references)
  const getAvailableParents = () => {
    console.log('CategoryModal: Available categories:', availableCategories.length);
    console.log('CategoryModal: Current category:', category?.id, category?.name);
    
    if (!category) {
      // For new categories, all categories are available as parents
      const newCategoryParents = availableCategories.filter(cat => cat.is_active);
      console.log('CategoryModal: New category - available parents:', newCategoryParents.length);
      return newCategoryParents;
    }

    // For editing, exclude the category itself and its descendants
    // BUT always include the current parent (even if it might be filtered otherwise)
    const editingParents = availableCategories.filter(cat => {
      // Always include the current parent
      if (category.parent_id && cat.id === category.parent_id) {
        return cat.is_active; // Only include if active
      }
      
      // For all other categories, exclude self and descendants
      return cat.is_active && 
             cat.id !== category.id && 
             !isDescendantOf(cat, category);
    });
    
    console.log('CategoryModal: Editing category - available parents:', editingParents.length);
    console.log('CategoryModal: Current parent_id should be:', category.parent_id);
    
    // Check if current parent is in the list
    if (category.parent_id) {
      const currentParent = editingParents.find(cat => cat.id === category.parent_id);
      console.log('CategoryModal: Current parent found in available list:', !!currentParent, currentParent?.name);
      
      // If current parent is still not found, there might be an issue with the data
      if (!currentParent) {
        console.warn('CategoryModal: Current parent not found in available categories!');
        console.log('CategoryModal: All available categories:', availableCategories.map(c => ({id: c.id, name: c.name, active: c.is_active})));
      }
    }
    
    return editingParents;
  };

  // Check if a category is a descendant of another category
  const isDescendantOf = (potentialDescendant: Category, ancestor: Category): boolean => {
    if (!potentialDescendant.parent_id) return false;
    if (potentialDescendant.parent_id === ancestor.id) return true;
    
    const parent = availableCategories.find(cat => cat.id === potentialDescendant.parent_id);
    return parent ? isDescendantOf(parent, ancestor) : false;
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const categoryData = {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        type,
        parent_id: parentId || undefined
      };

      if (category) {
        // Update existing category
        const result = await categoryService.updateCategory(category.id, categoryData);
        if (result.success) {
          onSave();
        } else {
          Alert.alert('Error', result.error || 'Failed to update category');
        }
      } else {
        // Create new category
        const result = await categoryService.createCategory(categoryData);
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
            <Text style={styles.inputLabel}>Parent Category</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={parentId}
                onValueChange={(value) => {
                  console.log('CategoryModal: Parent changed to:', value);
                  setParentId(value);
                }}
                style={styles.picker}
                enabled={!loading}
              >
                <Picker.Item label="No Parent Category" value="" />
                {(() => {
                  const availableParents = getAvailableParents();
                  console.log('CategoryModal: Rendering picker with parentId:', parentId);
                  console.log('CategoryModal: Available parent options:', availableParents.map(c => ({id: c.id, name: c.name})));
                  
                  return availableParents.map(cat => (
                    <Picker.Item
                      key={cat.id}
                      label={`${'  '.repeat((cat.level || 1) - 1)}${cat.name}`}
                      value={cat.id}
                    />
                  ));
                })()}
              </Picker>
            </View>
            <Text style={styles.helperText}>
              Select a parent to create a subcategory
            </Text>
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'white',
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 4,
    fontFamily: 'monospace',
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
