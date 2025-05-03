// tests/screens/auth/Signup.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SignupScreen from '../../../app/(auth)/signup';
import { auth, AuthError } from '../../../services/auth';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

jest.mock('../../../services/auth', () => ({
  auth: {
    register: jest.fn()
  },
  AuthError: class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  }
}));

describe('SignupScreen', () => {
  const mockRouter = { replace: jest.fn(), push: jest.fn() };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  test('renders signup form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);
    
    // Check form elements
    expect(getByPlaceholderText('Full Name')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm Password')).toBeTruthy();
    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('Already have an account? Log In')).toBeTruthy();
  });

  test('validates form inputs and shows errors', () => {
    const { getByText, getByPlaceholderText } = render(<SignupScreen />);
    
    // Test 1: Empty form submission
    fireEvent.press(getByText('Create Account'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all required fields');
    
    // Test 2: Password mismatch
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password456');
    
    fireEvent.press(getByText('Create Account'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Passwords do not match');
  });

  test('handles successful registration', async () => {
    const mockResponse = {
      token: 'fake-token',
      user: { id: '123', username: 'testuser' }
    };
    (auth.register as jest.Mock).mockResolvedValue(mockResponse);
    
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);
    
    // Fill form with valid data
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'testuser');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
    
    // Submit form
    fireEvent.press(getByText('Create Account'));
    
    // Verify registration was called with correct params
    await waitFor(() => {
      expect(auth.register).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      });
    });
    
    // Verify token storage
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userToken', 'fake-token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('userData', JSON.stringify(mockResponse.user));
    });
    
    // Verify navigation
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  test('handles registration error', async () => {
    const error = new AuthError('Username already exists');
    (auth.register as jest.Mock).mockRejectedValue(error);
    
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);
    
    // Fill form
    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Username'), 'existinguser');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
    
    // Submit form
    fireEvent.press(getByText('Create Account'));
    
    // Verify error alert
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Signup Failed', 'Username already exists');
    });
  });

  test('navigates to login screen when login link is pressed', () => {
    const { getByText } = render(<SignupScreen />);
    
    // Press login link
    fireEvent.press(getByText('Already have an account? Log In'));
    
    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith('../login');
  });
});