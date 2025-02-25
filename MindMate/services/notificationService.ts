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
      console.log('Notification received:', notification);
    });
    
    // Set up notification response handler
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      // Handle notification taps here
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
        'To receive notifications, please enable them in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }

    console.log('Notification permissions granted:', finalStatus);
    
    // Register for push notifications
    return this.registerForPushNotifications();
  } catch (error) {
    console.error('Error initializing notification service:', error);
    return false;
  }
}

  // Register for push notifications and store the token
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications are not available in the simulator');
        return;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'd52910f2-c495-4709-a25a-9d800ff3e91d', // Use the exact project ID from app.json
      });

      // Store token locally
      await SecureStore.setItemAsync('pushToken', token.data);

      // Send token to backend
      await this.sendPushTokenToServer(token.data);

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }

  // Send the push token to your server
  private async sendPushTokenToServer(token: string) {
    try {
      const userToken = await SecureStore.getItemAsync('userToken');
      if (!userToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to register push token with server');
      }
    } catch (error) {
      console.error('Error registering push token with server:', error);
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
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: triggerInput,
      });
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

  // Schedule a notification for when check-in becomes available
  async scheduleCheckInReminderNotification(nextCheckInTime: Date) {
    try {
      const now = new Date();
      const triggerDate = new Date(nextCheckInTime);

      // Only schedule if the next check-in is in the future
      if (triggerDate > now) {
        const seconds = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);

        // If the time is too short (less than 10 seconds), don't schedule
        if (seconds < 10) {
          console.log('Check-in time too close, not scheduling notification');
          return null;
        }

        // Cancel any existing check-in notifications first
        await this.cancelCheckInNotifications();

        console.log(`Scheduling check-in notification for ${seconds} seconds from now`);

        // Type the trigger according to Expo's requirements
        const trigger = {
          seconds: seconds > 0 ? seconds : 0,
          repeats: false
        };

        // Record the scheduled time to avoid duplicate schedules
        await SecureStore.setItemAsync('lastScheduledCheckIn',
          JSON.stringify({
            time: triggerDate.toISOString(),
            scheduledAt: now.toISOString()
          })
        );

        // Schedule the notification
        return this.scheduleLocalNotification(
          'Check-In Available',
          'Your next check-in is now available. How are you feeling today?',
          { type: 'check-in-reminder' },
          trigger
        );
      }
      return null;
    } catch (error) {
      console.error('Error scheduling check-in notification:', error);
      return null;
    }
  }

  // Cancel existing check-in notifications to avoid duplicates
  async cancelCheckInNotifications() {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const checkInNotificationIds = scheduledNotifications
        .filter(notification =>
          notification.content.data?.type === 'check-in-reminder'
        )
        .map(notification => notification.identifier);

      for (const id of checkInNotificationIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch (error) {
      console.error('Error canceling check-in notifications:', error);
    }
  }

  // Add a test notification (for development)
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
        sound: 'default', // Explicitly request sound
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
}

export const notificationService = NotificationService.getInstance();