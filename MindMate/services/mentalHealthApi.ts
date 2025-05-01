// services/mentalHealthApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface MentalHealthAssessment {
  _id: string;
  userId: string;
  timestamp: string;
  mentalHealthStatus: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  needsSupport: boolean;
  supportRequestStatus: 'none' | 'buddyRequested' | 'communityRequested' | 'globalRequested' | 'supportProvided';
  supportRequestTime?: string;
  supportProvidedBy?: string;
  supportProvidedTime?: string;
  reasoningData: {
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    checkInMood?: number;
    significantChanges?: string[];
    [key: string]: any;
  };
}

// Interface for populated support requests returned from the API
export interface PopulatedSupportRequest {
  _id: string;
  userId: {
    _id: string;
    username: string;
    profile: {
      name: string;
    };
  };
  timestamp: string;
  mentalHealthStatus: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  needsSupport: boolean;
  supportRequestStatus: 'none' | 'buddyRequested' | 'communityRequested' | 'globalRequested' | 'supportProvided';
  supportRequestTime: string;
  supportProvidedBy?: string;
  supportProvidedTime?: string;
  reasoningData: {
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    checkInMood?: number;
    significantChanges?: string[];
    [key: string]: any;
  };
  supportReason?: string;
  supportTips?: string[];
}

class MentalHealthApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MentalHealthApiError';
  }
}

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('userToken');
  if (!token) {
    throw new MentalHealthApiError('Authentication required');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const mentalHealthApi = {
  /**
   * Get the latest mental health assessment
   */
  async getLatestAssessment(): Promise<MentalHealthAssessment> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/assessment`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch mental health assessment');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get assessment error:', error);
      throw error;
    }
  },
  
  /**
   * Trigger a new mental health assessment
   */
  async triggerAssessment(): Promise<MentalHealthAssessment> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/assess`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger mental health assessment');
      }
      
      return response.json();
    } catch (error) {
      console.error('Trigger assessment error:', error);
      throw error;
    }
  },
  
  /**
   * Establish a baseline assessment
   */
  async establishBaseline(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/establish-baseline`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to establish baseline');
      }
      
      return response.json();
    } catch (error) {
      console.error('Establish baseline error:', error);
      throw error;
    }
  },
  
  /**
   * Analyze recent health data
   */
  async analyzeRecentHealth(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/analyze-recent`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze recent health data');
      }
      
      return response.json();
    } catch (error) {
      console.error('Analyze recent health error:', error);
      throw error;
    }
  },
  
  /**
   * Get mental health assessment history
   */
  async getAssessmentHistory(limit: number = 10): Promise<MentalHealthAssessment[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/history?limit=${limit}`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch assessment history');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get assessment history error:', error);
      throw error;
    }
  },

  /**
   * Clear all mental health data (development only)
   */
  async clearAssessmentData(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/admin/clear-assessments`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear assessment data');
      }
      
      return response.json();
    } catch (error) {
      console.error('Clear assessment data error:', error);
      throw error;
    }
  },
  
  /**
   * Get buddy support requests
   */
  async getBuddySupportRequests(): Promise<PopulatedSupportRequest[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/buddy-support-requests`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch buddy support requests');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get buddy support requests error:', error);
      throw error;
    }
  },

  /**
   * Get community support requests
   */
  async getCommunitySupportRequests(): Promise<PopulatedSupportRequest[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/community-support-requests`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch community support requests');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get community support requests error:', error);
      throw error;
    }
  },

  /**
   * Get global support requests
   */
  async getGlobalSupportRequests(): Promise<PopulatedSupportRequest[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/global-support-requests`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch global support requests');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get global support requests error:', error);
      throw error;
    }
  },

  /**
   * Provide support for a user
   */
  async provideSupport(assessmentId: string): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/provide-support/${assessmentId}`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to provide support');
      }
      
      return response.json();
    } catch (error) {
      console.error('Provide support error:', error);
      throw error;
    }
  },
  
  /**
   * Get support statistics
   */
  async getSupportStatistics(): Promise<any> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/mental-health/support-statistics`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch support statistics');
      }
      
      return response.json();
    } catch (error) {
      console.error('Get support statistics error:', error);
      throw error;
    }
  },
    /**
   * Get baseline history
   */
    async getBaselineHistory(limit: number = 5): Promise<any[]> {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/mental-health/baseline/history?limit=${limit}`, { headers });
        
        if (!response.ok) {
          throw new Error('Failed to fetch baseline history');
        }
        
        return response.json();
      } catch (error) {
        console.error('Get baseline history error:', error);
        throw error;
      }
    }
};

