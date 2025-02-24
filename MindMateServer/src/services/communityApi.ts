// services/communityApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface CommunityMember {
  userId: string;
  role: string;
  joinDate: string;
  user?: {
    username: string;
    profile: {
      name: string;
      isVerifiedProfessional: boolean;
    };
  };
}

export interface CreateCommunityPayload {
  name: string;
  description: string;
  type: string;
}

export interface Community {
  _id: string;
  name: string;
  description: string;
  type: string;
  members: CommunityMember[];
  creator: string;
  memberCount: number;
  isUserMember: boolean;
  userRole: string | null;
  creatorDetails?: {
    username: string;
    profile: {
      name: string;
      isVerifiedProfessional: boolean;
    };
  };
}

class CommunityApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommunityApiError';
  }
}

const handleApiResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new CommunityApiError(data.error || 'API request failed');
  }
  return data;
};

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('userToken');
  if (!token) {
    throw new CommunityApiError('Authentication required');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const communityApi = {
  async fetchAllCommunities(): Promise<Community[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/community`, { headers });
      return handleApiResponse(response);
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to fetch communities'
      );
    }
  },

  async searchCommunities(query: string): Promise<Community[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/community/search?query=${encodeURIComponent(query)}`,
        { headers }
      );
      return handleApiResponse(response);
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to search communities'
      );
    }
  },

  async getCommunityDetails(communityId: string): Promise<Community> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/community/${communityId}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch community details');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to fetch community details'
      );
    }
  },

  async joinCommunity(communityId: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/community/${communityId}/join`,
        {
          method: 'POST',
          headers
        }
      );
      return handleApiResponse(response);
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to join community'
      );
    }
  },

  async leaveCommunity(communityId: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/community/${communityId}/leave`,
        {
          method: 'POST',
          headers
        }
      );
      return handleApiResponse(response);
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to leave community'
      );
    }
  },
  
  async createCommunity(data: CreateCommunityPayload): Promise<Community> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/community`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      return handleApiResponse(response);
    } catch (error) {
      throw new CommunityApiError(
        error instanceof Error ? error.message : 'Failed to create community'
      );
    }
  }
};

