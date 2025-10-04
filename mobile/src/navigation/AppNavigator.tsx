import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../services/AuthContext';

// Import components
import Welcome from '../components/Welcome';
import Login from '../components/Login';
import Register from '../components/Register';
import VerifyEmail from '../components/VerifyEmail';
import MainApp from '../components/MainApp';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email?: string; message?: string };
  MainApp: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Show loading screen
    return null;
  }

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFFFF' }
      }}
    >
      {isAuthenticated ? (
        // Authenticated user - show main app with bottom navigation
        <Stack.Screen name="MainApp" component={MainApp} />
      ) : (
        // Not authenticated - show auth screens
        <>
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;