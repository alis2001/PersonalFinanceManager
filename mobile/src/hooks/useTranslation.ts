import { useState, useEffect } from 'react';
import translationService from '../services/translationService';

export const useTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState(translationService.getCurrentLanguage());

  useEffect(() => {
    // Subscribe to language changes
    const unsubscribe = translationService.onLanguageChange((language) => {
      setCurrentLanguage(language);
    });

    return unsubscribe;
  }, []);

  const t = (key: string, params?: { [key: string]: string | number }): string => {
    return translationService.t(key, params);
  };

  const setLanguage = async (languageCode: string): Promise<void> => {
    await translationService.setLanguage(languageCode);
  };

  const getSupportedLanguages = () => {
    return translationService.getSupportedLanguages();
  };

  return {
    t,
    currentLanguage,
    setLanguage,
    getSupportedLanguages,
  };
};