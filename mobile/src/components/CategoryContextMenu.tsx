import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
// import { Ionicons } from '@expo/vector-icons'; // Temporarily commented to avoid import issues
import { Category } from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';

interface CategoryContextMenuProps {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleActive: (category: Category) => void;
  onAddSubcategory: (category: Category) => void;
  hasExpenses?: boolean;
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
}) => {
  const { t } = useTranslation();
  const [isDeleteConfirmMode, setIsDeleteConfirmMode] = useState(false);

  // Reset delete confirm mode when menu becomes visible or category changes
  useEffect(() => {
    if (visible) {
      setIsDeleteConfirmMode(false);
    }
  }, [visible, category?.id]);

  if (!category) return null;

  // Icon mapping for text alternatives
  const getIconText = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'create-outline': '✏️',
      'add-circle-outline': '➕',
      'pause-circle-outline': '⏸️',
      'play-circle-outline': '▶️',
      'trash-outline': '🗑️',
      'checkmark-circle-outline': '✅',
      'close-circle-outline': '❌',
    };
    return iconMap[iconName] || '•';
  };

  // Base menu items - conditionally include subcategory option
  const baseMenuItems = [
    {
      icon: 'create-outline',
      label: t('common.edit'),
      action: () => {
        onEdit(category);
        onClose();
      },
      color: '#2196f3',
    },
    // Only show "Add Subcategory" if category doesn't have expenses
    ...(hasExpenses ? [] : [{
      icon: 'add-circle-outline',
      label: t('categories.addSubcategory'),
      action: () => {
        onAddSubcategory(category);
        onClose();
      },
      color: '#4caf50',
    }]),
    {
      icon: category.is_active ? 'pause-circle-outline' : 'play-circle-outline',
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
      icon: 'checkmark-circle-outline',
      label: t('categories.confirmDelete'),
      action: () => {
        onDelete(category.id);
        onClose();
      },
      color: '#ff5722',
    },
    {
      icon: 'close-circle-outline', 
      label: t('common.cancel'),
      action: () => {
        setIsDeleteConfirmMode(false);
      },
      color: '#757575',
    },
  ] : [
    {
      icon: 'trash-outline',
      label: t('common.delete'),
      action: () => {
        setIsDeleteConfirmMode(true);
      },
      color: '#f44336',
    },
  ];

  const menuItems = [...baseMenuItems, ...deleteMenuItems];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header with close button */}
          <View style={[
            styles.modalHeader,
            isDeleteConfirmMode && styles.modalHeaderDeleteMode
          ]}>
            <View style={styles.headerContent}>
              <View style={[
                styles.categoryIndicator, 
                { backgroundColor: isDeleteConfirmMode ? '#ff5722' : category.color }
              ]} />
              <Text style={[
                styles.modalTitle,
                isDeleteConfirmMode && styles.modalTitleDeleteMode
              ]} numberOfLines={1}>
                {isDeleteConfirmMode 
                ? `Delete "${category.name}"?` 
                : `${category.name}${!category.is_active ? ' (Inactive)' : ''}`
              }
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Menu items */}
          <View style={styles.modalContent}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.lastMenuItem
                ]}
                onPress={item.action}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                  <Text style={{ fontSize: 18, color: item.color }}>
                    {getIconText(item.icon)}
                  </Text>
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  modalHeaderDeleteMode: {
    backgroundColor: '#d32f2f',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalTitleDeleteMode: {
    color: '#ffffff',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
  modalContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  lastMenuItem: {
    marginBottom: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
});

export default CategoryContextMenu;

