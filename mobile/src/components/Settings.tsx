import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../services/AuthContext';
import securePinService from '../services/SecurePINService';
import PINSetup from './PINSetup';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { t, currentLanguage, setLanguage, getSupportedLanguages } = useTranslation();
  const { logout } = useAuth();
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [pinMode, setPinMode] = useState<'create' | 'change' | 'disable'>('create');

  useEffect(() => {
    checkPINStatus();
  }, []);

  const checkPINStatus = async () => {
    const enabled = await securePinService.isPINEnabled();
    setPinEnabled(enabled);
  };

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) {
      setShowLanguageDropdown(false);
      return;
    }
    
    setIsChangingLanguage(true);
    setShowLanguageDropdown(false);
    
    try {
      await setLanguage(languageCode);
      const selectedLang = getSupportedLanguages().find(l => l.code === languageCode);
      Alert.alert(
        t('common.success'),
        `${t('settings.languageChanged')} ${selectedLang?.nativeName || selectedLang?.name || ''}`,
        [{ text: t('common.confirm') }]
      );
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('settings.languageChangeFailed'),
        [{ text: t('common.confirm') }]
      );
    } finally {
      setIsChangingLanguage(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('settings.logoutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Clear PIN data on logout
              await securePinService.clearPINData();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('common.error'), t('auth.logoutError'));
            }
          },
        },
      ]
    );
  };

  const handlePINPress = () => {
    if (pinEnabled) {
      // Show options: Change or Disable
      Alert.alert(
        t('pin.pinSecurity'),
        'Choose an option',
        [
          {
            text: t('pin.changePin'),
            onPress: () => {
              setPinMode('change');
              setShowPINSetup(true);
            },
          },
          {
            text: t('pin.disablePin'),
            style: 'destructive',
            onPress: () => {
              setPinMode('disable');
              setShowPINSetup(true);
            },
          },
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
        ]
      );
    } else {
      // Enable PIN
      setPinMode('create');
      setShowPINSetup(true);
    }
  };

  const handlePINSuccess = async () => {
    await checkPINStatus();
    const message = pinMode === 'create' ? t('pin.pinEnabled') : pinMode === 'change' ? t('pin.pinChanged') : t('pin.pinDisabled');
    Alert.alert(t('common.success'), message, [{ text: t('common.confirm') }]);
  };

  const supportedLanguages = getSupportedLanguages();
  const currentLang = supportedLanguages.find(l => l.code === currentLanguage) || supportedLanguages[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* PIN Security Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.pinSecurityButton} 
            onPress={handlePINPress}
            activeOpacity={0.7}
          >
            <View style={styles.pinSecurityLeft}>
              <Text style={styles.pinSecurityIcon}>🔐</Text>
              <View style={styles.pinSecurityTextContainer}>
                <Text style={styles.pinSecurityTitle}>{t('pin.pinSecurity')}</Text>
                <Text style={styles.pinSecurityStatus}>
                  {pinEnabled ? t('pin.changePin') + ' / ' + t('pin.disablePin') : t('pin.setupPin')}
                </Text>
              </View>
            </View>
            <Text style={styles.pinSecurityArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <Text style={styles.sectionSubtitle}>{t('settings.selectLanguage')}</Text>
          
          {/* Language Dropdown */}
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowLanguageDropdown(true)}
            disabled={isChangingLanguage}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownContent}>
              <Text style={styles.dropdownFlag}>{currentLang.flag}</Text>
              <View style={styles.dropdownTextContainer}>
                <Text style={styles.dropdownNativeName}>{currentLang.nativeName}</Text>
                <Text style={styles.dropdownEnglishName}>{currentLang.name}</Text>
              </View>
            </View>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutLabel}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageDropdown(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.selectLanguage')}</Text>
            </View>
            
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {supportedLanguages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageOption,
                    currentLanguage === language.code && styles.languageOptionActive,
                  ]}
                  onPress={() => handleLanguageChange(language.code)}
                  disabled={isChangingLanguage}
                  activeOpacity={0.7}
                >
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageFlag}>{language.flag}</Text>
                    <View style={styles.languageTextContainer}>
                      <Text style={[
                        styles.languageName,
                        currentLanguage === language.code && styles.languageNameActive
                      ]}>
                        {language.nativeName}
                      </Text>
                      <Text style={[
                        styles.languageNameEn,
                        currentLanguage === language.code && styles.languageNameEnActive
                      ]}>
                        {language.name}
                      </Text>
                    </View>
                  </View>
                  {currentLanguage === language.code && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PIN Setup Modal */}
      <PINSetup
        isOpen={showPINSetup}
        onClose={() => setShowPINSetup(false)}
        onSuccess={handlePINSuccess}
        mode={pinMode}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#1a1a1a',
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: -6,
    marginLeft: -1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  // PIN Security Styles
  pinSecurityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  pinSecurityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pinSecurityIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  pinSecurityTextContainer: {
    flex: 1,
  },
  pinSecurityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  pinSecurityStatus: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '400',
  },
  pinSecurityArrow: {
    fontSize: 20,
    color: '#999999',
    marginLeft: 12,
  },
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownNativeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dropdownEnglishName: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  languageList: {
    maxHeight: 400,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageOptionActive: {
    backgroundColor: '#f8f9fa',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  languageNameActive: {
    fontWeight: '600',
  },
  languageNameEn: {
    fontSize: 13,
    color: '#666666',
  },
  languageNameEnActive: {
    color: '#1a1a1a',
  },
  selectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#fed7d7',
  },
  logoutIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  logoutLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e53e3e',
  },
  bottomSpacing: {
    height: 100,
  },
});

export default Settings;
