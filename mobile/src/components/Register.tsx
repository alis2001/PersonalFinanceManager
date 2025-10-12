import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../services/AuthContext';
import currencyService from '../services/currencyService';
import { useTranslation } from '../hooks/useTranslation';

interface RegisterProps {
  navigation?: any;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'personal' | 'business';
  companyName: string;
  defaultCurrency: string;
  acceptTerms: boolean;
  marketingConsent: boolean;
}

const Register: React.FC<RegisterProps> = ({ navigation }) => {
  const { register } = useAuth();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'personal',
    companyName: '',
    defaultCurrency: currencyService.getSuggestedCurrency(),
    acceptTerms: false,
    marketingConsent: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allCurrencies] = useState(currencyService.getAllCurrencies());

  const handleChange = (field: keyof RegisterFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(formData.password)) {
      return 'Password must contain uppercase, lowercase, number and special character';
    }
    
    if (formData.accountType === 'business' && !formData.companyName.trim()) {
      return 'Company name is required for business accounts';
    }
    
    if (!formData.acceptTerms) {
      return 'You must accept the terms and conditions';
    }
    
    return null;
  };

  const handleSubmit = async () => {
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const registrationData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      accountType: formData.accountType,
      companyName: formData.accountType === 'business' ? formData.companyName : undefined,
      defaultCurrency: formData.defaultCurrency,
      acceptTerms: formData.acceptTerms,
      marketingConsent: formData.marketingConsent,
    };
    
    const result = await register(registrationData);
    
    if (result.success) {
      // Fully successful registration (auto-login)
      Alert.alert('Registration Successful', 'Welcome to Rapilot Finance!');
      // User is already logged in, no need to navigate
    } else if (result.requiresVerification) {
      // Registration created but needs email verification
      Alert.alert('Registration Successful', result.message || 'Please check your email for verification code.');
      navigation.navigate('VerifyEmail', { email: formData.email });
    } else {
      // Registration failed
      setError(result.error || 'Registration failed');
    }
    
    setLoading(false);
  };

  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.registerContainer}>
            <View style={styles.registerHeader}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your financial journey</Text>
            </View>

            <View style={styles.registerForm}>
              {error ? (
                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              
              {/* Account Type Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.pickerLabel}>Account Type</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.accountType}
                    onValueChange={(itemValue) => handleChange('accountType', itemValue)}
                    style={styles.picker}
                    enabled={!loading}
                  >
                    <Picker.Item label={t('auth.personal')} value="personal" />
                    <Picker.Item label={t('auth.business')} value="business" />
                  </Picker>
                </View>
              </View>

              {/* Company Name - Only for business accounts */}
              {formData.accountType === 'business' && (
                <View style={styles.formGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.companyName')}
                    placeholderTextColor="#999999"
                    value={formData.companyName}
                    onChangeText={(value) => handleChange('companyName', value)}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              )}

              {/* Currency Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.pickerLabel}>Currency</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.defaultCurrency}
                    onValueChange={(itemValue) => handleChange('defaultCurrency', itemValue)}
                    style={styles.picker}
                    enabled={!loading}
                  >
                    {allCurrencies.map((currency) => (
                      <Picker.Item key={currency.code} label={`${currency.symbol} ${currency.name} (${currency.code})`} value={currency.code} />
                    ))}
                  </Picker>
                </View>
                <Text style={styles.formHelp}>
                  All your transactions will be recorded in this currency
                </Text>
              </View>
              
              <View style={styles.formRow}>
                <View style={styles.formRowGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.firstName')}
                    placeholderTextColor="#999999"
                    value={formData.firstName}
                    onChangeText={(value) => handleChange('firstName', value)}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
                <View style={styles.formRowGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.lastName')}
                    placeholderTextColor="#999999"
                    value={formData.lastName}
                    onChangeText={(value) => handleChange('lastName', value)}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.email')}
                  placeholderTextColor="#999999"
                  value={formData.email}
                  onChangeText={(value) => handleChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              <View style={styles.formGroup}>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.password')}
                  placeholderTextColor="#999999"
                  value={formData.password}
                  onChangeText={(value) => handleChange('password', value)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              <View style={styles.formGroup}>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor="#999999"
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleChange('confirmPassword', value)}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* Terms and Conditions */}
              <View style={styles.formGroup}>
                <View style={styles.checkboxGroup}>
                  <Switch
                    value={formData.acceptTerms}
                    onValueChange={(value) => handleChange('acceptTerms', value)}
                    disabled={loading}
                    trackColor={{ false: '#e0e0e0', true: '#1a1a1a' }}
                    thumbColor={formData.acceptTerms ? '#ffffff' : '#ffffff'}
                  />
                  <Text style={styles.checkboxLabel}>
                    I accept the <Text style={styles.linkButton} onPress={() => Alert.alert('Terms and Conditions')}>Terms and Conditions</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.btnPrimary, loading && styles.btnPrimaryDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.btnPrimaryText}>
                  {loading ? t('common.loading') : t('auth.createAccount')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.registerFooter}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text 
                  style={styles.linkButton}
                  onPress={handleLogin}
                >
                  Sign in
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: '#fafafa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  registerContainer: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    paddingVertical: 40,
    paddingHorizontal: 30,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  registerHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 10,
    marginTop: 0,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  subtitle: {
    color: '#666666',
    fontSize: 15,
    margin: 0,
    fontWeight: '400',
    textAlign: 'center',
  },
  registerForm: {
    marginBottom: 30,
  },
  formRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRowGroup: {
    flex: 1,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderRadius: 0,
    fontSize: 16,
    backgroundColor: 'transparent',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    color: '#1a1a1a',
  },
  errorMessage: {
    backgroundColor: '#fafafa',
    padding: 14,
    borderRadius: 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '400',
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#1a1a1a',
  },
  formHelp: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
    fontWeight: '400',
  },
  checkboxGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666666',
    flexShrink: 1,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: 0.01,
    marginTop: 10,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  btnPrimaryDisabled: {
    opacity: 0.5,
  },
  registerFooter: {
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 25,
  },
  footerText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '400',
  },
  linkButton: {
    color: '#1a1a1a',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default Register;