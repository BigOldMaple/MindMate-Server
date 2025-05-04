// app/(auth)/__tests__/login.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor, render } from '@testing-library/react-native';

// Mock all the dependencies
jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesomeMock');
jest.mock('@/components/Themed', () => ({
  View: 'View',
  Text: 'Text',
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    signIn: jest.fn(),
    user: null,
    isLoading: false,
  })),
}));
jest.mock('@/services/auth', () => ({
  auth: {
    login: jest.fn(),
  },
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// Now import the component
import LoginScreen from '../login';
import { auth } from '@/services/auth'; 

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Log In')).toBeTruthy();
  });

  it('shows validation error when fields are empty', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<LoginScreen />);
    
    // Click login without filling fields
    fireEvent.press(getByText('Log In'));
    
    expect(alertSpy).toHaveBeenCalledWith(
      'Missing Information',
      'Please fill in all fields'
    );
  });

  it('calls auth.login with correct credentials', async () => {
    (auth.login as jest.Mock).mockResolvedValueOnce({
      token: 'test-token',
      user: { id: 'user-id', name: 'Test User' }
    });
    
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    // Fill the form
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    
    // Submit form
    fireEvent.press(getByText('Log In'));
    
    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });
});