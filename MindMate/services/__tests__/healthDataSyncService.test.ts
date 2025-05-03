// services/__tests__/healthDataSyncService.test.ts

// First, set up our mocks before importing modules
jest.mock('expo-task-manager', () => ({
    defineTask: jest.fn(),
    isTaskRegisteredAsync: jest.fn(),
  }));
  
  jest.mock('expo-background-fetch', () => ({
    registerTaskAsync: jest.fn(),
    unregisterTaskAsync: jest.fn(),
    BackgroundFetchResult: {
      NewData: 'newData',
      NoData: 'noData',
      Failed: 'failed',
    },
  }));
  
  // Mock Platform with a getter to allow changing OS during tests
  const mockPlatform = {
    OS: 'android',
  };
  jest.mock('react-native', () => ({
    get Platform() {
      return mockPlatform;
    }
  }));
  
  // Mock health connect services
  jest.mock('../healthConnectService', () => ({
    initializeHealthConnect: jest.fn().mockResolvedValue(true),
    checkHealthConnectAvailability: jest.fn(),
    SdkAvailabilityStatus: {
      SDK_AVAILABLE: 1,
      SDK_UNAVAILABLE: 0,
    },
    getAggregatedSteps: jest.fn(),
    getAggregatedDistance: jest.fn(),
    getTotalSleepTime: jest.fn(),
    getTotalExerciseStats: jest.fn(),
    readSleepSessions: jest.fn(),
    readExerciseSessions: jest.fn(),
  }));
  
  // Fix: Mock auth directly to match how it's imported in the implementation
  jest.mock('../auth', () => ({
    auth: {
      getAuthInfo: jest.fn().mockResolvedValue({ token: 'test-token' }),
      getToken: jest.fn().mockResolvedValue('test-token'),
    }
  }));
  
  // Mock API config
  jest.mock('../apiConfig', () => ({
    getApiConfig: jest.fn().mockReturnValue({
      baseUrl: 'http://test-api.com/api',
    }),
  }));
  
  import * as TaskManager from 'expo-task-manager';
  import * as BackgroundFetch from 'expo-background-fetch';
  import { Platform } from 'react-native';
  import * as SecureStore from 'expo-secure-store';
  import { 
    registerHealthDataSync, 
    unregisterHealthDataSync, 
    syncHealthData,
    getLastHealthSyncTime,
    checkServerLastSyncTime 
  } from '../healthDataSyncService';
  import { 
    initializeHealthConnect, 
    checkHealthConnectAvailability,
    SdkAvailabilityStatus,
    getAggregatedSteps,
    getAggregatedDistance,
    getTotalSleepTime,
    getTotalExerciseStats,
    readSleepSessions,
    readExerciseSessions
  } from '../healthConnectService';
  import { auth } from '../auth';
  import { getApiConfig } from '../apiConfig';
  
  // Properly mock global.fetch
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: 'Success' })
    })
  );
  
  // Increase timeout for tests with async operations
  jest.setTimeout(10000);
  
  describe('Health Data Sync Service', () => {
    // Mock console methods to prevent warnings about logging after tests
    let originalConsoleLog: any;
    let originalConsoleError: any;
    
    beforeAll(() => {
      // Save original console methods
      originalConsoleLog = console.log;
      originalConsoleError = console.error;
      
      // Mock console methods
      console.log = jest.fn();
      console.error = jest.fn();
    });
    
    afterAll(() => {
      // Restore original console methods
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      
      // Restore the original fetch
      global.fetch = originalFetch;
      
      // Clear all mocks and timers
      jest.clearAllMocks();
      jest.clearAllTimers();
    });
  
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
      
      // Reset Platform mock to default value
      mockPlatform.OS = 'android';
      
      // Reset fetch mock with default successful response
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Health data synced successfully' })
        })
      );
      
      // Reset console mocks
      (console.log as jest.Mock).mockClear();
      (console.error as jest.Mock).mockClear();
    });
  
    afterEach(async () => {
      // Force resolution of any pending promises
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Ensure all pending timers are cleared
      jest.clearAllTimers();
    });
  
    describe('registerHealthDataSync', () => {
      it('registers background task when not already registered', async () => {
        // Arrange
        (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
        (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValue(undefined);
        
        // Act
        const result = await registerHealthDataSync();
        
        // Assert
        expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith('HEALTH_DATA_SYNC_TASK');
        expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith('HEALTH_DATA_SYNC_TASK', expect.any(Object));
        expect(result).toBe(true);
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('does not register task when already registered', async () => {
        // Arrange
        (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
        
        // Act
        const result = await registerHealthDataSync();
        
        // Assert
        expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith('HEALTH_DATA_SYNC_TASK');
        expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
        expect(result).toBe(true);
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('handles registration errors', async () => {
        // Arrange
        (TaskManager.isTaskRegisteredAsync as jest.Mock).mockRejectedValue(new Error('Registration error'));
        
        // Act
        const result = await registerHealthDataSync();
        
        // Assert
        expect(result).toBe(false);
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
  
    describe('unregisterHealthDataSync', () => {
      it('unregisters background task successfully', async () => {
        // Arrange
        (BackgroundFetch.unregisterTaskAsync as jest.Mock).mockResolvedValue(undefined);
        
        // Act
        const result = await unregisterHealthDataSync();
        
        // Assert
        expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith('HEALTH_DATA_SYNC_TASK');
        expect(result).toBe(true);
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('handles unregistration errors', async () => {
        // Arrange
        (BackgroundFetch.unregisterTaskAsync as jest.Mock).mockRejectedValue(new Error('Unregistration error'));
        
        // Act
        const result = await unregisterHealthDataSync();
        
        // Assert
        expect(result).toBe(false);
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
  
    describe('syncHealthData', () => {
      it('skips sync on non-Android platforms', async () => {
        // Arrange
        mockPlatform.OS = 'ios';
        
        // Act
        const result = await syncHealthData();
        
        // Assert
        expect(result).toEqual({ 
          success: false, 
          message: 'Health Connect is only available on Android' 
        });
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('syncs health data successfully', async () => {
        // Arrange - ensure we bypass all checks to reach the API call
        mockPlatform.OS = 'android';
        
        // Make sure checkHealthConnectAvailability returns SDK_AVAILABLE
        (checkHealthConnectAvailability as jest.Mock).mockResolvedValue(SdkAvailabilityStatus.SDK_AVAILABLE);
        
        // Make sure initializeHealthConnect returns true
        (initializeHealthConnect as jest.Mock).mockResolvedValue(true);
        
        // Mock health data responses with non-null values
        (getAggregatedSteps as jest.Mock).mockResolvedValue({ COUNT_TOTAL: 10000 });
        (getAggregatedDistance as jest.Mock).mockResolvedValue({ DISTANCE: { inMeters: 5000, inKilometers: 5 } });
        (getTotalSleepTime as jest.Mock).mockResolvedValue({ SLEEP_DURATION_TOTAL: 28800 }); // 8 hours
        (getTotalExerciseStats as jest.Mock).mockResolvedValue({ EXERCISE_DURATION_TOTAL: { inSeconds: 3600 } }); // 1 hour
        (readSleepSessions as jest.Mock).mockResolvedValue([
          { startTime: '2025-04-01T22:00:00.000Z', endTime: '2025-04-02T06:00:00.000Z' }
        ]);
        (readExerciseSessions as jest.Mock).mockResolvedValue([
          { 
            exerciseType: 1, 
            startTime: '2025-04-02T18:00:00.000Z', 
            endTime: '2025-04-02T19:00:00.000Z',
            energy: { inCalories: 500 },
            distance: { inMeters: 5000 }
          }
        ]);
        
        // Make sure fetch returns a successful response
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ message: 'Health data synced successfully' })
          })
        );
        
        // Act - force sync to bypass time-based checks
        const result = await syncHealthData(true);
        
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/health-data/sync',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            })
          })
        );
        expect(result).toEqual({ 
          success: true, 
          message: 'Health data synced successfully' 
        });
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('handles sync errors properly', async () => {
        // Arrange
        mockPlatform.OS = 'android';
        (checkHealthConnectAvailability as jest.Mock).mockResolvedValue(SdkAvailabilityStatus.SDK_AVAILABLE);
        (initializeHealthConnect as jest.Mock).mockResolvedValue(true);
        
        // Mock health data to ensure API call is made
        (getAggregatedSteps as jest.Mock).mockResolvedValue({ COUNT_TOTAL: 10000 });
        (getAggregatedDistance as jest.Mock).mockResolvedValue({ DISTANCE: { inMeters: 5000 } });
        (getTotalSleepTime as jest.Mock).mockResolvedValue({ SLEEP_DURATION_TOTAL: 28800 });
        (getTotalExerciseStats as jest.Mock).mockResolvedValue({ EXERCISE_DURATION_TOTAL: { inSeconds: 3600 } });
        (readSleepSessions as jest.Mock).mockResolvedValue([
          { startTime: '2025-04-01T22:00:00.000Z', endTime: '2025-04-02T06:00:00.000Z' }
        ]);
        (readExerciseSessions as jest.Mock).mockResolvedValue([
          { exerciseType: 1, startTime: '2025-04-02T18:00:00.000Z', endTime: '2025-04-02T19:00:00.000Z' }
        ]);
        
        // Mock fetch error
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: false,
            statusText: 'Server Error',
            json: () => Promise.resolve({ error: 'Server unavailable' })
          })
        );
        
        // Act
        const result = await syncHealthData(true); // Force sync
        
        // Assert
        expect(global.fetch).toHaveBeenCalled();
        expect(result).toEqual({ 
          success: false, 
          message: expect.stringContaining('Sync failed:') 
        });
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('does not sync when conditions are not met', async () => {
        // Arrange - set last sync time to recent
        const now = new Date();
        await SecureStore.setItemAsync('last_health_data_sync', now.toISOString());
        
        // Act
        const result = await syncHealthData(); // Do not force sync
        
        // Assert
        expect(result).toEqual({ 
          success: false, 
          message: 'Sync not needed at this time' 
        });
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('handles when no new health data is available', async () => {
        // Arrange
        mockPlatform.OS = 'android';
        (checkHealthConnectAvailability as jest.Mock).mockResolvedValue(SdkAvailabilityStatus.SDK_AVAILABLE);
        (initializeHealthConnect as jest.Mock).mockResolvedValue(true);
        
        // Mock empty health data responses
        (getAggregatedSteps as jest.Mock).mockResolvedValue(null);
        (getAggregatedDistance as jest.Mock).mockResolvedValue(null);
        (getTotalSleepTime as jest.Mock).mockResolvedValue(null);
        (getTotalExerciseStats as jest.Mock).mockResolvedValue(null);
        (readSleepSessions as jest.Mock).mockResolvedValue([]);
        (readExerciseSessions as jest.Mock).mockResolvedValue([]);
        
        // Act
        const result = await syncHealthData(true); // Force sync
        
        // Assert
        expect(global.fetch).not.toHaveBeenCalled(); // No API call should be made
        expect(result).toEqual({ 
          success: false, 
          message: 'No new health data to sync' 
        });
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
  
    describe('getLastHealthSyncTime', () => {
      it('returns the last sync time when available', async () => {
        // Arrange
        const mockDate = new Date('2025-04-02T12:00:00.000Z');
        await SecureStore.setItemAsync('last_health_data_sync', mockDate.toISOString());
        
        // Act
        const result = await getLastHealthSyncTime();
        
        // Assert
        expect(result instanceof Date).toBe(true);
        expect(result?.toISOString()).toBe(mockDate.toISOString());
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('returns null when no sync time is stored', async () => {
        // Act
        const result = await getLastHealthSyncTime();
        
        // Assert
        expect(result).toBeNull();
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
  
    describe('checkServerLastSyncTime', () => {
      it('returns the server last sync time when available', async () => {
        // Arrange
        const mockDate = new Date('2025-04-02T12:00:00.000Z');
        
        // Mock fetch to return last sync time from server
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ lastSyncTime: mockDate.toISOString() })
          })
        );
        
        // Act
        const result = await checkServerLastSyncTime();
        
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/health-data/last-sync',
          expect.objectContaining({
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-token',
            },
          })
        );
        expect(result instanceof Date).toBe(true);
        expect(result?.toISOString()).toBe(mockDate.toISOString());
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('returns null when authentication fails', async () => {
        // Arrange - mock auth to return null
        (auth.getAuthInfo as jest.Mock).mockResolvedValueOnce(null);
        
        // Act
        const result = await checkServerLastSyncTime();
        
        // Assert
        expect(global.fetch).not.toHaveBeenCalled();
        expect(result).toBeNull();
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
  
      it('returns null when API call fails', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: false,
            statusText: 'Server Error'
          })
        );
        
        // Act
        const result = await checkServerLastSyncTime();
        
        // Assert
        expect(global.fetch).toHaveBeenCalled();
        expect(result).toBeNull();
        
        // Force resolution of any pending promises
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
  });