import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface PINDotsProps {
  length: number;
  filled: number;
  error?: boolean;
  theme?: 'dark' | 'light';
}

/**
 * Beautiful PIN dots component with animations
 * Shows 4 dots that fill as user enters PIN
 * Matches minimalist design with smooth animations
 * Supports both dark and light themes
 */
const PINDots: React.FC<PINDotsProps> = ({ length = 4, filled = 0, error = false, theme = 'dark' }) => {
  const animations = useRef(
    Array.from({ length: length }).map(() => new Animated.Value(0))
  ).current;

  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate each dot when it gets filled
    if (filled > 0 && filled <= length) {
      Animated.spring(animations[filled - 1], {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 3,
      }).start();
    }

    // Reset animations when PIN is cleared
    if (filled === 0) {
      animations.forEach(anim => anim.setValue(0));
    }
  }, [filled]);

  useEffect(() => {
    // Shake animation on error
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: shakeAnimation }],
        },
      ]}
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = index < filled;
        const scale = animations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        });

        const dotStyle = theme === 'dark' ? styles.dotDark : styles.dotLight;
        const dotFilledStyle = theme === 'dark' ? styles.dotFilledDark : styles.dotFilledLight;
        const dotInnerStyle = theme === 'dark' ? styles.dotInnerDark : styles.dotInnerLight;

        return (
          <View
            key={index}
            style={[
              styles.dot,
              dotStyle,
              isFilled && dotFilledStyle,
              error && styles.dotError,
            ]}
          >
            {isFilled && (
              <Animated.View
                style={[
                  styles.dotInner,
                  dotInnerStyle,
                  error && styles.dotInnerError,
                  {
                    transform: [{ scale }],
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 40,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // Dark theme (black background)
  dotDark: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotFilledDark: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dotInnerDark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  // Light theme (white background)
  dotLight: {
    borderColor: 'rgba(26, 26, 26, 0.3)',
  },
  dotFilledLight: {
    borderColor: '#1a1a1a',
    backgroundColor: 'rgba(26, 26, 26, 0.05)',
  },
  dotInnerLight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dotError: {
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotInnerError: {
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
  },
});

export default PINDots;

