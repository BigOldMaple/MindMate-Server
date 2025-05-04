// app/(auth)/__tests__/login.test.tsx
import React from 'react';
import { Alert, ViewProps, TextProps } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

// Mock dependencies at the top
jest.mock('@/components/Themed', () => ({
  View: (props: ViewProps) => {
    const React = require('react');
    return React.createElement('View', props, props.children);
  },
  Text: (props: TextProps) => {
    const React = require('react');
    return React.createElement('Text', props, props.children);
  }
}));

jest.mock('@expo/vector-icons/FontAwesome', () => {
  const React = require('react');
  return (props: {name: string; size?: number; color?: string; style?: any}) => 
    React.createElement('FontAwesomeMock', props, null);
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  })
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: jest.fn().mockImplementation(() => Promise.resolve()),
    user: null,
    isLoading: false
  })
}));

jest.mock('@/services/auth', () => ({
  auth: {
    login: jest.fn().mockImplementation(() => 
      Promise.resolve({
        token: 'test-token',
        user: { id: 'user-id', name: 'Test User' }
      })
    )
  },
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
}));

// Now import after mocking
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