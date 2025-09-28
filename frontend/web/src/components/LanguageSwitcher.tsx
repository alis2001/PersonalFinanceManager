import React, { useState, useEffect } from 'react';
import translationService from '../services/translationService';
import '../styles/LanguageSwitcher.css';

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '', 
  showLabel = true, 
  compact = false 
}) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get current language
    setCurrentLanguage(translationService.getCurrentLanguage());

    // Subscribe to language changes
    const unsubscribe = translationService.onLanguageChange((newLanguage) => {
      setCurrentLanguage(newLanguage);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(false);
    
    try {
      await translationService.setLanguage(languageCode);
    } catch (error) {
      console.error('Error changing language:', error);
      setIsLoading(false);
    }
  };

  const supportedLanguages = translationService.getSupportedLanguages();
  const currentLang = supportedLanguages.find(lang => lang.code === currentLanguage);

  if (compact) {
    return (
      <div className={`language-switcher-compact ${className}`}>
        <button
          className="language-switcher-button-compact"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          title={currentLang?.nativeName || 'Language'}
        >
          <span className="language-flag">{currentLang?.flag}</span>
          {isLoading && <span className="loading-spinner">⟳</span>}
        </button>
        
        {isOpen && (
          <div className="language-dropdown-compact">
            {supportedLanguages.map((language) => (
              <button
                key={language.code}
                className={`language-option-compact ${
                  language.code === currentLanguage ? 'active' : ''
                }`}
                onClick={() => handleLanguageChange(language.code)}
              >
                <span className="language-flag">{language.flag}</span>
                <span className="language-name">{language.nativeName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`language-switcher ${className}`}>
      {showLabel && (
        <label className="language-label">
          {translationService.t('settings.language')}:
        </label>
      )}
      
      <div className="language-selector">
        <button
          className="language-switcher-button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
        >
          <span className="language-flag">{currentLang?.flag}</span>
          <span className="language-name">{currentLang?.nativeName}</span>
          <span className="dropdown-arrow">▼</span>
          {isLoading && <span className="loading-spinner">⟳</span>}
        </button>
        
        {isOpen && (
          <div className="language-dropdown">
            {supportedLanguages.map((language) => (
              <button
                key={language.code}
                className={`language-option ${
                  language.code === currentLanguage ? 'active' : ''
                }`}
                onClick={() => handleLanguageChange(language.code)}
              >
                <span className="language-flag">{language.flag}</span>
                <div className="language-info">
                  <span className="language-name">{language.nativeName}</span>
                  <span className="language-name-en">{language.name}</span>
                </div>
                {language.code === currentLanguage && (
                  <span className="checkmark">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
