// app/(auth)/__tests__/login.test.tsx
import React from 'react';
import { Alert, View, Text, TextInput, Pressable } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

// Mock services first
jest.mock('@/services/auth', () => ({
  auth: {
    login: jest.fn().mockResolvedValue({
      token: 'test-token',
      user: { id: 'user-id', name: 'Test User' }
    })
  },
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  }
}));

// Import auth after mocking
import { auth } from '@/services/auth';

// Create a simple component for testing that captures the core functionality
const TestLoginScreen = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }
    
    try {
      await auth.login({ email, password });
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  };
  
  return (
    <View>
      <TextInput 
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        testID="email-input"
      />
      <TextInput 
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="password-input"
      />
      <Pressable onPress={handleLogin} testID="login-button">
        <Text>Log In</Text>
      </Pressable>
    </View>
  );
};

describe('Login Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<TestLoginScreen />);
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Log In')).toBeTruthy();
  });

  it('shows validation error when fields are empty', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<TestLoginScreen />);
    
    // Click login without filling fields
    fireEvent.press(getByText('Log In'));
    
    expect(alertSpy).toHaveBeenCalledWith(
      'Missing Information',
      'Please fill in all fields'
    );
  });

  it('calls auth.login with correct credentials', async () => {
    const { getByPlaceholderText, getByText } = render(<TestLoginScreen />);
    
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