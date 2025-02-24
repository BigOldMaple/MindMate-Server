// server/services/buddyPeerApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface BuddyPeerRequest {
    _id: string;
    senderId: string;
    recipientId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
    sender?: {
        username: string;
        profile: {
            name: string;
        };
    };
    recipient?: {
        username: string;
        profile: {
            name: string;
        };
    };
}

export interface BuddyPeerProfile extends BuddyPeer {
    profile: {
        isVerifiedProfessional: boolean;
        joinDate: string;
        organizationAffiliation?: string;
    };
    stats?: {
        checkIns: number;
        sessions: number;
        responseRate: number;
    };
}

export interface BuddyPeer {
    userId: string;
    username: string;
    name: string;
    relationship: string;
    dateAdded: string;
}

class BuddyPeerApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BuddyPeerApiError';
    }
}

const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
        throw new BuddyPeerApiError('Authentication required');
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

export const buddyPeerApi = {
    async searchUsers(query: string): Promise<Array<{ id: string; username: string; name: string }>> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `${API_URL}/buddy-peer/search?query=${encodeURIComponent(query)}`,
                { headers }
            );
            if (!response.ok) {
                throw new Error('Failed to search users');
            }
            return response.json();
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to search users'
            );
        }
    },

    async sendBuddyRequest(username: string): Promise<void> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer/request`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ username })
            });
            if (!response.ok) {
                throw new Error('Failed to send buddy request');
            }
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to send buddy request'
            );
        }
    },

    async getPendingRequests(): Promise<BuddyPeerRequest[]> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer/requests`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch pending requests');
            }
            return response.json();
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to fetch pending requests'
            );
        }
    },

    async respondToRequest(requestId: string, accept: boolean): Promise<void> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer/request/${requestId}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ accept })
            });
            if (!response.ok) {
                throw new Error('Failed to respond to buddy request');
            }
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to respond to request'
            );
        }
    },

    async getBuddyPeers(): Promise<BuddyPeer[]> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch buddy peers');
            }
            return response.json();
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to fetch buddy peers'
            );
        }
    },

    async removeBuddyPeer(userId: string): Promise<void> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer/${userId}`, {
                method: 'DELETE',
                headers
            });
            if (!response.ok) {
                throw new Error('Failed to remove buddy peer');
            }
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to remove buddy peer'
            );
        }
    },

    async getBuddyProfile(userId: string): Promise<BuddyPeerProfile> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/buddy-peer/${userId}/profile`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch buddy profile');
            }
            return response.json();
        } catch (error) {
            throw new BuddyPeerApiError(
                error instanceof Error ? error.message : 'Failed to fetch buddy profile'
            );
        }
    }
};