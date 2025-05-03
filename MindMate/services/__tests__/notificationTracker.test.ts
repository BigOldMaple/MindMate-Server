// services/__tests__/notificationTracker.test.ts

import * as SecureStore from 'expo-secure-store';
import { notificationTracker } from '../notificationTracker';

// Mock dependencies
jest.mock('expo-secure-store');

describe('notificationTracker', () => {
  // Constants used in tests
  const CHECK_IN_KEY = 'check_in_available_notification_shown';
  
  // Before each test, reset mocks
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('hasShownCheckInNotification', () => {
    it('returns false when no notification has been shown', async () => {
      // Arrange - empty SecureStore
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      
      // Act
      const result = await notificationTracker.hasShownCheckInNotification();
      
      // Assert
      expect(result).toBe(false);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY);
    });
    
    it('returns true when notification was recently shown', async () => {
      // Arrange - recent timestamp (within 24 hours)
      const recentTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(recentTimestamp.toString());
      
      // Act
      const result = await notificationTracker.hasShownCheckInNotification();
      
      // Assert
      expect(result).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY);
    });
    
    it('returns false when notification was shown more than 24 hours ago', async () => {
      // Arrange - old timestamp (more than 24 hours ago)
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 25; // 25 hours ago
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(oldTimestamp.toString());
      
      // Act
      const result = await notificationTracker.hasShownCheckInNotification();
      
      // Assert
      expect(result).toBe(false);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY);
    });
    
    it('handles storage errors and returns false', async () => {
      // Arrange - SecureStore throws an error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      // Act
      const result = await notificationTracker.hasShownCheckInNotification();
      
      // Assert
      expect(result).toBe(false);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('markCheckInNotificationShown', () => {
    it('saves current timestamp', async () => {
      // Arrange
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
      
      // Act
      await notificationTracker.markCheckInNotificationShown();
      
      // Assert
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY, '12345');
      
      // Restore Date.now
      dateSpy.mockRestore();
    });
    
    it('handles storage errors', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      // Act & Assert - should not throw
      await expect(notificationTracker.markCheckInNotificationShown()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('resetCheckInNotificationFlag', () => {
    it('deletes stored timestamp', async () => {
      // Act
      await notificationTracker.resetCheckInNotificationFlag();
      
      // Assert
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(CHECK_IN_KEY);
    });
    
    it('handles storage errors', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      // Act & Assert - should not throw
      await expect(notificationTracker.resetCheckInNotificationFlag()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});