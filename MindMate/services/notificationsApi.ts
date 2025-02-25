// services/notificationsApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface Notification {
  id: string;
  type: 'support' | 'wellness' | 'community' | 'alert' | 'buddy';
  title: string;
  message: string;
  time: string | Date;
  read: boolean;
  actionable?: boolean;
  actionRoute?: string;
  actionParams?: Record<string, string>;
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
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    } catch (error) {
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to fetch notifications'
      );
    }
  },

  async markAsRead(id: string): Promise<void> {
    try {
      // Validate the ID
      if (!id || typeof id !== 'string') {
        throw new NotificationsApiError('Invalid notification ID');
      }

      console.log('Sending mark as read API request for notification:', id);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications/${id}/read`, {
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
        throw new Error('Failed to mark all notifications as read');
      }
    } catch (error) {
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to mark all notifications as read'
      );
    }
  },

  async deleteNotification(id: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
    } catch (error) {
      throw new NotificationsApiError(
        error instanceof Error ? error.message : 'Failed to delete notification'
      );
    }
  }
};