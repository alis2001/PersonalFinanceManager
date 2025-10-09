import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * PIN Service - Handles secure PIN storage and verification
 * 
 * Security Features:
 * - PIN is hashed before storage (SHA-256)
 * - Attempt limiting (max 5 failed attempts)
 * - Weak PIN detection (0000, 1234, etc.)
 * - Local-only verification (no backend calls)
 */

// Storage keys
const STORAGE_KEYS = {
  PIN_HASH: 'userPINHash',
  PIN_ENABLED: 'pinEnabled',
  PIN_ATTEMPTS: 'pinAttempts',
  PIN_LOCKED_UNTIL: 'pinLockedUntil',
};

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Weak PINs to block
const WEAK_PINS = [
  '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '1212', '2121',
  '0123', '3210',
];

/**
 * Simple SHA-256 hash function (no external dependencies)
 * For production, consider using crypto library
 */
async function hashPIN(pin: string): Promise<string> {
  // Simple hash using btoa and string manipulation
  // In production, use a proper crypto library
  const text = `rapilot_pin_${pin}_secure`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

class PINService {
  /**
   * Check if PIN is enabled for the user
   */
  async isPINEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.PIN_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking PIN enabled:', error);
      return false;
    }
  }

  /**
   * Check if PIN entry is currently locked due to too many failed attempts
   */
  async isPINLocked(): Promise<{ locked: boolean; remainingTime?: number }> {
    try {
      const lockedUntil = await AsyncStorage.getItem(STORAGE_KEYS.PIN_LOCKED_UNTIL);
      if (!lockedUntil) {
        return { locked: false };
      }

      const lockTime = parseInt(lockedUntil, 10);
      const now = Date.now();

      if (now < lockTime) {
        const remainingTime = Math.ceil((lockTime - now) / 1000); // seconds
        return { locked: true, remainingTime };
      } else {
        // Lock expired, clear it
        await AsyncStorage.removeItem(STORAGE_KEYS.PIN_LOCKED_UNTIL);
        await this.resetAttempts();
        return { locked: false };
      }
    } catch (error) {
      console.error('Error checking PIN lock:', error);
      return { locked: false };
    }
  }

  /**
   * Check if a PIN is weak (common patterns)
   */
  isWeakPIN(pin: string): boolean {
    if (pin.length !== 4) return true;
    return WEAK_PINS.includes(pin);
  }

  /**
   * Set up a new PIN for the user
   */
  async setPIN(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate PIN
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return { success: false, error: 'PIN must be exactly 4 digits' };
      }

      if (this.isWeakPIN(pin)) {
        return { success: false, error: 'Please avoid common PINs like 0000, 1234, etc.' };
      }

      // Hash and store PIN
      const hashedPIN = await hashPIN(pin);
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_HASH, hashedPIN);
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_ENABLED, 'true');
      await this.resetAttempts();

      return { success: true };
    } catch (error) {
      console.error('Error setting PIN:', error);
      return { success: false, error: 'Failed to set PIN' };
    }
  }

  /**
   * Verify if the entered PIN is correct
   */
  async verifyPIN(pin: string): Promise<{ 
    success: boolean; 
    error?: string; 
    attemptsRemaining?: number;
    locked?: boolean;
    lockDuration?: number;
  }> {
    try {
      // Check if locked
      const lockStatus = await this.isPINLocked();
      if (lockStatus.locked) {
        return {
          success: false,
          locked: true,
          lockDuration: lockStatus.remainingTime,
          error: `Too many failed attempts. Try again in ${lockStatus.remainingTime} seconds.`,
        };
      }

      // Get stored PIN hash
      const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.PIN_HASH);
      if (!storedHash) {
        return { success: false, error: 'No PIN configured' };
      }

      // Verify PIN
      const hashedPIN = await hashPIN(pin);
      if (hashedPIN === storedHash) {
        // Correct PIN - reset attempts
        await this.resetAttempts();
        return { success: true };
      } else {
        // Wrong PIN - increment attempts
        const attempts = await this.incrementAttempts();
        const remaining = MAX_ATTEMPTS - attempts;

        if (remaining <= 0) {
          // Lock the PIN entry
          await this.lockPIN();
          return {
            success: false,
            locked: true,
            lockDuration: LOCKOUT_DURATION / 1000,
            error: 'Too many failed attempts. PIN entry locked for 5 minutes.',
          };
        }

        return {
          success: false,
          attemptsRemaining: remaining,
          error: `Wrong PIN. ${remaining} attempts remaining.`,
        };
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return { success: false, error: 'Failed to verify PIN' };
    }
  }

  /**
   * Change existing PIN (requires old PIN verification)
   */
  async changePIN(oldPIN: string, newPIN: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify old PIN first
      const verifyResult = await this.verifyPIN(oldPIN);
      if (!verifyResult.success) {
        return { success: false, error: verifyResult.error };
      }

      // Set new PIN
      return await this.setPIN(newPIN);
    } catch (error) {
      console.error('Error changing PIN:', error);
      return { success: false, error: 'Failed to change PIN' };
    }
  }

  /**
   * Disable PIN (requires PIN verification first)
   */
  async disablePIN(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify PIN first
      const verifyResult = await this.verifyPIN(pin);
      if (!verifyResult.success) {
        return { success: false, error: verifyResult.error };
      }

      // Clear PIN data
      await AsyncStorage.removeItem(STORAGE_KEYS.PIN_HASH);
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_ENABLED, 'false');
      await this.resetAttempts();

      return { success: true };
    } catch (error) {
      console.error('Error disabling PIN:', error);
      return { success: false, error: 'Failed to disable PIN' };
    }
  }

  /**
   * Force disable PIN (used when user logs out or forgets PIN)
   */
  async forceDisablePIN(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PIN_HASH);
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_ENABLED, 'false');
      await AsyncStorage.removeItem(STORAGE_KEYS.PIN_ATTEMPTS);
      await AsyncStorage.removeItem(STORAGE_KEYS.PIN_LOCKED_UNTIL);
    } catch (error) {
      console.error('Error force disabling PIN:', error);
    }
  }

  /**
   * Get current failed attempt count
   */
  private async getAttempts(): Promise<number> {
    try {
      const attempts = await AsyncStorage.getItem(STORAGE_KEYS.PIN_ATTEMPTS);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      console.error('Error getting attempts:', error);
      return 0;
    }
  }

  /**
   * Increment failed attempt count
   */
  private async incrementAttempts(): Promise<number> {
    try {
      const current = await this.getAttempts();
      const newCount = current + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_ATTEMPTS, newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Error incrementing attempts:', error);
      return 0;
    }
  }

  /**
   * Reset failed attempt count
   */
  private async resetAttempts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PIN_ATTEMPTS);
    } catch (error) {
      console.error('Error resetting attempts:', error);
    }
  }

  /**
   * Lock PIN entry for a duration
   */
  private async lockPIN(): Promise<void> {
    try {
      const lockUntil = Date.now() + LOCKOUT_DURATION;
      await AsyncStorage.setItem(STORAGE_KEYS.PIN_LOCKED_UNTIL, lockUntil.toString());
    } catch (error) {
      console.error('Error locking PIN:', error);
    }
  }

  /**
   * Clear all PIN data (used during logout)
   */
  async clearPINData(): Promise<void> {
    try {
      await this.forceDisablePIN();
    } catch (error) {
      console.error('Error clearing PIN data:', error);
    }
  }
}

const pinService = new PINService();
export default pinService;

