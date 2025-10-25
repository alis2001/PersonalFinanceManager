import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  position: { x: number; y: number };
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CategoryContextMenu: React.FC<CategoryContextMenuProps> = ({
  visible,
  category,
  onClose,
  onEdit,
  onDelete,
  onToggleActive,
  onAddSubcategory,
  position,
}) => {
  const { t } = useTranslation();

  if (!category) return null;

  const menuItems = [
    {
      icon: 'create-outline',
      label: t('common.edit'),
      action: () => {
        onEdit(category);
        onClose();
      },
      color: '#2196f3',
    },
    {
      icon: 'add-circle-outline',
      label: t('categories.addSubcategory'),
      action: () => {
        onAddSubcategory(category);
        onClose();
      },
      color: '#4caf50',
    },
    {
      icon: category.is_active ? 'pause-circle-outline' : 'play-circle-outline',
      label: category.is_active ? t('categories.deactivate') : t('categories.activate'),
      action: () => {
        onToggleActive(category);
        onClose();
      },
      color: category.is_active ? '#ff9800' : '#4caf50',
    },
    {
      icon: 'trash-outline',
      label: t('common.delete'),
      action: () => {
        onDelete(category.id);
        onClose();
      },
      color: '#f44336',
    },
  ];

  // Calculate menu position to ensure it stays within screen bounds
  const menuWidth = 200;
  const menuHeight = menuItems.length * 56 + 20;
  
  let adjustedX = position.x;
  let adjustedY = position.y;
  
  if (position.x + menuWidth > screenWidth) {
    adjustedX = screenWidth - menuWidth - 20;
  }
  
  if (position.y + menuHeight > screenHeight) {
    adjustedY = position.y - menuHeight - 10;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
          style={[
            styles.menuContainer,
            {
              left: adjustedX,
              top: adjustedY,
            }
          ]}
        >
          <View style={styles.menuHeader}>
            <View style={[styles.categoryIndicator, { backgroundColor: category.color }]} />
            <Text style={styles.categoryName} numberOfLines={1}>
              {category.name}
            </Text>
          </View>
          
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
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.menuItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 4,
  },
  categoryIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  lastMenuItem: {
    marginBottom: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
});

export default CategoryContextMenu;

