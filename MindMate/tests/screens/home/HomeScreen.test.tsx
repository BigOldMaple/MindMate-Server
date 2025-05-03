// tests/screens/home/HomeScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../../../app/(tabs)/index';
import { buddyPeerApi } from '../../../services/buddyPeerApi';
import { checkInApi } from '../../../services/checkInApi';
import { router } from 'expo-router';

jest.mock('../../../services/buddyPeerApi', () => ({
  buddyPeerApi: {
    getBuddyPeers: jest.fn(),
    getPendingRequests: jest.fn()
  }
}));

jest.mock('../../../services/checkInApi', () => ({
  checkInApi: {
    getCheckInStatus: jest.fn()
  }
}));

jest.mock('../../../components/SupportRequestsSection', () => 'SupportRequestsSection');
jest.mock('../../../components/SyncHealthDataButton', () => 'SyncHealthDataButton');
jest.mock('../../../components/EstablishBaselineButton', () => 'EstablishBaselineButton');
jest.mock('../../../components/AnalyzeRecentButton', () => 'AnalyzeRecentButton');
jest.mock('../../../components/ClearAnalysisButton', () => 'ClearAnalysisButton');

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (buddyPeerApi.getBuddyPeers as jest.Mock).mockResolvedValue([
      { userId: '1', name: 'Buddy One', username: 'buddy1' },
      { userId: '2', name: 'Buddy Two', username: 'buddy2' }
    ]);
    
    (buddyPeerApi.getPendingRequests as jest.Mock).mockResolvedValue([
      { _id: 'req1', sender: { username: 'newbuddy' } }
    ]);
    
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValue({
      canCheckIn: true
    });
  });

  test('renders wellness overview section', async () => {
    const { findByText } = render(<HomeScreen />);
    
    // Verify wellness section renders
    expect(await findByText('Current Wellness')).toBeTruthy();
    expect(await findByText('Sleep:')).toBeTruthy();
    expect(await findByText('Activity:')).toBeTruthy();
    expect(await findByText('Social:')).toBeTruthy();
  });

  test('renders support network section with correct data', async () => {
    const { findByText } = render(<HomeScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(buddyPeerApi.getBuddyPeers).toHaveBeenCalled();
      expect(buddyPeerApi.getPendingRequests).toHaveBeenCalled();
    });
    
    // Verify support network section renders with correct counts
    expect(await findByText('Support Network')).toBeTruthy();
    expect(await findByText('2')).toBeTruthy(); // 2 buddy peers
    expect(await findByText('1')).toBeTruthy(); // 1 pending request
  });

  test('check-in button is enabled when check-in is available', async () => {
    const { findByText } = render(<HomeScreen />);
    
    // Verify check-in button is enabled
    const checkInButton = await findByText('Check In Now');
    expect(checkInButton).toBeTruthy();
    
    // Press check-in button
    fireEvent.press(checkInButton);
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith('./home/check_in');
  });

  test('check-in button is disabled when in cooldown', async () => {
    // Mock check-in cooldown
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() + 3); // 3 hours from now
    
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValue({
      canCheckIn: false,
      nextCheckInTime: cooldownDate.toISOString()
    });
    
    const { findByText } = render(<HomeScreen />);
    
    // Verify check-in button shows cooldown text
    const cooldownText = await findByText(/Next Check-in in/);
    expect(cooldownText).toBeTruthy();
    
    // Try to press the disabled check-in button
    fireEvent.press(cooldownText);
    
    // Verify alert is shown
    expect(Alert.alert).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test('toggles developer options section', async () => {
    const { findByText, queryByText } = render(<HomeScreen />);
    
    // Verify developer options section is initially collapsed
    const devOptionsButton = await findByText('Developer Options');
    expect(devOptionsButton).toBeTruthy();
    expect(queryByText('Mental Health Analysis')).toBeNull();
    
    // Expand developer options
    fireEvent.press(devOptionsButton);
    
    // Verify developer options section is expanded
    await waitFor(() => {
      expect(queryByText('Mental Health Analysis')).toBeTruthy();
      expect(queryByText('Testing Tools')).toBeTruthy();
    });
    
    // Collapse developer options
    fireEvent.press(devOptionsButton);
    
    // Verify developer options section is collapsed again
    await waitFor(() => {
      expect(queryByText('Mental Health Analysis')).toBeNull();
    });
  });
});