// services/notificationTracker.ts
import * as SecureStore from 'expo-secure-store';

// Keys for different notification types
const KEYS = {
  CHECK_IN_AVAILABLE: 'check_in_available_notification_shown',
};

export const notificationTracker = {
  /**
   * Checks if a notification has already been shown for the current check-in cycle
   */
  async hasShownCheckInNotification(): Promise<boolean> {
    try {
      // Get the last check-in notification timestamp
      const shownTimestampStr = await SecureStore.getItemAsync(KEYS.CHECK_IN_AVAILABLE);
      if (!shownTimestampStr) return false;
      
      const shownTimestamp = parseInt(shownTimestampStr, 10);
      const now = Date.now();
      
      // If shown in the last 24 hours, don't show again
      const oneDay = 24 * 60 * 60 * 1000;
      return now - shownTimestamp < oneDay;
    } catch (error) {
      console.error('Error checking notification state:', error);
      return false;
    }
  },
  
  /**
   * Marks a check-in notification as shown for this cycle
   */
  async markCheckInNotificationShown(): Promise<void> {
    try {
      const timestamp = Date.now().toString();
      await SecureStore.setItemAsync(KEYS.CHECK_IN_AVAILABLE, timestamp);
    } catch (error) {
      console.error('Error marking notification as shown:', error);
    }
  },
  
  /**
   * Clears the notification tracking flag (e.g., after completing a check-in)
   */
  async resetCheckInNotificationFlag(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.CHECK_IN_AVAILABLE);
    } catch (error) {
      console.error('Error resetting notification flag:', error);
    }
  }
};