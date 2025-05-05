// __tests__/signup-logic.test.ts
import { Alert } from 'react-native';
import { auth, AuthError, RegisterInput, AuthResult } from '@/services/auth';
import * as SecureStore from 'expo-secure-store';

// Define interface for form data
interface SignupFormData {
  name: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

// Define router interface
interface Router {
  replace: (route: string) => void;
}

// Mock dependencies
jest.mock('@/services/auth', () => ({
  auth: {
    register: jest.fn().mockResolvedValue({
      token: 'test-token',
      user: { 
        id: 'user-id', 
        name: 'Test User', 
        email: 'test@example.com', 
        username: 'testuser',
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

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(true)
}));

// Mock router
const mockRouter: Router = {
  replace: jest.fn()
};

describe('Signup Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to simulate the signup logic
  const performSignup = async (formData: SignupFormData, router: Router = mockRouter): Promise<boolean> => {
    // Validation logic
    if (!formData.email || !formData.password || !formData.username) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    try {
      const response = await auth.register({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        name: formData.name,
      });

      await SecureStore.setItemAsync('userToken', response.token);
      await SecureStore.setItemAsync('userData', JSON.stringify(response.user));

      router.replace('/(tabs)');
      return true;
    } catch (error) {
      Alert.alert(
        'Signup Failed',
        error instanceof AuthError ? error.message : 'An unexpected error occurred'
      );
      return false;
    }
  };

  it('validates all required fields', async () => {
    // Missing email
    let result = await performSignup({
      name: 'Test User',
      email: '',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all required fields');
    expect(auth.register).not.toHaveBeenCalled();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Missing username
    result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: '',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all required fields');
    expect(auth.register).not.toHaveBeenCalled();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Missing password
    result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: '',
      confirmPassword: ''
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all required fields');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('validates password confirmation', async () => {
    const result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password456'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Passwords do not match');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('handles successful registration', async () => {
    const result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(auth.register).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
      name: 'Test User'
    });
    
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userToken', 'test-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userData', expect.any(String));
    
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    expect(result).toBe(true);
  });

  it('handles user already exists error', async () => {
    (auth.register as jest.Mock).mockRejectedValueOnce(new AuthError('User already exists'));
    
    const result = await performSignup({
      name: 'Test User',
      email: 'existing@example.com',
      username: 'existinguser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Signup Failed', 'User already exists');
  });

  it('handles invalid email error', async () => {
    (auth.register as jest.Mock).mockRejectedValueOnce(new AuthError('Invalid email format'));
    
    const result = await performSignup({
      name: 'Test User',
      email: 'invalid-email',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Signup Failed', 'Invalid email format');
  });

  it('handles username taken error', async () => {
    (auth.register as jest.Mock).mockRejectedValueOnce(new AuthError('Username already taken'));
    
    const result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: 'takenuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Signup Failed', 'Username already taken');
  });

  it('handles general network error', async () => {
    (auth.register as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    const result = await performSignup({
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Signup Failed', 'An unexpected error occurred');
  });

  it('handles submission with optional name field empty', async () => {
    const result = await performSignup({
      name: '', // Name is optional
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123'
    });
    
    expect(auth.register).toHaveBeenCalledWith({
      name: '',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123'
    });
    
    expect(result).toBe(true);
  });
});