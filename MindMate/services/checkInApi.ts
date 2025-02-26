// server/services/checkInApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface CheckInData {
  mood: {
    score: number;
    label: string;
    description?: string;
  };
  activities: Array<{
    type: string;
    level: 'low' | 'moderate' | 'high';
  }>;
  notes?: string;
}

export interface CheckInStatus {
  canCheckIn: boolean;
  nextCheckInTime?: Date;
}

class CheckInApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckInApiError';
  }
}

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('userToken');
  if (!token) {
    throw new CheckInApiError('Authentication required');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const checkInApi = {
  async submitCheckIn(data: CheckInData): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_URL}/check-in`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
  
      if (!response.ok) {
        throw new Error('Failed to submit check-in');
      }
      
      // After successful check-in, update local status cache
      try {
        // Store the check-in time to create a local cache
        await SecureStore.setItemAsync('lastCheckInTime', new Date().toISOString());
        
        // We could also store the next available check-in time for better UX
        const nextAvailableTime = new Date();
        nextAvailableTime.setHours(nextAvailableTime.getHours() + 24); // 24-hour cooldown
        await SecureStore.setItemAsync('nextCheckInTime', nextAvailableTime.toISOString());
      } catch (cacheError) {
        console.error('Failed to cache check-in status:', cacheError);
        // Continue even if caching fails
      }
    } catch (error) {
      throw new CheckInApiError(
        error instanceof Error ? error.message : 'Failed to submit check-in'
      );
    }
  },

  async getRecentCheckIns(days: number = 7): Promise<any[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/check-in/recent?days=${days}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recent check-ins');
      }

      return response.json();
    } catch (error) {
      throw new CheckInApiError(
        error instanceof Error ? error.message : 'Failed to fetch check-ins'
      );
    }
  },

  async getCheckInStats(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/check-in/stats`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch check-in stats');
      }

      return response.json();
    } catch (error) {
      throw new CheckInApiError(
        error instanceof Error ? error.message : 'Failed to fetch check-in stats'
      );
    }
  },

  async getCheckInStatus(): Promise<CheckInStatus> {
    try {
      // First check our local cache
      const lastCheckInTimeStr = await SecureStore.getItemAsync('lastCheckInTime');
      const nextCheckInTimeStr = await SecureStore.getItemAsync('nextCheckInTime');
      
      if (lastCheckInTimeStr && nextCheckInTimeStr) {
        const now = new Date();
        const nextCheckInTime = new Date(nextCheckInTimeStr);
        
        // If we have a valid next check-in time that's in the future
        if (nextCheckInTime > now) {
          return {
            canCheckIn: false,
            nextCheckInTime: nextCheckInTime
          };
        }
      }
      
      // If cache doesn't indicate we're in cooldown, check with the server
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/check-in/status`, { headers });
      if (!response.ok) {
        throw new Error('Failed to get check-in status');
      }
      
      const status = await response.json();
      
      // Update our cache with the server response
      if (!status.canCheckIn && status.nextCheckInTime) {
        await SecureStore.setItemAsync('nextCheckInTime', new Date(status.nextCheckInTime).toISOString());
      }
      
      return status;
    } catch (error) {
      throw new CheckInApiError(
        error instanceof Error ? error.message : 'Failed to get check-in status'
      );
    }
  },

  // DEVELOPER OPTION: Reset the check-in timer ---------------------------------------------------
  async resetCheckInTimer(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/check-in/reset-timer`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset check-in timer');
      }
      
      // Return the full response from the server
      return response.json();
    } catch (error) {
      throw new CheckInApiError(
        error instanceof Error ? error.message : 'Failed to reset check-in timer'
      );
    }
  }
  // ----------------------------------------------------------------------------------------------

};