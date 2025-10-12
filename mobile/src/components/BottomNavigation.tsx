import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

interface BottomNavigationProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  onAddExpense?: () => void;
  onSettings?: () => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeRoute, onNavigate, onAddExpense, onSettings }) => {
  const { t } = useTranslation();
  
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: t('navigation.dashboard'),
      icon: '🏠',
      route: 'Dashboard',
    },
    {
      id: 'transactions',
      label: t('navigation.expenses'),
      icon: '📋',
      route: 'Transactions',
    },
    {
      id: 'analytics',
      label: t('navigation.analytics'),
      icon: '📊',
      route: 'Analytics',
    },
    {
      id: 'categories',
      label: t('navigation.categories'),
      icon: '🏷️',
      route: 'Categories',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navigationBar}>
        {navigationItems.map((item) => {
          const isActive = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        
        {/* Central Add Expense Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddExpense}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonIcon}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingBottom: 55,
    paddingHorizontal: 20,
  },
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 20,
    minHeight: 60,
  },
  navItemActive: {
    backgroundColor: '#f8f9fa',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconContainerActive: {
    backgroundColor: '#1a1a1a',
    shadowColor: '#1a1a1a',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 18,
  },
  addButton: {
    position: 'absolute',
    top: -25,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  addButtonIcon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
    lineHeight: 28,
  },
});

export default BottomNavigation;
