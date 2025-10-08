import AsyncStorage from '@react-native-async-storage/async-storage';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

interface TranslationData {
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
    await AsyncStorage.setItem('preferred_language', languageCode);
    
    // Save to backend if user is authenticated
    await this.saveUserLanguagePreference(languageCode);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(languageCode));
  }

  // Subscribe to language changes
  onLanguageChange(callback: (language: string) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Translate function
  t(key: string, params?: { [key: string]: string | number }): string {
    const translation = this.getTranslation(key);
    
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key; // Return key as fallback
    }

    // Replace parameters
    if (params) {
      return this.replaceParams(translation, params);
    }

    return translation;
  }

  // Get translation by key
  private getTranslation(key: string): string | null {
    const keys = key.split('.');
    let current: any = this.translations[this.currentLanguage];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return typeof current === 'string' ? current : null;
  }

  // Replace parameters in translation
  private replaceParams(text: string, params: { [key: string]: string | number }): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  // Load translations
  private async loadTranslations(): Promise<void> {
    try {
      // Import translation files using require (React Native compatible)
      const enTranslations = require('../assets/locales/en.json');
      const faTranslations = require('../assets/locales/fa.json');
      const frTranslations = require('../assets/locales/fr.json');
      const esTranslations = require('../assets/locales/es.json');
      const deTranslations = require('../assets/locales/de.json');
      const arTranslations = require('../assets/locales/ar.json');

      this.translations = {
        en: enTranslations,
        fa: faTranslations,
        fr: frTranslations,
        es: esTranslations,
        de: deTranslations,
        ar: arTranslations,
      };
    } catch (error) {
      console.error('Error loading translations:', error);
      // Set empty translations as fallback
      this.translations = {
        en: {},
        fa: {},
        fr: {},
        es: {},
        de: {},
        ar: {},
      };
    }
  }

  // Load user language preference
  private async loadUserLanguage(): Promise<void> {
    try {
      // Try AsyncStorage first
      const storedLanguage = await AsyncStorage.getItem('preferred_language');
      if (storedLanguage && this.supportedLanguages.find(lang => lang.code === storedLanguage)) {
        this.currentLanguage = storedLanguage;
        return;
      }

      // Try to get from backend if user is authenticated
      await this.loadUserLanguageFromBackend();

      // If still no language set, try device language
      if (!this.currentLanguage || this.currentLanguage === 'en') {
        // Note: For React Native, we could use react-native-localize to get device language
        // For now, default to English
        this.currentLanguage = 'en';
      }
    } catch (error) {
      console.warn('Error loading user language:', error);
      this.currentLanguage = 'en';
    }
  }

  // Save user language preference to backend
  private async saveUserLanguagePreference(languageCode: string): Promise<void> {
    try {
      // Import authService dynamically to avoid circular dependency
      const { default: authService } = await import('./authService');
      
      if (!authService.isAuthenticated()) {
        return;
      }
      
      const success = await authService.updateLanguage(languageCode);
      if (!success) {
        console.warn('Failed to save language preference to backend');
      }
    } catch (error) {
      console.warn('Error saving language preference:', error);
    }
  }

  // Get user language preference from backend
  async loadUserLanguageFromBackend(): Promise<void> {
    try {
      // Import authService dynamically to avoid circular dependency
      const { default: authService } = await import('./authService');
      
      if (!authService.isAuthenticated()) {
        return;
      }
      
      const profile = await authService.getProfile();
      if (profile && profile.preferredLanguage && this.supportedLanguages.find(lang => lang.code === profile.preferredLanguage)) {
        this.currentLanguage = profile.preferredLanguage;
        await AsyncStorage.setItem('preferred_language', profile.preferredLanguage);
      }
    } catch (error) {
      console.warn('Error loading user language from backend:', error);
    }
  }

  // Set language based on user's currency (IRR = Persian, others = English)
  setLanguageBasedOnCurrency(): void {
    try {
      // Import authService dynamically to avoid circular dependency
      import('./authService').then(({ default: authService }) => {
        const user = authService.getUser();
        
        if (user && user.defaultCurrency) {
          // IRR users default to Persian, others default to English
          const currencyBasedLanguage = user.defaultCurrency === 'IRR' ? 'fa' : 'en';
          if (this.supportedLanguages.find(lang => lang.code === currencyBasedLanguage)) {
            this.currentLanguage = currencyBasedLanguage;
            AsyncStorage.setItem('preferred_language', currencyBasedLanguage);
            // Notify listeners
            this.listeners.forEach(listener => listener(currencyBasedLanguage));
          }
        }
      }).catch((error) => {
        console.warn('Error setting language based on currency:', error);
      });
    } catch (error) {
      console.warn('Error setting language based on currency:', error);
    }
  }
}

// Create singleton instance
const translationService = new TranslationService();
export default translationService;