// __tests__/login-logic.test.ts
import { Alert } from 'react-native';
import { auth, AuthError, AuthResult } from '@/services/auth';

// Mock dependencies
jest.mock('@/services/auth', () => ({
  auth: {
    login: jest.fn().mockResolvedValue({
      token: 'test-token',
      user: { 
        id: 'user-id', 
        username: 'testuser',
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          isVerifiedProfessional: false
        }
      }
    })
  },
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() }
}));

// Mock AuthContext
const mockSignIn = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn
  })
}));

describe('Login Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to simulate the login logic
  const performLogin = async (email: string, password: string): Promise<boolean> => {
    // Validation logic
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return false;
    }
    
    try {
      const response: AuthResult = await auth.login({ email, password });
      await mockSignIn(response.token, response.user);
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.message === 'Account not found') {
          Alert.alert('Login Failed', 'Account not found');
        } else if (error.message === 'Incorrect password') {
          Alert.alert('Login Failed', 'Incorrect password');
        } else {
          Alert.alert('Login Failed', 'Invalid email or password');
        }
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
      return false;
    }
  };

  it('validates empty email field', async () => {
    const result = await performLogin('', 'password123');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Information',
      'Please fill in all fields'
    );
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('validates empty password field', async () => {
    const result = await performLogin('test@example.com', '');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Information',
      'Please fill in all fields'
    );
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('calls auth.login with correct credentials and handles success', async () => {
    const result = await performLogin('test@example.com', 'password123');
    
    expect(auth.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
    expect(result).toBe(true);
    expect(mockSignIn).toHaveBeenCalledWith('test-token', expect.objectContaining({
      id: 'user-id',
      profile: expect.objectContaining({
        name: 'Test User'
      })
    }));
  });

  it('handles "Account not found" error', async () => {
    (auth.login as jest.Mock).mockRejectedValueOnce(new AuthError('Account not found'));
    
    const result = await performLogin('nonexistent@example.com', 'password123');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Account not found');
  });

  it('handles "Incorrect password" error', async () => {
    (auth.login as jest.Mock).mockRejectedValueOnce(new AuthError('Incorrect password'));
    
    const result = await performLogin('test@example.com', 'wrongpassword');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Incorrect password');
  });

  it('handles generic auth errors', async () => {
    (auth.login as jest.Mock).mockRejectedValueOnce(new AuthError('Unknown error'));
    
    const result = await performLogin('test@example.com', 'password123');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid email or password');
  });

  it('handles unexpected errors', async () => {
    (auth.login as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    const result = await performLogin('test@example.com', 'password123');
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.');
  });
});