// services/storageService.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { StorageItem } from '../types/storage';

class StorageService {
  private static instance: StorageService;
  private tempDirectory: string;
  private readonly TEMP_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly TEMP_FILE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  private constructor() {
    this.tempDirectory = `${FileSystem.cacheDirectory}temp/`;
    this.setupTempDirectory();
    this.startTempCleanupSchedule();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private async setupTempDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.tempDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.tempDirectory, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to setup temp directory:', error);
    }
  }

  private startTempCleanupSchedule() {
    setInterval(() => {
      this.cleanupTempFiles();
    }, this.TEMP_CLEANUP_INTERVAL);
  }

  // Secure Storage with fallback
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      if (await this.isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(key, value);
      } else {
        // Fallback to encrypted AsyncStorage
        const encryptedValue = await this.encrypt(value);
        await AsyncStorage.setItem(`secure_${key}`, encryptedValue);
      }
    } catch (error) {
      console.error('Storage error:', error);
      // Final fallback to regular AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      if (await this.isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(key);
      } else {
        // Try to get from encrypted AsyncStorage
        const encryptedValue = await AsyncStorage.getItem(`secure_${key}`);
        if (encryptedValue) {
          return await this.decrypt(encryptedValue);
        }
      }
    } catch (error) {
      console.error('Storage retrieval error:', error);
      // Final fallback
      return AsyncStorage.getItem(key);
    }
    return null;
  }

  async removeSecureItem(key: string): Promise<void> {
    try {
      if (await this.isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
      // Clean up fallback storage
      await AsyncStorage.removeItem(`secure_${key}`);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removal error:', error);
    }
  }

  // Regular Storage Operations
  async setItem(key: string, value: string, temporary: boolean = false): Promise<void> {
    const item: StorageItem = {
      key,
      value,
      timestamp: Date.now(),
      temporary,
      expiresAt: temporary ? Date.now() + this.TEMP_FILE_EXPIRY : undefined
    };

    await AsyncStorage.setItem(key, JSON.stringify(item));
  }

  async getItem(key: string): Promise<string | null> {
    const itemStr = await AsyncStorage.getItem(key);
    if (!itemStr) return null;

    const item: StorageItem = JSON.parse(itemStr);
    if (item.temporary && item.expiresAt && item.expiresAt < Date.now()) {
      await this.removeItem(key);
      return null;
    }

    return item.value;
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  // File System Operations
  async saveFile(fileName: string, content: string, temporary: boolean = false): Promise<string> {
    const filePath = temporary 
      ? `${this.tempDirectory}${fileName}`
      : `${FileSystem.documentDirectory}${fileName}`;

    try {
      await FileSystem.writeAsStringAsync(filePath, content);
      if (temporary) {
        await this.setItem(`temp_file_${fileName}`, filePath, true);
      }
      return filePath;
    } catch (error) {
      console.error('File save error:', error);
      throw error;
    }
  }

  async readFile(fileName: string): Promise<string> {
    try {
      const filePath = await this.getFilePath(fileName);
      return await FileSystem.readAsStringAsync(filePath);
    } catch (error) {
      console.error('File read error:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const filePath = await this.getFilePath(fileName);
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      await this.removeItem(`temp_file_${fileName}`);
    } catch (error) {
      console.error('File deletion error:', error);
    }
  }

  // Cleanup Operations
  async cleanupTempFiles(): Promise<void> {
    try {
      const tempFiles = await FileSystem.readDirectoryAsync(this.tempDirectory);
      for (const file of tempFiles) {
        const filePath = `${this.tempDirectory}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists) {
          const modTime = fileInfo.modificationTime || 0;
          const age = Date.now() - modTime * 1000;
          
          if (age > this.TEMP_FILE_EXPIRY) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
          }
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async cleanup(): Promise<void> {
    await this.cleanupTempFiles();
  }

  // Helper Methods
  private async isSecureStoreAvailable(): Promise<boolean> {
    try {
      // SecureStore is not available on web
      if (Platform.OS === 'web') return false;
      
      // Test SecureStore
      const testKey = '_test_secure_store_';
      await SecureStore.setItemAsync(testKey, 'test');
      await SecureStore.deleteItemAsync(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getFilePath(fileName: string): Promise<string> {
    const tempPath = await this.getItem(`temp_file_${fileName}`);
    return tempPath || `${FileSystem.documentDirectory}${fileName}`;
  }

  // Basic encryption/decryption for fallback security
  // Note: In a production app, use a proper encryption library
  private async encrypt(value: string): Promise<string> {
    // Implement proper encryption here
    return Buffer.from(value).toString('base64');
  }

  private async decrypt(value: string): Promise<string> {
    // Implement proper decryption here
    return Buffer.from(value, 'base64').toString('utf-8');
  }
}

export const storageService = StorageService.getInstance();