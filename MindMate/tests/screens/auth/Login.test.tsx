// tests/screens/auth/Login.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Import the component after all mocks are set up in setup.ts
import LoginScreen from '../../../app/(auth)/login';
import { auth, AuthError } from '../../../services/auth';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'expo-router';

// Add specific mocks for this test
jest.mock('../../../services/auth', () => ({
    auth: {
        login: jest.fn()
    },
    AuthError: class AuthError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'AuthError';
        }
    }
}));

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: jest.fn()
}));

describe('LoginScreen', () => {
    // Setup for each test
    const mockSignIn = jest.fn();
    const mockRouter = { push: jest.fn(), back: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mocks
        (useAuth as jest.Mock).mockReturnValue({
            signIn: mockSignIn
        });

        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    });

    test('renders login form correctly', () => {
        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        // Check form elements
        expect(getByPlaceholderText('Email')).toBeTruthy();
        expect(getByPlaceholderText('Password')).toBeTruthy();
        expect(getByText('Log In')).toBeTruthy();
        expect(getByText("Don't have an account? Sign Up")).toBeTruthy();
    });

    test('validates form inputs and shows error for empty fields', () => {
        const { getByText } = render(<LoginScreen />);

        // Attempt to submit empty form
        fireEvent.press(getByText('Log In'));

        // Check if validation error is shown
        expect(Alert.alert).toHaveBeenCalledWith(
            'Missing Information',
            'Please fill in all fields'
        );
    });

    test('shows loading indicator during login process', async () => {
        // Mock login to delay resolution
        (auth.login as jest.Mock).mockReturnValue(
            new Promise(resolve => setTimeout(() => resolve({
                token: 'fake-token',
                user: { id: '123' }
            }), 100))
        );

        const { getByPlaceholderText, getByText, queryByTestId } = render(
            <LoginScreen />
        );

        // Fill form
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');

        // Submit form
        fireEvent.press(getByText('Log In'));

        // Check for loading state
        expect(queryByTestId('login-loading')).toBeTruthy();
    });

    test('handles successful login', async () => {
        // Mock successful login response
        const mockResponse = {
            token: 'fake-token',
            user: { id: '123', username: 'testuser' }
        };
        (auth.login as jest.Mock).mockResolvedValue(mockResponse);

        const { getByPlaceholderText, getByText } = render(<LoginScreen />);

        // Fill form
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');

        // Submit form
        fireEvent.press(getByText('Log In'));

        // Verify auth service was called with correct params
        await waitFor(() => {
            expect(auth.login).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123'
            });
        });

        // Verify context signIn was called with token and user
        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith(
                mockResponse.token,
                mockResponse.user
            );
        });
    });

    test('displays appropriate error messages for different login failures', async () => {
        // Test different error cases
        const testCases = [
            {
                error: new AuthError('Account not found'),
                expected: ['Login Failed', 'Account not found']
            },
            {
                error: new AuthError('Incorrect password'),
                expected: ['Login Failed', 'Incorrect password']
            },
            {
                error: new Error('Network error'),
                expected: ['Error', 'Something went wrong. Please try again.']
            }
        ];

        for (const { error, expected } of testCases) {
            // Reset mocks
            jest.clearAllMocks();
            (auth.login as jest.Mock).mockRejectedValue(error);

            const { getByPlaceholderText, getByText } = render(<LoginScreen />);

            // Fill form
            fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
            fireEvent.changeText(getByPlaceholderText('Password'), 'password123');

            // Submit form
            fireEvent.press(getByText('Log In'));

            // Verify correct error message is shown
            await waitFor(() => {
                expect(Alert.alert).toHaveBeenCalledWith(expected[0], expected[1]);
            });
        }
    });

    test('navigates to signup screen when signup link is pressed', () => {
        const { getByText } = render(<LoginScreen />);

        // Press signup link
        fireEvent.press(getByText("Don't have an account? Sign Up"));

        // Verify navigation
        expect(mockRouter.push).toHaveBeenCalledWith('/signup');
    });
});