import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

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
    }
};