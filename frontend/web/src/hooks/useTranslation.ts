import { useState, useEffect } from 'react';
import translationService from '../services/translationService';

interface UseTranslationReturn {
  t: (key: string, params?: { [key: string]: string | number }) => string;
  currentLanguage: string;
  setLanguage: (language: string) => Promise<void>;
  isLoading: boolean;
}

export const useTranslation = (): UseTranslationReturn => {
  const [currentLanguage, setCurrentLanguage] = useState(translationService.getCurrentLanguage());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Subscribe to language changes
    const unsubscribe = translationService.onLanguageChange((newLanguage) => {
      setCurrentLanguage(newLanguage);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const t = (key: string, params?: { [key: string]: string | number }): string => {
    return translationService.t(key, params);
  };

  const setLanguage = async (language: string): Promise<void> => {
    setIsLoading(true);
    try {
      await translationService.setLanguage(language);
    } catch (error) {
      console.error('Error changing language:', error);
      setIsLoading(false);
    }
  };

  return {
    t,
    currentLanguage,
    setLanguage,
    isLoading
  };
};

export default useTranslation;

