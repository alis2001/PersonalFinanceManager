// Translation Service for Mobile
// Handles internationalization and language management

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface TranslationData {
  [key: string]: string | TranslationData;
}

class TranslationService {
  private currentLanguage: string = 'en';
  private translations: { [language: string]: TranslationData } = {};
  private listeners: Array<(language: string) => void> = [];

  // Supported languages
  private readonly supportedLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' }
  ];

  constructor() {
    this.loadTranslations();
    this.loadUserLanguage();
  }

  // Get supported languages
  getSupportedLanguages(): Language[] {
    return this.supportedLanguages;
  }

  // Get current language
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  // Set language
  async setLanguage(languageCode: string): Promise<void> {
    if (!this.supportedLanguages.find(lang => lang.code === languageCode)) {
      console.warn(`Language ${languageCode} is not supported`);
      return;
    }

    this.currentLanguage = languageCode;
    
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('preferred_language', languageCode);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }

    this.notifyListeners();
  }

  // Load user's preferred language
  private async loadUserLanguage(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const savedLanguage = await AsyncStorage.getItem('preferred_language');
      if (savedLanguage && this.supportedLanguages.find(lang => lang.code === savedLanguage)) {
        this.currentLanguage = savedLanguage;
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  }

  // Load translations from backend
  async loadUserLanguageFromBackend(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const token = await AsyncStorage.getItem('accessToken');
      
      if (!token) {
        return;
      }

      const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.123:8080/api';
      const response = await fetch(`${baseURL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.preferred_language) {
          await this.setLanguage(userData.preferred_language);
        }
      }
    } catch (error) {
      console.error('Error loading language from backend:', error);
    }
  }

  // Load translations (simplified for mobile)
  private loadTranslations(): void {
    // Basic translations for mobile
    this.translations = {
      en: {
        common: {
          save: 'Save',
          cancel: 'Cancel',
          delete: 'Delete',
          edit: 'Edit',
          add: 'Add',
          loading: 'Loading...',
          error: 'Error',
          success: 'Success',
          logout: 'Logout',
        },
        dashboard: {
          welcome: 'Welcome, {{name}}',
          weeklyExpenses: 'Weekly Expenses',
          monthlyExpenses: 'Monthly Expenses',
          yearlyExpenses: 'Yearly Expenses',
          transactions: 'transactions',
        },
        auth: {
          login: 'Login',
          register: 'Register',
          email: 'Email',
          password: 'Password',
          confirmPassword: 'Confirm Password',
        },
      },
      fr: {
        common: {
          save: 'Enregistrer',
          cancel: 'Annuler',
          delete: 'Supprimer',
          edit: 'Modifier',
          add: 'Ajouter',
          loading: 'Chargement...',
          error: 'Erreur',
          success: 'Succès',
          logout: 'Déconnexion',
        },
        dashboard: {
          welcome: 'Bienvenue, {{name}}',
          weeklyExpenses: 'Dépenses Hebdomadaires',
          monthlyExpenses: 'Dépenses Mensuelles',
          yearlyExpenses: 'Dépenses Annuelles',
          transactions: 'transactions',
        },
        auth: {
          login: 'Connexion',
          register: 'S\'inscrire',
          email: 'Email',
          password: 'Mot de passe',
          confirmPassword: 'Confirmer le mot de passe',
        },
      },
    };
  }

  // Translate function
  t(key: string, options?: { [key: string]: string | number }): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        value = this.translations['en'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if translation not found
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace placeholders
    if (options) {
      for (const [optionKey, optionValue] of Object.entries(options)) {
        value = value.replace(new RegExp(`{{${optionKey}}}`, 'g'), String(optionValue));
      }
    }

    return value;
  }

  // Subscribe to language changes
  subscribe(listener: (language: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify listeners of language changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  // Format date according to current language
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.currentLanguage, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  // Format number according to current language
  formatNumber(number: number): string {
    return new Intl.NumberFormat(this.currentLanguage).format(number);
  }

  // Format currency according to current language
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(this.currentLanguage, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }
}

const translationService = new TranslationService();
export default translationService;
