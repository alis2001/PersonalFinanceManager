import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PINDots from './PINDots';
import pinService from '../services/pinService';
import { useTranslation } from '../hooks/useTranslation';

interface PINEntryProps {
  onSuccess: () => void;
  onForgotPIN: () => void;
}

/**
 * Beautiful PIN Entry screen
 * Shown when user opens app with PIN enabled
 * Matches Welcome screen design (black background, white text)
 */
const PINEntry: React.FC<PINEntryProps> = ({ onSuccess, onForgotPIN }) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockDuration, setLockDuration] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkLockStatus();
    // Fade in animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isLocked && lockDuration > 0) {
      const timer = setInterval(() => {
        setLockDuration((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isLocked, lockDuration]);

  const checkLockStatus = async () => {
    const lockStatus = await pinService.isPINLocked();
    if (lockStatus.locked && lockStatus.remainingTime) {
      setIsLocked(true);
      setLockDuration(lockStatus.remainingTime);
      setError(t('pin.tooManyAttempts'));
    }
  };

  const handleNumberPress = (number: string) => {
    if (isLocked) return;
    if (pin.length < 4) {
      // Haptic feedback
      Vibration.vibrate(10);
      
      const newPin = pin + number;
      setPin(newPin);
      setError('');

      // Auto-verify when 4 digits entered
      if (newPin.length === 4) {
        setTimeout(() => verifyPIN(newPin), 150);
      }
    }
  };

  const handleBackspace = () => {
    if (isLocked) return;
    if (pin.length > 0) {
      // Haptic feedback
      Vibration.vibrate(10);
      setPin((prev) => prev.slice(0, -1));
      setError('');
    }
  };

  const verifyPIN = async (enteredPIN: string) => {
    const result = await pinService.verifyPIN(enteredPIN);

    if (result.success) {
      // Correct PIN
      onSuccess();
    } else {
      // Wrong PIN
      Vibration.vibrate(400);
      setError(result.error || t('pin.wrongPin', { attempts: result.attemptsRemaining || 0 }));
      setPin('');

      if (result.locked) {
        setIsLocked(true);
        setLockDuration(result.lockDuration || 300);
      }
    }
  };

  const formatLockDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const NumberButton: React.FC<{ number: string }> = ({ number }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
      if (isLocked) return;
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    const handlePressOut = () => {
      if (isLocked) return;
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
        disabled={isLocked}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.numberButton,
            isLocked && styles.numberButtonDisabled,
            isPressed && !isLocked && styles.numberButtonPressed,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.numberText,
              isLocked && styles.numberTextDisabled,
              isPressed && !isLocked && styles.numberTextPressed,
            ]}
          >
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
      if (isLocked) return;
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }).start();
    };

    const handlePressOut = () => {
      if (isLocked) return;
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
        disabled={isLocked}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.numberButton,
            isLocked && styles.numberButtonDisabled,
            isPressed && !isLocked && styles.backspaceButtonPressed,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text
            style={[
              styles.backspaceText,
              isLocked && styles.numberTextDisabled,
              isPressed && !isLocked && styles.backspaceTextPressed,
            ]}
          >
            ⌫
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>Rapilot</Text>
          <Text style={styles.subtitle}>
            {isLocked ? t('pin.tooManyAttempts') : t('pin.enterPin')}
          </Text>
        </View>

        {/* PIN Dots */}
        <PINDots length={4} filled={pin.length} error={!!error} />

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {isLocked && lockDuration > 0
                ? `${error} (${formatLockDuration(lockDuration)})`
                : error}
            </Text>
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

        {/* Forgot PIN Link */}
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={onForgotPIN}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>{t('pin.forgotPin')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
  errorContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '400',
  },
  numberPad: {
    marginTop: 20,
    marginBottom: 40,
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
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  numberButtonDisabled: {
    opacity: 0.3,
  },
  numberText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '400',
  },
  numberTextDisabled: {
    color: '#666666',
  },
  numberButtonPressed: {
    backgroundColor: '#ffffff',
  },
  numberTextPressed: {
    color: '#1a1a1a',
  },
  backspaceText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
  },
  backspaceButtonPressed: {
    backgroundColor: '#3a3a3a',
  },
  backspaceTextPressed: {
    color: '#ff6b6b',
  },
  forgotButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  forgotText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});

export default PINEntry;

