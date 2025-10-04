import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { AuthProvider } from './services/AuthContext';
import AppNavigator from './navigation/AppNavigator';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor="#ffffff" 
          translucent={false}
        />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
};

export default App;