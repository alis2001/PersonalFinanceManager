// Simple translation hook for mobile
import { useState, useEffect } from 'react';

interface TranslationHook {
  t: (key: string, params?: Record<string, any>) => string;
  currentLanguage: string;
}

export const useTranslation = (): TranslationHook => {
  const [currentLanguage] = useState('en');

  const t = (key: string, params?: Record<string, any>): string => {
    // Simple translation function - for now just return the key
    // In a real implementation, this would load translations from JSON files
    const translations: Record<string, string> = {
      'welcome.title': 'Welcome to Rapilot',
      'welcome.subtitle': 'Your Personal Finance Manager',
      'welcome.description': 'Take control of your finances with our comprehensive expense tracking and analytics platform.',
      'welcome.getStarted': 'Get Started',
      'auth.welcomeBack': 'Welcome Back',
      'auth.loginSubtitle': 'Sign in to your account',
      'auth.email': 'Email',
      'auth.emailPlaceholder': 'Enter your email',
      'auth.password': 'Password',
      'auth.passwordPlaceholder': 'Enter your password',
      'auth.login': 'Login',
      'auth.loggingIn': 'Logging in...',
      'auth.createAccount': 'Create Account',
      'auth.registerSubtitle': 'Join Rapilot today',
      'auth.firstName': 'First Name',
      'auth.firstNamePlaceholder': 'First name',
      'auth.lastName': 'Last Name',
      'auth.lastNamePlaceholder': 'Last name',
      'auth.confirmPassword': 'Confirm Password',
      'auth.confirmPasswordPlaceholder': 'Confirm your password',
      'auth.register': 'Register',
      'auth.creatingAccount': 'Creating account...',
      'auth.verifyEmail': 'Verify Your Email',
      'auth.verifyEmailSubtitle': 'We sent a verification link to',
      'auth.verifyEmailInstruction': 'Please check your email and click the verification link to activate your account.',
      'auth.resendEmail': 'Resend Email',
      'common.error': 'Error',
      'common.logout': 'Logout',
      'common.cancel': 'Cancel',
    };

    let translation = translations[key] || key;
    
    // Simple parameter replacement
    if (params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, params[param]);
      });
    }
    
    return translation;
  };

  return {
    t,
    currentLanguage,
  };
};
