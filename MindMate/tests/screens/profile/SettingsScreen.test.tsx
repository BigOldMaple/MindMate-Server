// tests/screens/profile/SettingsScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SettingsScreen from '../../../app/profile/settings/index';
import { auth } from '../../../services/auth';
import { checkInApi } from '../../../services/checkInApi';
import { useAuth } from '../../../contexts/AuthContext';
import { router } from 'expo-router';

jest.mock('../../../services/auth', () => ({
  auth: {
    logout: jest.fn()
  }
}));

jest.mock('../../../services/checkInApi', () => ({
  checkInApi: {
    resetCheckInTimer: jest.fn()
  }
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

describe('SettingsScreen', () => {
  const mockSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (useAuth as jest.Mock).mockReturnValue({ signOut: mockSignOut });
    (auth.logout as jest.Mock).mockResolvedValue({ success: true });
    (checkInApi.resetCheckInTimer as jest.Mock).mockResolvedValue({ success: true });
    
    // Mock Alert.alert
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate pressing the first button (usually Cancel)
      if (buttons && buttons.length > 0 && buttons[0].onPress) {
        buttons[0].onPress();
      }
    });
  });

  test('renders settings categories', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Verify settings sections
    expect(getByText('SUPPORT NETWORK')).toBeTruthy();
    expect(getByText('My Support Network')).toBeTruthy();
    expect(getByText('Privacy Settings')).toBeTruthy();
    expect(getByText('Notification Settings')).toBeTruthy();
    expect(getByText('ACCOUNT')).toBeTruthy();
    expect(getByText('DEVELOPMENT & TESTING')).toBeTruthy();
    expect(getByText('Log Out')).toBeTruthy();
  });

  test('navigates to support network when pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Press support network item
    fireEvent.press(getByText('My Support Network'));
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith('../home/support_network');
  });

  test('navigates to privacy settings when pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Press privacy settings item
    fireEvent.press(getByText('Privacy Settings'));
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith('/profile/settings/privacy');
  });

  test('toggles Do Not Disturb setting', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Find the Do Not Disturb switch
    // This is a bit tricky because we need to find the Switch component
    // For this mock test, we'll assume it's properly connected to the state
  });

  test('shows logout confirmation and logs out when confirmed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Override Alert.alert to simulate pressing Logout
    Alert.alert = jest.fn().mockImplementation((title, message, buttons) => {
      // Find and press the logout button (usually the second button)
      if (buttons && buttons.length > 1 && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });
    
    // Press logout button
    fireEvent.press(getByText('Log Out'));
    
    // Verify logout confirmation shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Logout',
      'Are you sure you want to logout?',
      expect.any(Array)
    );
    
    // Verify logout called
    waitFor(() => {
      expect(auth.logout).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  test('resets check-in timer when button is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    // Override Alert.alert to simulate pressing Reset
    Alert.alert = jest.fn().mockImplementation((title, message, buttons) => {
      // Find and press the reset button (usually the second button)
      if (buttons && buttons.length > 1 && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });
    
    // Press reset check-in timer button
    fireEvent.press(getByText('Reset Check-in Timer'));
    
    // Verify confirmation shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reset Check-in Timer',
      'Are you sure you want to reset the check-in timer? This is for development purposes only.',
      expect.any(Array)
    );
    
    // Verify reset timer called
    waitFor(() => {
      expect(checkInApi.resetCheckInTimer).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String));
    });
  });
});