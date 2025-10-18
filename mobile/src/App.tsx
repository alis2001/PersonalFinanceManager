import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { AuthProvider } from './services/AuthContext';
import { AppRefreshProvider } from './services/AppRefreshContext';
import ErrorBoundary from './components/ErrorBoundary';
import { errorHandler } from './services/ErrorHandler';
import AppNavigator from './navigation/AppNavigator';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize error handler
    errorHandler.initialize();
    
    // Cleanup on unmount
    return () => {
      errorHandler.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRefreshProvider>
          <NavigationContainer>
            <StatusBar 
              barStyle="dark-content" 
              backgroundColor="#ffffff" 
              translucent={false}
            />
            <AppNavigator />
          </NavigationContainer>
        </AppRefreshProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;