// services/notificationsApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';
import { notificationService } from './notificationService';

const API_URL = getApiUrl();

export interface Notification {
  id?: string;     // Client-side ID
  _id?: string;    // MongoDB ID from server
  type: 'support' | 'wellness' | 'community' | 'alert' | 'buddy';
  title: string;
  message: string;
  time: string | Date;
  read: boolean;
  actionable?: boolean;
  actionRoute?: string;
  actionParams?: Record<string, string>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  userId?: string;
}

class NotificationsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationsApiError';
  }
}

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('userToken');
  if (!token) {
    throw new NotificationsApiError('Authentication required');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const notificationsApi = {
  async getNotifications(): Promise<Notification[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }
      
      const notifications = await response.json();
      
      // We no longer automatically trigger notifications when fetching the notification list
      // This prevents duplicate notifications when opening the notifications screen
      
      return notifications;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to fetch notifications'
      );
    }
  },

  async createNotification(notification: Omit<Notification, 'id' | '_id'>): Promise<Notification> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create notification: ${response.status}`);
      }
      
      const createdNotification = await response.json();
      
      // If this is a check-in notification, create a local notification as well
      if (notification.type === 'wellness' && notification.title.includes('Check-In')) {
        await notificationService.sendLocalNotification(
          notification.title,
          notification.message,
          {
            type: notification.type,
            actionable: notification.actionable,
            actionRoute: notification.actionRoute,
            actionParams: notification.actionParams,
            notificationId: createdNotification.id || createdNotification._id
          }
        );
      }
      
      return createdNotification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to create notification'
      );
    }
  },

  async markAsRead(id: string): Promise<void> {
    try {
      // Validate the ID
      if (!id || typeof id !== 'string') {
        throw new NotificationsApiError('Invalid notification ID');
      }

      // If the ID starts with an object notation, extract the string ID
      let notificationId = id;
      if (id.includes('"_id":') || id.includes('_id')) {
        try {
          // It could be a stringified object or already an object
          const parsed = typeof id === 'string' && id.startsWith('{') ? JSON.parse(id) : id;
          // Handle both cases: parsed object or object that wasn't stringified
          notificationId = (parsed._id || parsed.id || id).toString();
        } catch (parseError) {
          console.error('Error parsing notification ID:', parseError);
          // Continue with the original ID if parsing fails
        }
      }
      
      console.log('Sending mark as read API request for notification:', notificationId);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new NotificationsApiError(
          errorData.error || `Failed to mark notification as read: ${response.status}`
        );
      }
    } catch (error) {
      console.error('Mark as read error details:', error);
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to mark notification as read'
      );
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST',
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to mark all notifications as read: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to mark all notifications as read'
      );
    }
  },

  async deleteNotification(id: string): Promise<void> {
    try {
      // Extract ID similar to markAsRead
      let notificationId = id;
      if (id.includes('"_id":') || id.includes('_id')) {
        try {
          const parsed = typeof id === 'string' && id.startsWith('{') ? JSON.parse(id) : id;
          notificationId = (parsed._id || parsed.id || id).toString();
        } catch (parseError) {
          console.error('Error parsing notification ID:', parseError);
        }
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to delete notification: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to delete notification'
      );
    }
  },
  
  async checkForCheckInStatus(): Promise<boolean> {
    try {
      // Import at the beginning of the function to avoid circular dependencies
      const { notificationTracker } = require('./notificationTracker');
      
      // First check if we've already shown a notification for this cycle
      const hasShown = await notificationTracker.hasShownCheckInNotification();
      if (hasShown) {
        console.log('Check-in notification already shown for this cycle, not showing again');
        return false;
      }
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/check-in/status`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to get check-in status: ${response.status}`);
      }
      
      const status = await response.json();
      
      // If check-in is available and we haven't shown a notification yet, create one
      if (status.canCheckIn) {
        await notificationService.sendLocalNotification(
          'Check-In Available',
          'Your next check-in is now available. How are you feeling today?',
          {
            type: 'wellness',
            actionable: true,
            actionRoute: '/home/check_in'
          }
        );
        
        // Mark that we've shown a notification for this cycle
        await notificationTracker.markCheckInNotificationShown();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check check-in status:', error);
      return false;
    }
  }
};

// For compatibility with the dynamic import in handleSubmit
export const Notification = notificationsApi;