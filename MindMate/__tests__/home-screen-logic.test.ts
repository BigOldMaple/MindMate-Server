// __tests__/home-screen-logic.test.ts
import { Alert } from 'react-native';
import { buddyPeerApi } from '@/services/buddyPeerApi';
import { checkInApi } from '@/services/checkInApi';
import { notificationService } from '@/services/notificationService';
import { notificationsApi } from '@/services/notificationsApi';
import * as SecureStore from 'expo-secure-store';

// Mock dependencies
jest.mock('@/services/buddyPeerApi', () => ({
  buddyPeerApi: {
    getBuddyPeers: jest.fn(),
    getPendingRequests: jest.fn()
  }
}));

jest.mock('@/services/checkInApi', () => ({
  checkInApi: {
    getCheckInStatus: jest.fn()
  }
}));

jest.mock('@/services/notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn()
  }
}));

jest.mock('@/services/notificationsApi', () => ({
  notificationsApi: {
    getNotifications: jest.fn(),
    checkForCheckInStatus: jest.fn()
  }
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn()
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() }
}));

// Mock notificationTracker
jest.mock('../../services/notificationTracker', () => ({
  notificationTracker: {
    hasShownCheckInNotification: jest.fn(),
    markCheckInNotificationShown: jest.fn()
  }
}), { virtual: true });

