import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../services/AuthContext';

interface LoginProps {
  navigation?: any;
}

const Login: React.FC<LoginProps> = ({ navigation }) => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (result.success) {
      // Navigation handled by AuthContext or AppNavigator
    } else {
      if (result.requiresVerification) {
        navigation.navigate('VerifyEmail', { 
          email: email,
          message: result.message || 'Please verify your email address before logging in.'
        });
      } else {
        setError(result.error || 'Login failed');
      }
    }
    
    setLoading(false);
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.loginForm}>
            {error ? (
              <View style={styles.errorMessage}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            
            <View style={styles.formGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <TouchableOpacity 
              style={[styles.btnPrimary, loading && styles.btnPrimaryDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.loginFooter}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text 
                style={styles.linkButton}
                onPress={handleRegister}
              >
                Sign up
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 20,
  },
  loginContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    paddingVertical: 60,
    paddingHorizontal: 40,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 28, // 1.8rem
    fontWeight: '300',
    marginBottom: 10,
    marginTop: 0,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  subtitle: {
    color: '#666666',
    fontSize: 15, // 0.95rem
    margin: 0,
    fontWeight: '400',
    textAlign: 'center',
  },
  loginForm: {
    marginBottom: 40,
  },
  formGroup: {
    marginBottom: 24,
  },
  input: {
    width: '100%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderRadius: 0,
    fontSize: 16, // 1rem
    backgroundColor: 'transparent',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    color: '#1a1a1a',
  },
  errorMessage: {
    backgroundColor: '#fafafa',
    padding: 16,
    borderRadius: 2,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14, // 0.9rem
    textAlign: 'center',
    fontWeight: '400',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    paddingVertical: 18,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: 0.01,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 16, // 1rem
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  btnPrimaryDisabled: {
    opacity: 0.5,
  },
  loginFooter: {
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 30,
  },
  footerText: {
    color: '#666666',
    fontSize: 14, // 0.9rem
    fontWeight: '400',
  },
  linkButton: {
    color: '#1a1a1a',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default Login;