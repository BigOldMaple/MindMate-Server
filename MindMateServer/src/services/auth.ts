// services/auth.ts
import jwt from 'expo-jwt';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();
console.log('Current API URL:', API_URL); // Debug log to verify URL

const JWT_SECRET = 'your-secret-key'; // In production, use environment variables

type AuthUser = {
    id: string;
    username: string;
    email: string;
    profile: {
        name: string;
        isVerifiedProfessional: boolean;
    };
};

type AuthResult = {
    user: AuthUser;
    token: string;
};

type LoginInput = {
    email: string;
    password: string;
};

type RegisterInput = {
    username: string;
    email: string;
    password: string;
    name: string;
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

            return handleApiResponse(response);
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

            return handleApiResponse(response);
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
            return Promise.resolve();
        } catch (error) {
            console.error('Logout error:', error);
            throw new AuthError('Failed to logout');
        }
    },

    verifyToken(token: string): { userId: string } {
        try {
            const decoded = jwt.decode(token, JWT_SECRET) as { userId: string };
            return decoded;
        } catch (error) {
            throw new AuthError('Invalid token');
        }
    },

    createAuthToken(userId: string): string {
        return jwt.encode({ userId }, JWT_SECRET);
    },

    async getUserById(userId: string): Promise<AuthUser | null> {
        try {
            const response = await fetch(`${API_URL}/auth/user/${userId}`);
            return handleApiResponse(response);
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }
};

export type { AuthResult, LoginInput, RegisterInput, AuthUser };