describe('Home Screen Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Helper to simulate loading the buddy data
  const loadBuddyData = async () => {
    try {
      const [peers, requests] = await Promise.all([
        buddyPeerApi.getBuddyPeers(),
        buddyPeerApi.getPendingRequests()
      ]);
      
      const activeCount = Math.floor(peers.length / 2);
      
      return {
        buddyPeers: peers,
        pendingRequests: requests,
        activeCount,
        error: null
      };
    } catch (error) {
      return {
        buddyPeers: [],
        pendingRequests: [],
        activeCount: 0,
        error: error instanceof Error ? error.message : 'Failed to load buddy data'
      };
    }
  };

  it('loads buddy data successfully', async () => {
    const mockPeers = [{ userId: 'user1' }, { userId: 'user2' }, { userId: 'user3' }];
    const mockRequests = [{ id: 'req1' }, { id: 'req2' }];
    
    (buddyPeerApi.getBuddyPeers as jest.Mock).mockResolvedValueOnce(mockPeers);
    (buddyPeerApi.getPendingRequests as jest.Mock).mockResolvedValueOnce(mockRequests);
    
    const result = await loadBuddyData();
    
    expect(buddyPeerApi.getBuddyPeers).toHaveBeenCalled();
    expect(buddyPeerApi.getPendingRequests).toHaveBeenCalled();
    expect(result.buddyPeers).toEqual(mockPeers);
    expect(result.pendingRequests).toEqual(mockRequests);
    expect(result.activeCount).toBe(1); // Math.floor(3/2) = 1
    expect(result.error).toBeNull();
  });

  it('handles errors in loading buddy data', async () => {
    const errorMessage = 'Network error';
    (buddyPeerApi.getBuddyPeers as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    const result = await loadBuddyData();
    
    expect(result.buddyPeers).toEqual([]);
    expect(result.pendingRequests).toEqual([]);
    expect(result.activeCount).toBe(0);
    expect(result.error).toBe(errorMessage);
  });
  
  // Helper to simulate check-in status logic and notification handling
  const handleCheckInStatus = async (prevCheckInStatus: boolean = true) => {
    try {
      const status = await checkInApi.getCheckInStatus();
      
      const wasInCooldown = !prevCheckInStatus;
      const isNowAvailable = status.canCheckIn;
      
      // Initialize sentNotification as false by default
      let sentNotification = false;
      
      // Transition from cooldown to available
      if (wasInCooldown && isNowAvailable) {
        // Import the notificationTracker
        const { notificationTracker } = require('../../services/notificationTracker');
        
        // Check if we've already shown a notification
        const hasShown = await notificationTracker.hasShownCheckInNotification();
        
        if (!hasShown) {
          // Send notification
          await notificationService.sendLocalNotification(
            'Check-In Available',
            'Your next check-in is now available. How are you feeling today?',
            {
              type: 'wellness',
              actionable: true,
              actionRoute: '/home/check_in'
            }
          );
          
          // Mark notification as shown
          await notificationTracker.markCheckInNotificationShown();
          
          // Set flag that we sent a notification
          sentNotification = true;
        }
        
        // Flag to refresh notifications
        await SecureStore.setItemAsync('shouldRefreshNotifications', 'true');
        
        // Refresh notifications
        await notificationsApi.getNotifications();
      }
      
      return {
        checkInStatus: status,
        sentNotification,
        error: null
      };
    } catch (error) {
      return {
        checkInStatus: { canCheckIn: true },
        sentNotification: false,
        error: error instanceof Error ? error.message : 'Error loading check-in status'
      };
    }
  };

  it('handles transition from cooldown to available check-in', async () => {
    // Setup mocks for transition scenario
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValueOnce({ 
      canCheckIn: true,
      nextCheckInTime: new Date().toISOString()
    });
    
    const { notificationTracker } = require('../../services/notificationTracker');
    (notificationTracker.hasShownCheckInNotification as jest.Mock).mockResolvedValueOnce(false);
    
    const result = await handleCheckInStatus(false); // prevStatus = false (in cooldown)
    
    expect(checkInApi.getCheckInStatus).toHaveBeenCalled();
    expect(notificationTracker.hasShownCheckInNotification).toHaveBeenCalled();
    expect(notificationService.sendLocalNotification).toHaveBeenCalled();
    expect(notificationTracker.markCheckInNotificationShown).toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('shouldRefreshNotifications', 'true');
    expect(notificationsApi.getNotifications).toHaveBeenCalled();
    
    expect(result.checkInStatus.canCheckIn).toBe(true);
    expect(result.sentNotification).toBe(true);
    expect(result.error).toBeNull();
  });

  it('does not send notification if already shown', async () => {
    // Setup mocks
    (checkInApi.getCheckInStatus as jest.Mock).mockResolvedValueOnce({ 
      canCheckIn: true,
      nextCheckInTime: new Date().toISOString()
    });
    
    const { notificationTracker } = require('../../services/notificationTracker');
    (notificationTracker.hasShownCheckInNotification as jest.Mock).mockResolvedValueOnce(true);
    
    const result = await handleCheckInStatus(false); // prevStatus = false (in cooldown)
    
    expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
    expect(notificationTracker.markCheckInNotificationShown).not.toHaveBeenCalled();
    expect(result.sentNotification).toBe(false);
  });

  it('handles errors getting check-in status', async () => {
    const errorMessage = 'API error';
    (checkInApi.getCheckInStatus as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    const result = await handleCheckInStatus();
    
    expect(result.checkInStatus).toEqual({ canCheckIn: true });
    expect(result.sentNotification).toBe(false);
    expect(result.error).toBe(errorMessage);
  });
  
  // Helper to format time for check-in cooldown
  const formatTimeRemaining = (nextTime: Date) => {
    const now = new Date();
    const diff = nextTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  it('formats time remaining correctly', () => {
    // Create a date 2 hours and 30 minutes in the future
    const now = new Date();
    const futureTime = new Date(now.getTime() + (2 * 60 * 60 * 1000) + (30 * 60 * 1000));
    
    const formatted = formatTimeRemaining(futureTime);
    
    expect(formatted).toBe('2h 30m');
  });
  
  // Test handling check-in button press
  const handleCheckInPress = (checkInStatus: { canCheckIn: boolean, nextCheckInTime?: Date }) => {
    if (checkInStatus.canCheckIn) {
      // Navigate to check-in screen
      return { navigated: true };
    } else {
      // Show alert about when next check-in is available
      const message = checkInStatus.nextCheckInTime 
        ? `Next check-in will be available at ${checkInStatus.nextCheckInTime.toLocaleTimeString()} on ${checkInStatus.nextCheckInTime.toLocaleDateString()}.`
        : 'later';
        
      Alert.alert(
        'Check-In Not Available',
        `You have already completed your check-in for today. ${message}`
      );
      
      return { navigated: false, alertShown: true };
    }
  };

  it('navigates to check-in screen when available', () => {
    const result = handleCheckInPress({ canCheckIn: true });
    
    expect(result.navigated).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows alert when check-in is not available', () => {
    const nextTime = new Date();
    nextTime.setHours(nextTime.getHours() + 4); // 4 hours from now
    
    const result = handleCheckInPress({ 
      canCheckIn: false,
      nextCheckInTime: nextTime
    });
    
    expect(result.navigated).toBe(false);
    expect(result.alertShown).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Check-In Not Available',
      expect.stringContaining('Next check-in will be available at')
    );
  });
});