import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from './BottomNavigation';

interface AnalyticsProps {
  navigation?: any;
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  onAddExpense?: () => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ navigation, activeRoute = 'Analytics', onNavigate, onAddExpense }) => {
  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Financial insights and reports</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📊</Text>
          <Text style={styles.placeholderTitle}>Analytics Dashboard</Text>
          <Text style={styles.placeholderText}>
            Coming soon! This will show your financial analytics, charts, and insights.
          </Text>
        </View>
      </View>

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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 24,
    fontWeight: '300',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '400',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 20, // Minimal space for bottom navigation
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default Analytics;