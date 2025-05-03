// tests/screens/home/CheckIn.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CheckInScreen from '../../../app/home/check_in/index';
import { checkInApi } from '../../../services/checkInApi';
import { notificationsApi } from '../../../services/notificationsApi';
import { notificationService } from '../../../services/notificationService';
import { router } from 'expo-router';

// Mock dependencies
jest.mock('../../../services/checkInApi', () => ({
  checkInApi: {
    getCheckInStatus: jest.fn(),
    submitCheckIn: jest.fn(),
    resetCheckInTimer: jest.fn()
  }
}));

jest.mock('../../../services/notificationsApi', () => ({
  notificationsApi: {
    getNotifications: jest.fn(),
    createNotification: jest.fn(),
    markAsRead: jest.fn()
  }
}));

jest.mock('../../../services/notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn()
  }
}));

// Mock the notificationTracker
jest.mock('../../../services/notificationTracker', () => ({
  notificationTracker: {
    hasShownCheckInNotification: jest.fn(),
    markCheckInNotificationShown: jest.fn(),
    resetCheckInNotificationFlag: jest.fn()
  }
}));

describe('CheckInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValue({
      canCheckIn: true
    });
    
    (checkInApi.submitCheckIn as jest.Mock).mockResolvedValue({
      success: true
    });
    
    (notificationsApi.getNotifications as jest.Mock).mockResolvedValue([]);
    (notificationsApi.createNotification as jest.Mock).mockResolvedValue({
      id: 'new-notification-id'
    });
  });

  test('renders mood selection screen initially', async () => {
    const { findByText, getByText } = render(<CheckInScreen />);
    
    // Wait for loading check to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Verify mood selection screen elements
    expect(await findByText('How are you feeling today?')).toBeTruthy();
    expect(getByText('Very Low')).toBeTruthy();
    expect(getByText('Low')).toBeTruthy();
    expect(getByText('Neutral')).toBeTruthy();
    expect(getByText('Good')).toBeTruthy();
    expect(getByText('Very Good')).toBeTruthy();
    
    // Verify continue button is disabled initially (no mood selected)
    const continueButton = getByText('Continue');
    expect(continueButton.props.disabled).toBeTruthy();
  });

  test('enables continue button when mood is selected', async () => {
    const { findByText, getByText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Select a mood
    fireEvent.press(await findByText('Good'));
    
    // Verify continue button is enabled
    const continueButton = getByText('Continue');
    expect(continueButton.props.disabled).toBeFalsy();
  });

  test('navigates to activity selection when continue is pressed', async () => {
    const { findByText, getByText, queryByText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Select a mood
    fireEvent.press(await findByText('Good'));
    
    // Press continue
    fireEvent.press(getByText('Continue'));
    
    // Verify activity selection screen is shown
    expect(await findByText('Activity Levels')).toBeTruthy();
    expect(queryByText('How are you feeling today?')).toBeNull();
    
    // Verify the sleep activity is shown
    expect(getByText('Sleep')).toBeTruthy();
  });

  test('allows selecting activity levels', async () => {
    const { findByText, getByText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Select a mood and continue
    fireEvent.press(await findByText('Good'));
    fireEvent.press(getByText('Continue'));
    
    // Select activity levels
    await findByText('Activity Levels');
    fireEvent.press(getByText('Low'));
    fireEvent.press(getByText('Moderate'));
    fireEvent.press(getByText('High'));
    
    // Verify submit button shows correct count
    expect(await findByText('Rate at least 3 activities (3/3)')).toBeTruthy();
  });

  test('submit button is disabled until 3 activities are selected', async () => {
    const { findByText, getByText, queryAllByText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Select a mood and continue
    fireEvent.press(await findByText('Good'));
    fireEvent.press(getByText('Continue'));
    
    // Find the first "Low" button and press it (only one activity)
    const lowButtons = queryAllByText('Low');
    fireEvent.press(lowButtons[0]);
    
    // Verify button is disabled with count 1/3
    const submitButton = getByText('Complete Check-in');
    expect(await findByText('Rate at least 3 activities (1/3)')).toBeTruthy();
    expect(submitButton.props.disabled).toBeTruthy();
    
    // Add more activities to reach 3
    fireEvent.press(lowButtons[1]);
    fireEvent.press(lowButtons[2]);
    
    // Verify button is enabled with count 3/3
    expect(await findByText('Rate at least 3 activities (3/3)')).toBeTruthy();
    expect(submitButton.props.disabled).toBeFalsy();
  });

  test('submits check-in data when complete button is pressed', async () => {
    const { findByText, getByText, queryAllByText, getByPlaceholderText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Select a mood
    fireEvent.press(await findByText('Good'));
    
    // Add mood description
    const descriptionInput = getByPlaceholderText("Describe how you're feeling...");
    fireEvent.changeText(descriptionInput, 'Feeling pretty good today');
    
    // Continue to activity selection
    fireEvent.press(getByText('Continue'));
    
    // Select 3 activities
    const lowButtons = await waitFor(() => queryAllByText('Low'));
    fireEvent.press(lowButtons[0]); // Sleep - Low
    
    const moderateButtons = queryAllByText('Moderate');
    fireEvent.press(moderateButtons[1]); // Exercise - Moderate
    
    const highButtons = queryAllByText('High');  
    fireEvent.press(highButtons[2]); // Social - High
    
    // Submit the check-in
    fireEvent.press(getByText('Complete Check-in'));
    
    // Verify API call with correct data
    await waitFor(() => {
      expect(checkInApi.submitCheckIn).toHaveBeenCalledWith({
        mood: {
          score: 4,
          label: 'Good',
          description: 'Feeling pretty good today'
        },
        activities: [
          { type: 'Sleep', level: 'low' },
          { type: 'Exercise', level: 'moderate' },
          { type: 'Social', level: 'high' }
        ]
      });
    });
    
    // Verify success message and navigation
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Check-in submitted successfully');
    expect(router.back).toHaveBeenCalled();
  });

  test('shows cooldown UI when check-in is not available', async () => {
    // Mock check-in cooldown
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() + 3); // 3 hours from now
    
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValue({
      canCheckIn: false,
      nextCheckInTime: cooldownDate.toISOString()
    });
    
    const { findByText } = render(<CheckInScreen />);
    
    // Verify cooldown screen is shown
    expect(await findByText('Check-In Not Available')).toBeTruthy();
    expect(await findByText('You have already completed your check-in for today.')).toBeTruthy();
    
    // Verify back button is available
    const backButton = await findByText('Back to Home');
    expect(backButton).toBeTruthy();
    
    // Press back button
    fireEvent.press(backButton);
    
    // Verify navigation
    expect(router.back).toHaveBeenCalled();
  });

  test('handles API errors when submitting check-in', async () => {
    // Mock API error
    (checkInApi.submitCheckIn as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    const { findByText, getByText, queryAllByText } = render(<CheckInScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    });
    
    // Complete the form
    fireEvent.press(await findByText('Good'));
    fireEvent.press(getByText('Continue'));
    
    // Select 3 activities
    const lowButtons = await waitFor(() => queryAllByText('Low'));
    fireEvent.press(lowButtons[0]);
    fireEvent.press(lowButtons[1]);
    fireEvent.press(lowButtons[2]);
    
    // Submit the check-in
    fireEvent.press(getByText('Complete Check-in'));
    
    // Verify error alert
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error', 
        'Failed to submit check-in. Please try again.'
      );
    });
  });
});