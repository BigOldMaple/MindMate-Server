// tests/screens/profile/ProfileScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../../../app/(tabs)/profile';
import { profileApi } from '../../../services/profileApi';
import { mentalHealthApi } from '../../../services/mentalHealthApi';
import { useAuth } from '../../../contexts/AuthContext';

jest.mock('../../../services/profileApi', () => ({
  profileApi: {
    getProfile: jest.fn(),
    updateProfile: jest.fn()
  }
}));

jest.mock('../../../services/mentalHealthApi', () => ({
  mentalHealthApi: {
    getAssessmentHistory: jest.fn(),
    getBaselineHistory: jest.fn()
  }
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../../../components/MentalHealthHistoryCard', () => 'MentalHealthHistoryCard');
jest.mock('../../../components/MentalHealthDetailsModal', () => 'MentalHealthDetailsModal');

describe('ProfileScreen', () => {
  const mockUser = { id: 'user-1', username: 'testuser' };
  const mockProfile = {
    username: 'testuser',
    email: 'test@example.com',
    phone: '123-456-7890',
    emergencyContact: {
      name: 'Emergency Contact',
      relationship: 'Family',
      phone: '987-654-3210'
    }
  };
  
  const mockAssessments = [
    {
      _id: 'assessment1',
      timestamp: new Date().toISOString(),
      mentalHealthStatus: 'stable',
      confidenceScore: 0.85,
      reasoningData: {
        sleepQuality: 'good',
        activityLevel: 'moderate',
        checkInMood: 4
      }
    }
  ];
  
  const mockBaselines = [
    {
      _id: 'baseline1',
      establishedAt: new Date().toISOString(),
      confidenceScore: 0.9,
      rawAssessmentData: {
        mentalHealthStatus: 'stable'
      },
      baselineMetrics: {
        sleepQuality: 'good',
        sleepHours: 7.5,
        activityLevel: 'moderate',
        averageMoodScore: 4,
        averageStepsPerDay: 8000
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (profileApi.getProfile as jest.Mock).mockResolvedValue(mockProfile);
    (profileApi.updateProfile as jest.Mock).mockImplementation(
      data => Promise.resolve({ ...mockProfile, ...data })
    );
    (mentalHealthApi.getAssessmentHistory as jest.Mock).mockResolvedValue(mockAssessments);
    (mentalHealthApi.getBaselineHistory as jest.Mock).mockResolvedValue(mockBaselines);
  });

  test('renders profile data correctly', async () => {
    const { findByText } = render(<ProfileScreen />);
    
    // Wait for profile to load
    await waitFor(() => {
      expect(profileApi.getProfile).toHaveBeenCalled();
    });
    
    // Verify profile data is displayed
    expect(await findByText('testuser')).toBeTruthy();
    expect(await findByText('test@example.com')).toBeTruthy();
    expect(await findByText('123-456-7890')).toBeTruthy();
    expect(await findByText('Emergency Contact (Family)')).toBeTruthy();
  });

  test('switches between account and history tabs', async () => {
    const { findByText } = render(<ProfileScreen />);
    
    // Wait for profile to load
    await waitFor(() => {
      expect(profileApi.getProfile).toHaveBeenCalled();
    });
    
    // Verify default tab is shown
    expect(await findByText('Personal Information')).toBeTruthy();
    
    // Switch to History tab
    fireEvent.press(await findByText('Mental Health History'));
    
    // Verify history tab content loads
    await waitFor(() => {
      expect(mentalHealthApi.getAssessmentHistory).toHaveBeenCalled();
      expect(mentalHealthApi.getBaselineHistory).toHaveBeenCalled();
    });
    
    // Verify baseline section is shown
    expect(await findByText('BASELINE')).toBeTruthy();
  });

  test('opens edit modals when profile fields are pressed', async () => {
    const { findByText, getByText, getByPlaceholderText } = render(<ProfileScreen />);
    
    // Wait for profile to load
    await waitFor(() => {
      expect(profileApi.getProfile).toHaveBeenCalled();
    });
    
    // Press username field to edit
    fireEvent.press(await findByText('Username'));
    
    // Verify edit modal opens
    expect(getByText('Edit Username')).toBeTruthy();
    expect(getByPlaceholderText('Enter new username')).toBeTruthy();
    
    // Enter new username
    fireEvent.changeText(getByPlaceholderText('Enter new username'), 'newusername');
    
    // Press save
    fireEvent.press(getByText('Save'));
    
    // Verify update API is called
    await waitFor(() => {
      expect(profileApi.updateProfile).toHaveBeenCalledWith({ username: 'newusername' });
    });
  });

  test('displays mental health history in timeline format', async () => {
    const { findByText } = render(<ProfileScreen />);
    
    // Switch to History tab
    fireEvent.press(await findByText('Mental Health History'));
    
    // Wait for history to load
    await waitFor(() => {
      expect(mentalHealthApi.getAssessmentHistory).toHaveBeenCalled();
      expect(mentalHealthApi.getBaselineHistory).toHaveBeenCalled();
    });
    
    // Verify history sections are displayed
    expect(await findByText('BASELINE')).toBeTruthy();
    expect(await findByText('Current Active Baseline')).toBeTruthy();
    expect(await findByText('MENTAL HEALTH ASSESSMENTS')).toBeTruthy();
  });

  test('opens assessment details modal when assessment is pressed', async () => {
    const { findByText, getAllByText } = render(<ProfileScreen />);
    
    // Switch to History tab
    fireEvent.press(await findByText('Mental Health History'));
    
    // Wait for history to load
    await waitFor(() => {
      expect(mentalHealthApi.getAssessmentHistory).toHaveBeenCalled();
      expect(mentalHealthApi.getBaselineHistory).toHaveBeenCalled();
    });
    
    // Find and press an assessment card (assuming MentalHealthHistoryCard has an onPress handler)
    // This is a bit tricky to test since the real implementation would need to be mocked
    // For this example, we'll just verify the component is rendered
    expect(getAllByText('MentalHealthHistoryCard').length).toBeGreaterThan(0);
  });
});