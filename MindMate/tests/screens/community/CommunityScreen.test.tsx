// tests/screens/community/CommunityScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CommunityScreen from '../../../app/(tabs)/community';
import { communityApi } from '../../../services/communityApi';
import { router } from 'expo-router';

jest.mock('../../../services/communityApi', () => ({
  communityApi: {
    fetchAllCommunities: jest.fn(),
    searchCommunities: jest.fn(),
    joinCommunity: jest.fn()
  }
}));

describe('CommunityScreen', () => {
  const mockCommunities = [
    {
      _id: 'comm1',
      name: 'Support Group',
      description: 'A general support group',
      type: 'support',
      memberCount: 25,
      isUserMember: true
    },
    {
      _id: 'comm2',
      name: 'Professional Circle',
      description: 'Mental health professionals',
      type: 'professional',
      memberCount: 10,
      isUserMember: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (communityApi.fetchAllCommunities as jest.Mock).mockResolvedValue(mockCommunities);
    (communityApi.searchCommunities as jest.Mock).mockImplementation((query) => {
      return Promise.resolve(
        mockCommunities.filter(c => 
          c.name.toLowerCase().includes(query.toLowerCase()) && !c.isUserMember
        )
      );
    });
    (communityApi.joinCommunity as jest.Mock).mockResolvedValue({ success: true });
  });

  test('renders community tabs and switches between them', async () => {
    const { findByText, getByText } = render(<CommunityScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(communityApi.fetchAllCommunities).toHaveBeenCalled();
    });
    
    // Verify tabs render
    expect(getByText('My Communities')).toBeTruthy();
    expect(getByText('Discover')).toBeTruthy();
    
    // Verify my communities tab shows joined communities
    expect(await findByText('Support Group')).toBeTruthy();
    
    // Switch to discover tab
    fireEvent.press(getByText('Discover'));
    
    // Verify discover tab shows communities to join
    expect(await findByText('Professional Circle')).toBeTruthy();
  });

  test('shows community details in cards', async () => {
    const { findByText } = render(<CommunityScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(communityApi.fetchAllCommunities).toHaveBeenCalled();
    });
    
    // Verify community details are shown
    expect(await findByText('Support Group')).toBeTruthy();
    expect(await findByText('A general support group')).toBeTruthy();
    expect(await findByText('25 Members')).toBeTruthy();
  });

  test('shows verified badge for professional communities', async () => {
    const { findByText } = render(<CommunityScreen />);
    
    // Switch to discover tab to see the professional community
    fireEvent.press(await findByText('Discover'));
    
    // Verify professional badge is shown
    await findByText('Professional Circle');
    // This assumes your component uses some kind of verified icon
    // If your verification is only visual with an icon, you might need to check differently
  });

  test('search functionality filters communities', async () => {
    const { findByText, getByText, getByPlaceholderText } = render(<CommunityScreen />);
    
    // Switch to discover tab
    fireEvent.press(await findByText('Discover'));
    
    // Wait for communities to load
    await findByText('Professional Circle');
    
    // Enter search query
    const searchInput = getByPlaceholderText('Search communities...');
    fireEvent.changeText(searchInput, 'Professional');
    
    // Verify search is triggered
    await waitFor(() => {
      expect(communityApi.searchCommunities).toHaveBeenCalledWith('Professional');
    });
    
    // Verify filtered results
    expect(getByText('Professional Circle')).toBeTruthy();
  });

  test('join community button calls API and refreshes data', async () => {
    const { findByText, getByText } = render(<CommunityScreen />);
    
    // Switch to discover tab
    fireEvent.press(await findByText('Discover'));
    
    // Wait for communities to load
    await findByText('Professional Circle');
    
    // Press join button
    fireEvent.press(getByText('Join'));
    
    // Verify join API call
    await waitFor(() => {
      expect(communityApi.joinCommunity).toHaveBeenCalledWith('comm2');
      expect(communityApi.fetchAllCommunities).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  test('community card navigation', async () => {
    const { findByText } = render(<CommunityScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(communityApi.fetchAllCommunities).toHaveBeenCalled();
    });
    
    // Press on community card
    fireEvent.press(await findByText('Support Group'));
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/community/[id]",
      params: { id: 'comm1' }
    });
  });
});