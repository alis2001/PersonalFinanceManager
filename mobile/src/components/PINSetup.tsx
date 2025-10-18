import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Vibration,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PINDots from './PINDots';
import securePinService from '../services/SecurePINService';
import { useTranslation } from '../hooks/useTranslation';

interface PINSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'change' | 'disable';
  currentPIN?: string;
}

/**
 * Beautiful PIN Setup Modal
 * Handles: Create PIN, Change PIN, Disable PIN
 * Matches app's minimalist design
 */
const PINSetup: React.FC<PINSetupProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode,
  currentPIN,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'verify' | 'create' | 'confirm'>(
    mode === 'change' || mode === 'disable' ? 'verify' : 'create'
  );
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Fade in animation when modal opens
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isOpen]);

  const handleReset = () => {
    setStep(mode === 'change' || mode === 'disable' ? 'verify' : 'create');
    setPin('');
    setConfirmPin('');
    setError('');
  };

  const handleNumberPress = (number: string) => {
    const currentStepPIN = step === 'confirm' ? confirmPin : pin;
    
    if (currentStepPIN.length < 4) {
      // Haptic feedback
      Vibration.vibrate(10);
      
      const newPin = currentStepPIN + number;
      
      if (step === 'confirm') {
        setConfirmPin(newPin);
      } else {
        setPin(newPin);
      }
      
      setError('');

      // Auto-proceed when 4 digits entered
      if (newPin.length === 4) {
        setTimeout(() => handlePINComplete(newPin), 150);
      }
    }
  };

  const handleBackspace = () => {
    const currentPIN = step === 'confirm' ? confirmPin : pin;
    if (currentPIN.length > 0) {
      // Haptic feedback
      Vibration.vibrate(10);
      
      if (step === 'confirm') {
        setConfirmPin((prev) => prev.slice(0, -1));
      } else {
        setPin((prev) => prev.slice(0, -1));
      }
      setError('');
    }
  };

  const handlePINComplete = async (completedPIN: string) => {
    if (step === 'verify') {
      // Verify current PIN
      const result = await securePinService.verifyPIN(completedPIN);
      if (result.success) {
        if (mode === 'disable') {
          // Disable PIN
          await securePinService.disablePIN(completedPIN);
          onSuccess();
          handleClose();
        } else {
          // Move to create new PIN
          setStep('create');
          setPin('');
        }
      } else {
        Vibration.vibrate(400);
        setError(result.error || t('pin.wrongPin', { attempts: result.attemptsRemaining || 0 }));
        setPin('');
      }
    } else if (step === 'create') {
      // Validate new PIN
      if (securePinService.isWeakPIN(completedPIN)) {
        Vibration.vibrate(400);
        setError(t('pin.weakPin'));
        setPin('');
        return;
      }
      // Move to confirm
      setStep('confirm');
    } else if (step === 'confirm') {
      // Confirm PIN matches
      if (completedPIN === pin) {
        // Set PIN
        const result = await securePinService.setPIN(completedPIN);
        if (result.success) {
          onSuccess();
          handleClose();
        } else {
          Vibration.vibrate(400);
          setError(result.error || 'Failed to set PIN');
          setConfirmPin('');
        }
      } else {
        Vibration.vibrate(400);
        setError(t('pin.pinMismatch'));
        setConfirmPin('');
      }
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const getTitle = () => {
    if (step === 'verify') return t('pin.enterPin');
    if (step === 'create') return mode === 'change' ? t('pin.createPin') : t('pin.setupPin');
    return t('pin.confirmPin');
  };

  const getDescription = () => {
    if (step === 'verify') {
      return mode === 'disable' ? 'Enter your current PIN to disable' : 'Enter your current PIN';
    }
    if (step === 'create') return t('pin.setupDescription');
    return 'Re-enter your PIN to confirm';
  };

  const getCurrentPIN = () => {
    return step === 'confirm' ? confirmPin : pin;
  };

  const NumberButton: React.FC<{ number: string }> = ({ number }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    const handlePressOut = () => {
      setIsPressed(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    return (
      <TouchableOpacity
        onPress={() => handleNumberPress(number)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.numberButton,
            isPressed && styles.numberButtonPressed,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.numberText, isPressed && styles.numberTextPressed]}>
            {number}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const BackspaceButton: React.FC = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    const handlePressOut = () => {
      setIsPressed(false);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    return (
      <TouchableOpacity
        onPress={handleBackspace}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.numberButton,
            isPressed && styles.backspaceButtonPressed,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.backspaceText, isPressed && styles.backspaceTextPressed]}>
            ⌫
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{getTitle()}</Text>
            <View style={styles.headerPlaceholder} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.description}>{getDescription()}</Text>

            {/* PIN Dots */}
            <PINDots length={4} filled={getCurrentPIN().length} error={!!error} theme="light" />

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.errorContainer} />
            )}

            {/* Number Pad */}
            <View style={styles.numberPad}>
              <View style={styles.numberRow}>
                <NumberButton number="1" />
                <NumberButton number="2" />
                <NumberButton number="3" />
              </View>
              <View style={styles.numberRow}>
                <NumberButton number="4" />
                <NumberButton number="5" />
                <NumberButton number="6" />
              </View>
              <View style={styles.numberRow}>
                <NumberButton number="7" />
                <NumberButton number="8" />
                <NumberButton number="9" />
              </View>
              <View style={styles.numberRowBottom}>
                <View style={styles.emptySpace} />
                <NumberButton number="0" />
                <BackspaceButton />
              </View>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#1a1a1a',
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerPlaceholder: {
    width: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 30,
    fontWeight: '400',
  },
  errorContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '400',
  },
  numberPad: {
    marginTop: 20,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  numberRowBottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  emptySpace: {
    width: 70,
  },
  numberButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  numberText: {
    fontSize: 28,
    color: '#1a1a1a',
    fontWeight: '400',
  },
  numberButtonPressed: {
    backgroundColor: '#1a1a1a',
  },
  numberTextPressed: {
    color: '#ffffff',
  },
  backspaceText: {
    fontSize: 24,
    color: '#1a1a1a',
    fontWeight: '300',
  },
  backspaceButtonPressed: {
    backgroundColor: '#ffebee',
  },
  backspaceTextPressed: {
    color: '#d32f2f',
  },
});

export default PINSetup;

