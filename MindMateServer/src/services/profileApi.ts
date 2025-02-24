// server/services/profileApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
}

export interface UserProfile {
    _id: string;
    username: string;
    email: string;
    phone?: string;
    profile: {
        name: string;
        isVerifiedProfessional: boolean;
    };
    emergencyContact?: EmergencyContact;
}

class ProfileApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProfileApiError';
    }
}

const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
        throw new ProfileApiError('Authentication required');
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

export const profileApi = {
    async getProfile(): Promise<UserProfile> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/profile`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch profile');
            }
            return response.json();
        } catch (error) {
            throw new ProfileApiError(
                error instanceof Error ? error.message : 'Failed to fetch profile'
            );
        }
    },

    async updateProfile(data: {
        username?: string;
        phone?: string;
        emergencyContact?: EmergencyContact;
    }): Promise<UserProfile> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/profile`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error('Failed to update profile');
            }
            return response.json();
        } catch (error) {
            throw new ProfileApiError(
                error instanceof Error ? error.message : 'Failed to update profile'
            );
        }
    }
};