// tests/screens/messages/MessagesScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../../../app/(tabs)/messages';
import { chatApi } from '../../../services/chatApi';
import { buddyPeerApi } from '../../../services/buddyPeerApi';
import { communityApi } from '../../../services/communityApi';
import { useAuth } from '../../../contexts/AuthContext';
import { router } from 'expo-router';

jest.mock('../../../services/chatApi', () => ({
  chatApi: {
    getConversations: jest.fn(),
    createConversation: jest.fn()
  }
}));

jest.mock('../../../services/buddyPeerApi', () => ({
  buddyPeerApi: {
    getBuddyPeers: jest.fn()
  }
}));

jest.mock('../../../services/communityApi', () => ({
  communityApi: {
    fetchAllCommunities: jest.fn(),
    getCommunityDetails: jest.fn()
  }
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

describe('MessagesScreen', () => {
  const mockUser = { id: 'current-user', username: 'currentuser' };
  const mockConversations = [
    {
      id: 'conv1',
      participant: {
        id: 'user1',
        name: 'Buddy User',
        username: 'buddyuser',
        isVerifiedProfessional: false
      },
      lastMessage: {
        content: 'Hey there!',
        timestamp: new Date().toISOString()
      },
      unreadCount: 2
    },
    {
      id: 'conv2',
      participant: {
        id: 'user2',
        name: 'Community User',
        username: 'communityuser',
        isVerifiedProfessional: false
      },
      lastMessage: {
        content: 'How are you doing?',
        timestamp: new Date().toISOString()
      },
      unreadCount: 0
    }
  ];
  
  const mockBuddyPeers = [
    { userId: 'user1', username: 'buddyuser', name: 'Buddy User' }
  ];
  
  const mockCommunities = [
    {
      _id: 'comm1',
      name: 'Test Community',
      isUserMember: true,
      members: [
        { userId: 'user2', user: { username: 'communityuser', profile: { name: 'Community User' } } }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (chatApi.getConversations as jest.Mock).mockResolvedValue(mockConversations);
    (buddyPeerApi.getBuddyPeers as jest.Mock).mockResolvedValue(mockBuddyPeers);
    (communityApi.fetchAllCommunities as jest.Mock).mockResolvedValue(mockCommunities);
    (communityApi.getCommunityDetails as jest.Mock).mockResolvedValue(mockCommunities[0]);
  });

  test('renders conversation categories and switches between them', async () => {
    const { findByText, getByText } = render(<MessagesScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(chatApi.getConversations).toHaveBeenCalled();
      expect(buddyPeerApi.getBuddyPeers).toHaveBeenCalled();
    });
    
    // Verify category tabs render
    expect(await findByText('Buddy Peers')).toBeTruthy();
    expect(getByText('Community')).toBeTruthy();
    expect(getByText('Global')).toBeTruthy();
    
    // Verify buddy conversations show under Buddy Peers
    expect(await findByText('Buddy User')).toBeTruthy();
    
    // Switch to Community tab
    fireEvent.press(getByText('Community'));
    
    // Verify community conversations show
    expect(await findByText('Community User')).toBeTruthy();
  });

  test('conversation details are displayed correctly', async () => {
    const { findByText } = render(<MessagesScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(chatApi.getConversations).toHaveBeenCalled();
    });
    
    // Verify conversation details
    expect(await findByText('Buddy User')).toBeTruthy();
    expect(await findByText('@buddyuser')).toBeTruthy();
    expect(await findByText('Hey there!')).toBeTruthy();
  });

  test('unread badges display correctly', async () => {
    const { findByText } = render(<MessagesScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(chatApi.getConversations).toHaveBeenCalled();
    });
    
    // Verify unread badge is shown for conversations with unread messages
    expect(await findByText('2')).toBeTruthy(); // Unread count for first conversation
  });

  test('navigates to conversation when pressed', async () => {
    const { findByText } = render(<MessagesScreen />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(chatApi.getConversations).toHaveBeenCalled();
    });
    
    // Press on a conversation
    fireEvent.press(await findByText('Buddy User'));
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'conv1' }
    });
  });

  test('new message button navigates to new message screen', async () => {
    const { findByText } = render(<MessagesScreen />);
    
    // Wait for screen to load
    await findByText('Buddy Peers');
    
    // Find and press new message button (this assumes you have some identifier for the button)
    const newMessageButton = await findByText('edit'); // Assuming the FontAwesome icon has a testID or accessible name
    fireEvent.press(newMessageButton);
    
    // Verify navigation
    expect(router.push).toHaveBeenCalledWith('/messages/new');
  });
});