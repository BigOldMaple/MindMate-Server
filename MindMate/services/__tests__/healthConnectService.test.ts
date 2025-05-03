// services/__tests__/healthConnectService.test.ts

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  getSdkStatus: jest.fn(),
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 0,
    SDK_AVAILABLE: 1
  },
  requestPermission: jest.fn(),
  getGrantedPermissions: jest.fn(),
  readRecords: jest.fn(),
  insertRecords: jest.fn(),
  aggregateRecord: jest.fn(),
  openHealthConnectSettings: jest.fn(),
}));

jest.mock('../auth', () => ({
  auth: {
    getToken: jest.fn().mockResolvedValue('test-token'),
    getAuthInfo: jest.fn().mockResolvedValue({ token: 'test-token' })
  }
}));

jest.mock('../apiConfig', () => ({
  getApiConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://test-api.com/api',
    wsUrl: 'ws://test-api.com/ws'
  }),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android'
  }
}));

// Import the module under test and its dependencies
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  aggregateRecord,
  openHealthConnectSettings,
} from 'react-native-health-connect';

import {
  initializeHealthConnect,
  checkHealthConnectAvailability,
  getHealthConnectPermissions,
  requestAllHealthPermissions,
  syncHistoricalHealthData,
  readStepsData,
  readSleepSessions,
  readExerciseSessions,
  getAggregatedSteps,
  getAggregatedDistance,
  getTotalSleepTime,
  formatSleepDuration,
  getTimeRangeForLastDay,
  getLastHealthSyncTime,
} from '../healthConnectService';

