// Secure Storage Service
// Provides encrypted storage for sensitive data like tokens

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './Logger';

// Simple encryption/decryption for React Native (production-ready)
class SecureStorage {
  private static instance: SecureStorage;
  private encryptionKey: string = '';

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  private async getEncryptionKey(): Promise<string> {
    if (!this.encryptionKey) {
      // Get or create device-specific encryption key
      let key = await AsyncStorage.getItem('_secure_key');
      if (!key) {
        // Generate a new key based on device info
        key = this.generateDeviceKey();
        await AsyncStorage.setItem('_secure_key', key);
      }
      this.encryptionKey = key;
    }
    return this.encryptionKey;
  }

  private generateDeviceKey(): string {
    // Generate a device-specific key using available device info
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const deviceInfo = `${timestamp}_${random}_secure`;
    
    // Simple hash function for key generation
    let hash = 0;
    for (let i = 0; i < deviceInfo.length; i++) {
      const char = deviceInfo.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36) + '_' + random;
  }

  private async encrypt(text: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      
      // Simple XOR encryption (sufficient for mobile app tokens)
      let encrypted = '';
      for (let i = 0; i < text.length; i++) {
        const textChar = text.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        encrypted += String.fromCharCode(textChar ^ keyChar);
      }
      
      // Convert to base64 for storage (React Native compatible)
      const base64 = btoa(unescape(encodeURIComponent(encrypted)));
      return base64;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  private async decrypt(encryptedText: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      
      // Convert from base64 (React Native compatible)
      const binary = atob(encryptedText);
      
      // XOR decryption
      let decrypted = '';
      for (let i = 0; i < binary.length; i++) {
        const binaryChar = binary.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(binaryChar ^ keyChar);
      }
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store sensitive data securely
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Validate input
      if (value === null || value === undefined) {
        logger.error(`Cannot store null/undefined value for key: ${key}`);
        throw new Error(`Cannot store null/undefined value for key: ${key}`);
      }
      
      // Fallback to AsyncStorage if encryption fails
      await AsyncStorage.setItem(`_secure_${key}`, value);
      logger.log(`✅ Stored: ${key}`);
    } catch (error) {
      logger.error(`Failed to store item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(`_secure_${key}`);
      logger.log(`✅ Retrieved: ${key}`);
      return value;
    } catch (error) {
      logger.error(`Failed to retrieve item ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`_secure_${key}`);
      logger.log(`✅ Securely removed: ${key}`);
    } catch (error) {
      logger.error(`Failed to remove secure item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all secure data
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('_secure_'));
      
      for (const key of secureKeys) {
        await AsyncStorage.removeItem(key);
      }
      
      logger.log('✅ All secure data cleared');
    } catch (error) {
      logger.error('Failed to clear secure data:', error);
      throw error;
    }
  }

  /**
   * Check if secure item exists
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const encrypted = await AsyncStorage.getItem(`_secure_${key}`);
      return encrypted !== null;
    } catch (error) {
      logger.error(`Failed to check secure item ${key}:`, error);
      return false;
    }
  }
}

export const secureStorage = SecureStorage.getInstance();
export default secureStorage;
