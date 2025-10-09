import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../services/AuthContext';
import pinService from '../services/pinService';
import authService from '../services/authService';

// Import components
import Welcome from '../components/Welcome';
import Login from '../components/Login';
import Register from '../components/Register';
import VerifyEmail from '../components/VerifyEmail';
import MainApp from '../components/MainApp';
import PINEntry from '../components/PINEntry';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email?: string; message?: string };
  PINEntry: undefined;
  MainApp: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [pinRequired, setPinRequired] = useState(false);
  const [checkingPIN, setCheckingPIN] = useState(true);

  useEffect(() => {
    checkPINRequirement();
  }, [isAuthenticated]);

  const checkPINRequirement = async () => {
    if (isAuthenticated) {
      const pinEnabled = await pinService.isPINEnabled();
      setPinRequired(pinEnabled);
    } else {
      setPinRequired(false);
    }
    setCheckingPIN(false);
  };

  const handlePINSuccess = () => {
    setPinRequired(false);
  };

  const handleForgotPIN = async () => {
    // Force logout and disable PIN
    await pinService.forceDisablePIN();
    await authService.clearTokens();
    setPinRequired(false);
    // This will trigger re-render and show login screen
  };

  if (isLoading || checkingPIN) {
    // Show loading screen while checking auth/PIN status
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
        pinRequired ? (
          // Authenticated with PIN enabled - show PIN entry screen
          <Stack.Screen name="PINEntry">
            {(props) => (
              <PINEntry
                {...props}
                onSuccess={handlePINSuccess}
                onForgotPIN={handleForgotPIN}
              />
            )}
          </Stack.Screen>
        ) : (
          // Authenticated without PIN or PIN verified - show main app
          <Stack.Screen name="MainApp" component={MainApp} />
        )
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