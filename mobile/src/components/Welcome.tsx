import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WelcomeProps {
  navigation?: any;
}

const Welcome: React.FC<WelcomeProps> = ({ navigation }) => {
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');

  useEffect(() => {
    const createGlowAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnimation, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnimation, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    createGlowAnimation();
  }, [glowAnimation]);

  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  const handleRegister = () => {
    if (navigation) {
      navigation.navigate('Register');
    }
  };

  // Calculate responsive font size like the web version (clamp(2.5rem, 7vw, 4.5rem))
  const responsiveFontSize = Math.max(40, Math.min(72, width * 0.175)); // 7vw equivalent
  const responsiveMarginBottom = Math.max(60, Math.min(120, width * 0.2)); // 8vh equivalent

  const textShadowColor = glowAnimation.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      'rgba(255, 255, 255, 0.8)',
      'rgba(204, 204, 204, 0.7)',
      'rgba(170, 170, 170, 0.6)',
      'rgba(221, 221, 221, 0.7)',
      'rgba(255, 255, 255, 0.8)',
    ],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.Text 
          style={[
            styles.title, 
            { 
              fontSize: responsiveFontSize,
              marginBottom: responsiveMarginBottom,
              textShadowColor: textShadowColor,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 15,
            }
          ]}
        >
          Rapilot
        </Animated.Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={handleRegister}
            activeOpacity={0.8}
          >
            <Text style={styles.registerButtonText}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 0,
    color: '#ffffff',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  loginButton: {
    backgroundColor: 'black',
    borderWidth: 2,
    borderColor: 'white',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  registerButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'black',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  registerButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default Welcome;