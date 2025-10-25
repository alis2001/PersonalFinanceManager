import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';

interface CategoryTreeSelectorProps {
  categories: Category[];
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: 'income' | 'expense' | 'both';
  allowEmpty?: boolean;
}

const CategoryTreeSelector: React.FC<CategoryTreeSelectorProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect,
  disabled = false,
  placeholder = 'Select Category',
  type = 'expense',
  allowEmpty = false
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Flatten hierarchical categories to a flat list
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

  const selectedCategory = flattenCategories(categories).find(cat => cat.id === selectedCategoryId);

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

  // Check if a category is a leaf category (has no subcategories)
  const isLeafCategory = (category: Category): boolean => {
    // Use flattened categories for leaf check
    const flatCategories = flattenCategories(categories);
    return !flatCategories.some(cat => cat.parent_id === category.id);
  };

  // Build hierarchical category name (e.g., "Home → Food → Groceries")
  const getHierarchicalCategoryName = (category: Category): string => {
    if (!category.parent_id) {
      return getTranslatedCategoryName(category.name);
    }
    
    const flatCategories = flattenCategories(categories);
    const buildPath = (cat: Category): string[] => {
      const path = [getTranslatedCategoryName(cat.name)];
      if (cat.parent_id) {
        const parent = flatCategories.find(c => c.id === cat.parent_id);
        if (parent) {
          return [...buildPath(parent), ...path];
        }
      }
      return path;
    };
    
    return buildPath(category).join(' → ');
  };

  // Get category path for display
  const getCategoryPath = (category: Category): string => {
    if (category.path) {
      return category.path.split('/').map(part => getTranslatedCategoryName(part)).join(' → ');
    }
    return getHierarchicalCategoryName(category);
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

  const handleCategoryClick = (category: Category) => {
    // Only allow selection of leaf categories (categories without subcategories)
    if (isLeafCategory(category)) {
      onCategorySelect(category.id);
      setIsOpen(false);
    } else {
      // If it has subcategories, toggle expansion instead
      toggleCategoryExpansion(category.id);
    }
  };

  // Get the full hierarchical path for display
  const getFullCategoryPath = (category: Category): string => {
    const flatCategories = flattenCategories(categories);
    const buildPath = (cat: Category): string[] => {
      const path = [getTranslatedCategoryName(cat.name)];
      if (cat.parent_id) {
        const parent = flatCategories.find(c => c.id === cat.parent_id);
        if (parent) {
          return [...buildPath(parent), ...path];
        }
      }
      return path;
    };
    
    return buildPath(category).join(' → ');
  };

  // Build category tree structure
  const buildCategoryTree = (categories: Category[]) => {
    // If categories have hierarchical structure, use it directly
    if (categories.some(cat => cat.children && cat.children.length > 0)) {
      return categories.filter(cat => !cat.parent_id);
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

  const renderCategoryTree = (category: Category & { children: Category[] }, level: number = 0): JSX.Element => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const isLeaf = isLeafCategory(category);
    const isSelected = selectedCategoryId === category.id;
    const indentLevel = level * 12; // Reduced from 20 to 12 for better spacing

    return (
      <View key={category.id} style={styles.categoryTreeItem}>
        <TouchableOpacity
          style={[
            styles.categoryTreeNode,
            isSelected && styles.categoryTreeNodeSelected,
            isLeaf && styles.categoryTreeNodeSelectable,
            !isLeaf && styles.categoryTreeNodeNonSelectable
          ]}
          onPress={() => handleCategoryClick(category)}
          disabled={disabled}
        >
          <View style={[styles.categoryItemContent, { marginLeft: indentLevel }]}>
            <View style={styles.categoryTreeControls}>
              {hasChildren && (
                <TouchableOpacity
                  style={styles.treeExpandBtn}
                  onPress={() => toggleCategoryExpansion(category.id)}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color="#6c757d"
                  />
                </TouchableOpacity>
              )}
              {!hasChildren && <View style={styles.treeSpacer} />}
            </View>
            
            <View style={styles.categoryInfo}>
              <View 
                style={[
                  styles.categoryIconSmall,
                  { backgroundColor: isLeaf ? '#f8f9fa' : '#fff3cd' }
                ]}
              >
                <Text style={styles.categoryIconText}>{category.icon}</Text>
              </View>
              <View style={styles.categoryNameContainer}>
                <Text style={[
                  styles.categoryName,
                  !isLeaf && styles.nonSelectableCategoryName
                ]}>
                  {getTranslatedCategoryName(category.name)}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {hasChildren && isExpanded && (
          <View style={styles.categoryChildren}>
            {category.children?.map(child => renderCategoryTree(child as Category & { children: Category[] }, level + 1))}
          </View>
        )}
      </View>
    );
  };

  const categoryTree = buildCategoryTree(categories);

  return (
    <View style={styles.categoryTreeSelector}>
      <TouchableOpacity
        style={[
          styles.categorySelectorTrigger,
          isOpen && styles.categorySelectorTriggerOpen,
          disabled && styles.categorySelectorTriggerDisabled
        ]}
        onPress={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedCategory ? (
          <View style={styles.selectedCategory}>
            <View 
              style={[
                styles.categoryIconSmall,
                { backgroundColor: selectedCategory.color + '20', color: selectedCategory.color }
              ]}
            >
              <Text style={styles.categoryIconText}>{selectedCategory.icon}</Text>
            </View>
            <Text style={styles.selectedCategoryName}>
              {getFullCategoryPath(selectedCategory)}
            </Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{t(placeholder)}</Text>
        )}
        <Ionicons 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color="#6c757d" 
        />
      </TouchableOpacity>
      
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.categoryTreeDropdown}>
            <View style={styles.categoryTreeHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <Ionicons name="close" size={20} color="#6c757d" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryTreeContent} showsVerticalScrollIndicator={true}>
              {categoryTree.length === 0 ? (
                <View style={styles.noCategories}>
                  <Text style={styles.noCategoriesText}>
                    {t('categories.noCategoriesAvailable')}
                  </Text>
                </View>
              ) : (
                <>
                  {allowEmpty && (
                    <TouchableOpacity
                      style={[styles.categoryTreeNode, styles.clearSelectionNode]}
                      onPress={() => {
                        onCategorySelect('');
                        setIsOpen(false);
                      }}
                    >
                      <View style={styles.categoryItemContent}>
                        <View style={styles.categoryInfo}>
                          <View style={styles.clearSelectionIcon}>
                            <Text style={styles.categoryIconText}>🗑️</Text>
                          </View>
                          <View style={styles.categoryNameContainer}>
                            <Text style={styles.clearSelectionText}>
                              {t('common.clearSelection')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  {categoryTree.map(category => renderCategoryTree(category))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  categoryTreeSelector: {
    position: 'relative',
    width: '100%',
  },
  categorySelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  categorySelectorTriggerOpen: {
    borderColor: '#1a1a1a',
    shadowColor: '#1a1a1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categorySelectorTriggerDisabled: {
    backgroundColor: '#f8f9fa',
    opacity: 0.6,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  placeholder: {
    color: '#6c757d',
    fontStyle: 'italic',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  categoryTreeDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    maxHeight: 400,
    width: '90%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  categoryTreeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  treeHeaderText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  categoryTreeContent: {
    maxHeight: 300,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  categoryTreeItem: {
    marginBottom: 2,
  },
  categoryTreeNode: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 6,
    marginVertical: 1,
  },
  categoryTreeNodeSelected: {
    backgroundColor: '#e3f2fd',
  },
  categoryTreeNodeSelectable: {
    // Leaf categories can be selected
  },
  categoryTreeNodeNonSelectable: {
    opacity: 0.7,
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTreeControls: {
    alignItems: 'center',
    marginRight: 8,
    width: 20,
  },
  treeExpandBtn: {
    padding: 2,
  },
  treeSpacer: {
    width: 20,
    height: 20,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  categoryIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconText: {
    fontSize: 12,
  },
  categoryNameContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  nonSelectableIndicator: {
    fontSize: 11,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 2,
  },
  nonSelectableCategoryName: {
    color: '#6c757d',
    fontStyle: 'italic',
  },
  categoryChildren: {
    borderLeftWidth: 1,
    borderLeftColor: '#e1e5e9',
    marginLeft: 16,
    paddingLeft: 8,
    backgroundColor: '#fafbfc',
  },
  noCategories: {
    padding: 20,
    alignItems: 'center',
  },
  noCategoriesText: {
    color: '#6c757d',
    fontStyle: 'italic',
    fontSize: 14,
  },
  clearSelectionNode: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    marginBottom: 4,
  },
  clearSelectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clearSelectionText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});

export default CategoryTreeSelector;
