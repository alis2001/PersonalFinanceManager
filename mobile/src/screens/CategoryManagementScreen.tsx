import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CategoryTree from '../components/CategoryTree';
import { Category } from '../services/categoryService';

interface CategoryManagementScreenProps {
  navigation: any;
}

const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = ({
  navigation,
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'analytics'>('tree');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh logic will be handled by CategoryTree component
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    // You could navigate to a category details screen here
    Alert.alert(
      'Category Selected',
      `Selected: ${category.name}\nLevel: ${category.level}\nType: ${category.type}`,
      [{ text: 'OK' }]
    );
  };

  const renderTreeTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <CategoryTree
        onCategorySelect={handleCategorySelect}
        showActions={true}
        type="expense"
      />
    </ScrollView>
  );

  const renderAnalyticsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.placeholderContainer}>
        <Ionicons name="bar-chart-outline" size={64} color="#9ca3af" />
        <Text style={styles.placeholderTitle}>Category Analytics</Text>
        <Text style={styles.placeholderSubtitle}>
          Hierarchical category analytics will be implemented here.
          This will show spending breakdowns by category levels and sub-categories.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Category Management</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            Alert.alert(
              'Settings',
              'Category settings will be available here',
              [{ text: 'OK' }]
            );
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tree' && styles.activeTab]}
          onPress={() => setActiveTab('tree')}
        >
          <Ionicons
            name="folder-outline"
            size={20}
            color={activeTab === 'tree' ? '#3b82f6' : '#6b7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'tree' && styles.activeTabText,
            ]}
          >
            Category Tree
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color={activeTab === 'analytics' ? '#3b82f6' : '#6b7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'analytics' && styles.activeTabText,
            ]}
          >
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'tree' && renderTreeTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  settingsButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  tabContent: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CategoryManagementScreen;
