import { getApiUrl } from './apiConfig';
import * as SecureStore from 'expo-secure-store';

const API_URL = getApiUrl();

// Constants for secure storage
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export type AuthUser = {
    id: string;
    username: string;
    email: string;
    profile: {
        name: string;
        isVerifiedProfessional: boolean;
    };
};

export type AuthResult = {
    user: AuthUser;
    token: string;
};

export type LoginInput = {
    email: string;
    password: string;
};

export type RegisterInput = {
    username: string;
    email: string;
    password: string;
    name: string;
};

export type AuthInfo = {
    token: string;
    user?: AuthUser;
};

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

const handleApiResponse = async (response: Response) => {
    console.log('API Response Status:', response.status);
    const data = await response.json();
    console.log('API Response Data:', data);

    if (!response.ok) {
        throw new AuthError(data.error || 'Request failed');
    }

    return data;
};

// Helper to save auth information to secure storage
const saveAuthInfo = async (authResult: AuthResult) => {
    try {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authResult.token);
        await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(authResult.user));
        return true;
    } catch (error) {
        console.error('Error saving auth info:', error);
        return false;
    }
};

// Helper to clear auth information from secure storage
const clearAuthInfo = async () => {
    try {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AUTH_USER_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing auth info:', error);
        return false;
    }
};

export const auth = {
    async login({ email, password }: LoginInput): Promise<AuthResult> {
        try {
            console.log('Attempting login with email:', email);
            console.log('Making request to:', `${API_URL}/auth/login`);
            
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const authResult = await handleApiResponse(response);
            
            // Save auth info to secure storage
            await saveAuthInfo(authResult);
            
            return authResult;
        } catch (error) {
            console.error('Login error details:', error);
            if (error instanceof AuthError) {
                throw error;
            }
            if (error instanceof TypeError && error.message === 'Network request failed') {
                throw new AuthError('Cannot connect to server. Please check your connection and make sure you are on the same network as the server.');
            }
            throw new AuthError('Network error occurred');
        }
    },

    async register({ username, email, password, name }: RegisterInput): Promise<AuthResult> {
        try {
            console.log('Attempting registration:', { username, email, name });
            console.log('Making request to:', `${API_URL}/auth/register`);
            
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, name }),
            });

            const authResult = await handleApiResponse(response);
            
            // Save auth info to secure storage
            await saveAuthInfo(authResult);
            
            return authResult;
        } catch (error) {
            console.error('Registration error details:', error);
            if (error instanceof AuthError) {
                throw error;
            }
            if (error instanceof TypeError && error.message === 'Network request failed') {
                throw new AuthError('Cannot connect to server. Please check your connection and make sure you are on the same network as the server.');
            }
            throw new AuthError('Network error occurred');
        }
    },

    async logout(): Promise<void> {
        try {
            console.log('Logging out user');
            
            // Clear auth info from secure storage
            await clearAuthInfo();
            
            return Promise.resolve();
        } catch (error) {
            console.error('Logout error:', error);
            throw new AuthError('Failed to logout');
        }
    },
    
    // Add getAuthInfo method to retrieve current auth information
    async getAuthInfo(): Promise<AuthInfo | null> {
        try {
            // Get token from secure storage
            const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
            if (!token) {
                return null;
            }
            
            // Get user info if available
            let user: AuthUser | undefined;
            const userJson = await SecureStore.getItemAsync(AUTH_USER_KEY);
            
            if (userJson) {
                try {
                    user = JSON.parse(userJson);
                } catch (e) {
                    console.error('Error parsing user JSON:', e);
                }
            }
            
            return {
                token,
                user
            };
        } catch (error) {
            console.error('Error getting auth info:', error);
            return null;
        }
    },
    
    // Add method to get just the token for simpler auth needs
    async getToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }
};