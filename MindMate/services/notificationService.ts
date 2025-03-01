// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;
  private pushToken: string | null = null;

  private constructor() { }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notifications (call on app startup)
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log('Notification service already initialized');
        return true;
      }
      
      console.log('Initializing notification service...');
      
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      
      // Set up notification received handler
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received in foreground:', notification);
      });
      
      // Check for existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get permission for push notifications:', finalStatus);
        Alert.alert(
          'Notification Permission',
          'To receive check-in reminders, please enable notifications in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      console.log('Notification permissions granted:', finalStatus);
      
      // On Android, create a notification channel
      if (Platform.OS === 'android') {
        await this.createAndroidChannels();
      }
      
      // Register for push notifications
      const result = await this.registerForPushNotifications();
      this.isInitialized = true;
      return result;
    } catch (error) {
      console.error('Error initializing notification service:', error);
      return false;
    }
  }

  // Create notification channels for Android
  private async createAndroidChannels() {
    if (Platform.OS === 'android') {
      // Main channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      // Check-in reminders channel
      await Notifications.setNotificationChannelAsync('check-in-reminders', {
        name: 'Check-in Reminders',
        description: 'Notifications for when your check-ins are available',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
  }

  // Register for push notifications and store the token
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications are not available in the simulator');
        return false;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'd52910f2-c495-4709-a25a-9d800ff3e91d', // Use the exact project ID from app.json
      });
      
      this.pushToken = token.data;

      // Store token locally
      await SecureStore.setItemAsync('pushToken', token.data);
      
      // Try up to 3 times to send the token to server with exponential backoff
      let attempt = 0;
      let success = false;
      
      while (attempt < 3 && !success) {
        try {
          success = await this.sendPushTokenToServer(token.data);
        } catch (err) {
          console.error(`Error sending push token (attempt ${attempt+1}/3):`, err);
        }
        
        if (!success) {
          // Wait with exponential backoff before retry
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return false;
    }
  }

  // Send the push token to your server
  private async sendPushTokenToServer(token: string): Promise<boolean> {
    try {
      const userToken = await SecureStore.getItemAsync('userToken');
      if (!userToken) {
        console.log('No auth token available for device registration');
        return false;
      }

      console.log('Sending push token to server:', token);
      
      const response = await fetch(`${API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          platform: Platform.OS,
          deviceId: Device.deviceName || 'unknown'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register push token with server: ${response.status}`);
      }
      
      console.log('Push token registered successfully with server');
      return true;
    } catch (error) {
      console.error('Error registering push token with server:', error);
      return false;
    }
  }

  // Schedule a local notification
  async scheduleLocalNotification(
    title: string,
    body: string,
    data: any = {},
    triggerInput: any = null
  ) {
    try {
      // Ensure the notification channel is properly set up on Android
      if (Platform.OS === 'android') {
        const channelId = data.type === 'wellness' ? 'check-in-reminders' : 'default';
        await Notifications.setNotificationChannelAsync(channelId, {
          name: data.type === 'wellness' ? 'Check-in Reminders' : 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
        },
        trigger: triggerInput,
      });
      
      console.log('Scheduled local notification with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  // Send an immediate local notification
  async sendLocalNotification(title: string, body: string, data: any = {}) {
    return this.scheduleLocalNotification(title, body, data);
  }

  // Add a test notification (for development)
  async sendTestNotification() {
    try {
      console.log('Sending test notification');
      
      // Make sure notification handler is properly set up
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      
      // Get the current badge count and increment it
      const notifications = await Notifications.getPresentedNotificationsAsync();
      const currentBadgeCount = notifications.length;
      
      // Schedule an immediate notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Check-In Available',
          body: 'Your next check-in is now available. How are you feeling today?',
          data: { 
            type: 'wellness',
            actionable: true,
            actionRoute: '/home/check_in'
          },
          sound: 'default',
          badge: currentBadgeCount + 1,
        },
        trigger: null, // null trigger means send immediately
      });
      
      console.log('Test notification scheduled with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  // Get all delivered notifications
  async getDeliveredNotifications() {
    return Notifications.getPresentedNotificationsAsync();
  }

  // Remove a specific notification
  async removeNotification(notificationId: string) {
    return Notifications.dismissNotificationAsync(notificationId);
  }

  // Remove all notifications
  async removeAllNotifications() {
    return Notifications.dismissAllNotificationsAsync();
  }
  
  // Request notification permissions explicitly
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }
  
  // Check if we have notification permissions
  async hasPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
}

export const notificationService = NotificationService.getInstance();