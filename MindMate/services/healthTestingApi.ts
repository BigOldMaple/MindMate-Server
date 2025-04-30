// services/healthTestingApi.ts
import { getApiUrl } from './apiConfig';
import * as SecureStore from 'expo-secure-store';

const API_URL = getApiUrl();

// Interface for test data generation request
export interface TestDataGenerationRequest {
  pattern: 'good' | 'declining' | 'critical' | 'improving' | 'fluctuating';
  startDate: string;
  days: number;
}

// Interface for test data generation response
export interface TestDataGenerationResponse {
  success: boolean;
  message: string;
  metrics?: {
    daysGenerated: number;
    sleepRecords: number;
    activityRecords: number;
    exerciseRecords: number;
  };
}

// Interface for clear test data response
export interface ClearTestDataResponse {
  success: boolean;
  message: string;
  count?: number;
}

export const healthTestingApi = {
  /**
   * Generate test health data with the specified pattern
   */
  async generateTestData(request: TestDataGenerationRequest): Promise<TestDataGenerationResponse> {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/health-data/generate-test-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate test data');
      }

      return response.json();
    } catch (error) {
      console.error('Generate test data error:', error);
      throw error;
    }
  },

  /**
   * Clear all test data for a specific date range
   */
  async clearTestData(startDate: string, endDate: string): Promise<ClearTestDataResponse> {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/health-data/clear-test-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear test data');
      }

      return response.json();
    } catch (error) {
      console.error('Clear test data error:', error);
      throw error;
    }
  }
};