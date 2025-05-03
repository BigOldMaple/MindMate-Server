import * as SecureStore from 'expo-secure-store';
import { checkInApi, CheckInData } from '../checkInApi';
import { notificationService } from '../notificationService';
import * as apiConfig from '../apiConfig';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('../notificationService', () => ({
  notificationService: {
    sendLocalNotification: jest.fn(),
  },
}));
jest.mock('../apiConfig', () => ({
  getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api'),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Type definitions
type ActivityLevel = 'low' | 'moderate' | 'high';

describe('checkInApi', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Set up default SecureStore mock behavior
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'userToken') {
        return Promise.resolve('valid-test-token');
      }
      return Promise.resolve(null);
    });
  });

  // Test 1: Submit check-in successfully
  it('should submit check-in successfully', async () => {
    // Mock fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // Create valid check-in data
    const checkInData: CheckInData = {
      mood: {
        score: 4,
        label: 'Good',
        description: 'Feeling positive today'
      },
      activities: [
        { type: 'exercise', level: 'moderate' as ActivityLevel },
        { type: 'meditation', level: 'low' as ActivityLevel }
      ],
    };
    
    // Test the method
    await expect(checkInApi.submitCheckIn(checkInData)).resolves.not.toThrow();
    
    // Verify API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Verify auth token was requested from SecureStore
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userToken');
    
    // Verify notification was sent
    expect(notificationService.sendLocalNotification).toHaveBeenCalled();
  });

  // Test 2: Handle check-in submission error
  it('should handle check-in submission error', async () => {
    // Mock fetch response with error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid data' }),
    });
    
    const checkInData: CheckInData = {
      mood: {
        score: 6, // Invalid mood value (assuming valid range is 1-5)
        label: 'Invalid',
        description: 'This should fail'
      },
      activities: [
        { type: 'exercise', level: 'high' as ActivityLevel }
      ],
    };
    
    await expect(checkInApi.submitCheckIn(checkInData)).rejects.toThrow();
    
    // Verify API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Verify no notification was sent
    expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
  });

  // Test 3: Get recent check-ins
  it('should get recent check-ins', async () => {
    const mockCheckIns = [
      { 
        id: '1', 
        mood: {
          score: 4,
          label: 'Good',
          description: 'Feeling positive'
        }, 
        activities: [
          { type: 'exercise', level: 'moderate' as ActivityLevel }
        ], 
        createdAt: new Date().toISOString() 
      }
    ];
    
    // Mock fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCheckIns),
    });
    
    const result = await checkInApi.getRecentCheckIns();
    
    expect(result).toEqual(mockCheckIns);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userToken');
  });

  // Test 4: Get check-in stats
  it('should get check-in stats', async () => {
    const mockStats = {
      totalCheckIns: 42,
      averageMood: 3.8,
      topActivities: ['exercise', 'meditation', 'reading'],
    };
    
    // Mock fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });
    
    const result = await checkInApi.getCheckInStats();
    
    expect(result).toEqual(mockStats);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userToken');
  });

  // Test 5: Check if check-in is available (via cache)
  it('should check if check-in is available from cache', async () => {
    // Mock recent check-in in SecureStore
    const nextCheckInTime = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Update the SecureStore mock to return cached check-in data
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'lastCheckInTime') {
        return Promise.resolve(new Date().toISOString());
      } else if (key === 'nextCheckInTime') {
        return Promise.resolve(nextCheckInTime.toISOString());
      }
      return Promise.resolve(null);
    });
    
    const result = await checkInApi.getCheckInStatus();
    
    // Should return cannot check in because of cache
    expect(result).toEqual({
      canCheckIn: false,
      nextCheckInTime: expect.any(Date)
    });
    
    // Verify we didn't call the API since we used cache
    expect(global.fetch).not.toHaveBeenCalled();
    
    // IMPORTANT: Only verify the cache keys, NOT userToken
    // Your implementation doesn't access userToken when cache is valid
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('lastCheckInTime');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('nextCheckInTime');
    // Do NOT expect userToken to be accessed in this case
  });

  // Test 6: Check if check-in is available (via API)
  it('should check if check-in is available via API when cache is empty', async () => {
    // Only mock userToken (for authentication), but not cache keys
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'userToken') {
        return Promise.resolve('valid-test-token');
      }
      return Promise.resolve(null);
    });
    
    // Mock API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ canCheckIn: true }),
    });
    
    const result = await checkInApi.getCheckInStatus();
    
    expect(result).toEqual({ canCheckIn: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userToken');
  });

  // Test 7: Reset check-in timer
  it('should reset check-in timer', async () => {
    // Mock API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    
    await checkInApi.resetCheckInTimer();
    
    // Verify API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Verify SecureStore was updated
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lastCheckInTime');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nextCheckInTime');
  });

  // Test 8: Handle authentication errors
  it('should handle authentication errors', async () => {
    // Mock missing token
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
      if (key === 'userToken') {
        return Promise.resolve(null); // No token found
      }
      return Promise.resolve(null);
    });
    
    await expect(checkInApi.getRecentCheckIns()).rejects.toThrow('Authentication required');
    
    // Verify token was requested
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('userToken');
    
    // Verify API call was not made
    expect(global.fetch).not.toHaveBeenCalled();
  });
});