describe('Health Connect Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as any)._reset();
  });

  describe('initializeHealthConnect', () => {
    it('initializes Health Connect successfully', async () => {
      // Setup - mock a successful initialization
      (initialize as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await initializeHealthConnect();

      // Assert
      expect(initialize).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('handles initialization failure', async () => {
      // Setup - mock a failed initialization
      (initialize as jest.Mock).mockRejectedValue(new Error('Initialization failed'));

      // Act
      const result = await initializeHealthConnect();

      // Assert
      expect(initialize).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('checkHealthConnectAvailability', () => {
    it('returns SDK status when available', async () => {
      // Setup
      (getSdkStatus as jest.Mock).mockResolvedValue(SdkAvailabilityStatus.SDK_AVAILABLE);

      // Act
      const result = await checkHealthConnectAvailability();

      // Assert
      expect(getSdkStatus).toHaveBeenCalled();
      expect(result).toBe(SdkAvailabilityStatus.SDK_AVAILABLE);
    });

    it('handles error when checking availability', async () => {
      // Setup
      (getSdkStatus as jest.Mock).mockRejectedValue(new Error('SDK error'));

      // Act
      const result = await checkHealthConnectAvailability();

      // Assert
      expect(getSdkStatus).toHaveBeenCalled();
      expect(result).toBe(SdkAvailabilityStatus.SDK_UNAVAILABLE);
    });
  });

  describe('getHealthConnectPermissions', () => {
    it('returns granted permissions', async () => {
      // Setup
      const mockPermissions = [
        { recordType: 'Steps', accessType: 'read' },
        { recordType: 'SleepSession', accessType: 'read' }
      ];
      (getGrantedPermissions as jest.Mock).mockResolvedValue(mockPermissions);

      // Act
      const result = await getHealthConnectPermissions();

      // Assert
      expect(getGrantedPermissions).toHaveBeenCalled();
      expect(result).toEqual(mockPermissions);
    });

    it('handles error when getting permissions', async () => {
      // Setup
      (getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));

      // Act
      const result = await getHealthConnectPermissions();

      // Assert
      expect(getGrantedPermissions).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('requestAllHealthPermissions', () => {
    it('requests all health permissions successfully', async () => {
      // Setup
      (requestPermission as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await requestAllHealthPermissions();

      // Assert
      expect(requestPermission).toHaveBeenCalledWith([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'write', recordType: 'Distance' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'write', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'ExerciseSession' },
      ]);
      expect(result).toBe(true);
    });

    it('handles error when requesting permissions', async () => {
      // Setup
      (requestPermission as jest.Mock).mockRejectedValue(new Error('Permission request error'));

      // Act & Assert
      await expect(requestAllHealthPermissions()).rejects.toThrow('Permission request error');
    });
  });

  describe('readStepsData', () => {
    it('reads steps data for a specific time range', async () => {
      // Setup
      const mockStepsData = {
        records: [
          { startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T23:59:59.999Z', count: 10000 }
        ]
      };
      (readRecords as jest.Mock).mockResolvedValue(mockStepsData);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await readStepsData(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalledWith('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockStepsData.records);
    });

    it('handles error when reading steps data', async () => {
      // Setup
      (readRecords as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await readStepsData(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('readSleepSessions', () => {
    it('reads sleep sessions for a specific time range', async () => {
      // Setup
      const mockSleepData = {
        records: [
          { startTime: '2023-01-01T22:00:00.000Z', endTime: '2023-01-02T06:00:00.000Z' }
        ]
      };
      (readRecords as jest.Mock).mockResolvedValue(mockSleepData);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-02T23:59:59.999Z';

      // Act
      const result = await readSleepSessions(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalledWith('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockSleepData.records);
    });

    it('handles error when reading sleep sessions', async () => {
      // Setup
      (readRecords as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-02T23:59:59.999Z';

      // Act
      const result = await readSleepSessions(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('readExerciseSessions', () => {
    it('reads exercise sessions for a specific time range', async () => {
      // Setup
      const mockExerciseData = {
        records: [
          { 
            exerciseType: 1, // BIKING
            startTime: '2023-01-01T10:00:00.000Z', 
            endTime: '2023-01-01T11:00:00.000Z',
            energy: { inKilocalories: 250 },
            distance: { inMeters: 10000 }
          }
        ]
      };
      (readRecords as jest.Mock).mockResolvedValue(mockExerciseData);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await readExerciseSessions(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalledWith('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockExerciseData.records);
    });

    it('handles error when reading exercise sessions', async () => {
      // Setup
      (readRecords as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await readExerciseSessions(startTime, endTime);

      // Assert
      expect(readRecords).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getAggregatedSteps', () => {
    it('gets aggregated steps data for a specific time range', async () => {
      // Setup
      const mockAggregatedSteps = {
        COUNT_TOTAL: 10000,
        dataOrigins: ['com.google.android.gms', 'com.xiaomi.hm.health']
      };
      (aggregateRecord as jest.Mock).mockResolvedValue(mockAggregatedSteps);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await getAggregatedSteps(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalledWith({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockAggregatedSteps);
    });

    it('handles error when getting aggregated steps', async () => {
      // Setup
      (aggregateRecord as jest.Mock).mockRejectedValue(new Error('Aggregation error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await getAggregatedSteps(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getAggregatedDistance', () => {
    it('gets aggregated distance data for a specific time range', async () => {
      // Setup
      const mockAggregatedDistance = {
        DISTANCE: {
          inMeters: 5000,
          inKilometers: 5
        },
        dataOrigins: ['com.google.android.gms']
      };
      (aggregateRecord as jest.Mock).mockResolvedValue(mockAggregatedDistance);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await getAggregatedDistance(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalledWith({
        recordType: 'Distance',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockAggregatedDistance);
    });

    it('handles error when getting aggregated distance', async () => {
      // Setup
      (aggregateRecord as jest.Mock).mockRejectedValue(new Error('Aggregation error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-01T23:59:59.999Z';

      // Act
      const result = await getAggregatedDistance(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getTotalSleepTime', () => {
    it('gets total sleep time for a specific time range', async () => {
      // Setup
      const mockSleepTime = {
        SLEEP_DURATION_TOTAL: 28800, // 8 hours in seconds
        dataOrigins: ['com.samsung.health']
      };
      (aggregateRecord as jest.Mock).mockResolvedValue(mockSleepTime);
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-02T23:59:59.999Z';

      // Act
      const result = await getTotalSleepTime(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalledWith({
        recordType: 'SleepSession',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      expect(result).toEqual(mockSleepTime);
    });

    it('handles error when getting total sleep time', async () => {
      // Setup
      (aggregateRecord as jest.Mock).mockRejectedValue(new Error('Aggregation error'));
      
      const startTime = '2023-01-01T00:00:00.000Z';
      const endTime = '2023-01-02T23:59:59.999Z';

      // Act
      const result = await getTotalSleepTime(startTime, endTime);

      // Assert
      expect(aggregateRecord).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('syncHistoricalHealthData', () => {
    beforeEach(() => {
      // Setup common mocks
      (initialize as jest.Mock).mockResolvedValue(true);
      (getGrantedPermissions as jest.Mock).mockResolvedValue([
        { recordType: 'Steps', accessType: 'read' },
        { recordType: 'SleepSession', accessType: 'read' },
        { recordType: 'ExerciseSession', accessType: 'read' }
      ]);

      // Mock global fetch
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Data synced successfully' })
        })
      );
    });

    it('successfully syncs historical health data', async () => {
      // Setup
      const mockStepsRecords = {
        records: [
          { startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T23:59:59.999Z' }
        ]
      };
      const mockSleepRecords = {
        records: [
          { startTime: '2023-01-01T22:00:00.000Z', endTime: '2023-01-02T06:00:00.000Z' }
        ]
      };
      const mockExerciseRecords = {
        records: [
          { 
            exerciseType: 2, // RUNNING
            startTime: '2023-01-01T18:00:00.000Z', 
            endTime: '2023-01-01T19:00:00.000Z' 
          }
        ]
      };
      
      // Mock step data
      (readRecords as jest.Mock).mockImplementation((recordType) => {
        if (recordType === 'Steps') return Promise.resolve(mockStepsRecords);
        if (recordType === 'Distance') return Promise.resolve({ records: [] });
        if (recordType === 'SleepSession') return Promise.resolve(mockSleepRecords);
        if (recordType === 'ExerciseSession') return Promise.resolve(mockExerciseRecords);
        return Promise.resolve({ records: [] });
      });

      (aggregateRecord as jest.Mock).mockImplementation((params) => {
        if (params.recordType === 'Steps') {
          return Promise.resolve({ COUNT_TOTAL: 8000 });
        }
        if (params.recordType === 'Distance') {
          return Promise.resolve({ DISTANCE: { inMeters: 3500, inKilometers: 3.5 } });
        }
        if (params.recordType === 'SleepSession') {
          return Promise.resolve({ SLEEP_DURATION_TOTAL: 28800 });
        }
        return Promise.resolve({});
      });

      // Act
      const result = await syncHistoricalHealthData();

      // Assert
      expect(initialize).toHaveBeenCalled();
      expect(getGrantedPermissions).toHaveBeenCalled();
      expect(readRecords).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'LAST_HEALTH_SYNC_TIME',
        expect.any(String)
      );
    });

    it('handles case with no permissions granted', async () => {
      // Setup
      (getGrantedPermissions as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await syncHistoricalHealthData();

      // Assert
      expect(initialize).toHaveBeenCalled();
      expect(getGrantedPermissions).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toContain('No health permissions granted');
    });

    it('handles server sync error', async () => {
      // Setup
      const mockRecords = { records: [{ startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T23:59:59.999Z' }] };
      (readRecords as jest.Mock).mockResolvedValue(mockRecords);
      (aggregateRecord as jest.Mock).mockResolvedValue({ COUNT_TOTAL: 8000 });
      
      // Mock fetch failure
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Server error' })
        })
      );

      // Act
      const result = await syncHistoricalHealthData();

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Sync failed');
    });
  });

  describe('utility functions', () => {
    it('formatSleepDuration formats duration correctly', () => {
      // 2 hours 30 minutes in milliseconds
      const durationMs = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      
      // Act
      const result = formatSleepDuration(durationMs);
      
      // Assert
      expect(result).toBe('2h 30m');
    });

    it('getTimeRangeForLastDay returns correct time range', () => {
        // Setup - mock Date.now with a fixed timestamp
        const mockTimestamp = new Date('2023-01-15T12:00:00.000Z').getTime();
        const originalNow = Date.now;
        Date.now = jest.fn(() => mockTimestamp);
        
        try {
          // Act
          const result = getTimeRangeForLastDay();
          
          // Assert
          const oneDayMs = 24 * 60 * 60 * 1000;
          const expectedStartTime = new Date(mockTimestamp - oneDayMs).toISOString();
          const expectedEndTime = new Date(mockTimestamp).toISOString();
          
          expect(result).toEqual({
            startTime: expectedStartTime,
            endTime: expectedEndTime
          });
        } finally {
          // Restore original Date.now
          Date.now = originalNow;
        }
      });
      
    it('getLastHealthSyncTime returns stored time', async () => {
      // Setup
      const mockTime = '2023-01-15T10:00:00.000Z';
      await SecureStore.setItemAsync('LAST_HEALTH_SYNC_TIME', mockTime);
      
      // Act
      const result = await getLastHealthSyncTime();
      
      // Assert
      expect(result).toEqual(new Date(mockTime));
    });

    it('getLastHealthSyncTime returns null when no time stored', async () => {
      // Act
      const result = await getLastHealthSyncTime();
      
      // Assert
      expect(result).toBeNull();
    });
  });
});