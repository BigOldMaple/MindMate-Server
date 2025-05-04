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
    requestHealthConnectPermissions,
    requestSleepPermissions,
    requestExercisePermissions,
    hasStepPermission,
    hasDistancePermission,
    hasSleepPermission,
    hasExercisePermission,
    readDistanceData,
    getTotalExerciseStats,
    openHealthSettings,
    getSleepQualityDescription,
    formatDistance,
    getExerciseTypeName,
    formatExerciseDuration,
    getTimeRangeForLastWeek,
    getTimeRangeForLastMonth,
    getTimeRangeForLastYear,
    getTimeRangeForSpecificDay,
    formatDateRangeLabel,
    updateLastHealthSyncTime,
    ExerciseType,
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

    describe('Health Connect Service - Additional Tests', () => {
        // Reset mocks before each test
        beforeEach(() => {
            jest.clearAllMocks();
            (SecureStore as any)._reset();
        });

        describe('Permission-specific request functions', () => {
            it('requestHealthConnectPermissions requests steps and distance permissions', async () => {
                // Setup
                (requestPermission as jest.Mock).mockResolvedValue(true);

                // Act
                const result = await requestHealthConnectPermissions();

                // Assert
                expect(requestPermission).toHaveBeenCalledWith([
                    { accessType: 'read', recordType: 'Steps' },
                    { accessType: 'write', recordType: 'Steps' },
                    { accessType: 'read', recordType: 'Distance' },
                    { accessType: 'write', recordType: 'Distance' },
                ]);
                expect(result).toBe(true);
            });

            it('requestHealthConnectPermissions handles errors', async () => {
                // Setup
                (requestPermission as jest.Mock).mockRejectedValue(new Error('Permission request error'));

                // Act & Assert
                await expect(requestHealthConnectPermissions()).rejects.toThrow('Permission request error');
            });

            it('requestSleepPermissions requests sleep permissions', async () => {
                // Setup
                (requestPermission as jest.Mock).mockResolvedValue(true);

                // Act
                const result = await requestSleepPermissions();

                // Assert
                expect(requestPermission).toHaveBeenCalledWith([
                    { accessType: 'read', recordType: 'SleepSession' },
                    { accessType: 'write', recordType: 'SleepSession' },
                ]);
                expect(result).toBe(true);
            });

            it('requestSleepPermissions handles errors', async () => {
                // Setup
                (requestPermission as jest.Mock).mockRejectedValue(new Error('Sleep permission error'));

                // Act & Assert
                await expect(requestSleepPermissions()).rejects.toThrow('Sleep permission error');
            });

            it('requestExercisePermissions requests exercise permissions', async () => {
                // Setup
                (requestPermission as jest.Mock).mockResolvedValue(true);

                // Act
                const result = await requestExercisePermissions();

                // Assert
                expect(requestPermission).toHaveBeenCalledWith([
                    { accessType: 'read', recordType: 'ExerciseSession' },
                    { accessType: 'write', recordType: 'ExerciseSession' },
                ]);
                expect(result).toBe(true);
            });

            it('requestExercisePermissions handles errors', async () => {
                // Setup
                (requestPermission as jest.Mock).mockRejectedValue(new Error('Exercise permission error'));

                // Act & Assert
                await expect(requestExercisePermissions()).rejects.toThrow('Exercise permission error');
            });
        });

        describe('Permission check functions', () => {
            it('hasStepPermission returns true when permission is granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'Steps', accessType: 'read' }
                ]);

                // Act
                const result = await hasStepPermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('hasStepPermission returns false when permission is not granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'SleepSession', accessType: 'read' }
                ]);

                // Act
                const result = await hasStepPermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('hasStepPermission handles errors', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));

                // Act
                const result = await hasStepPermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('hasDistancePermission returns true when permission is granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'Distance', accessType: 'read' }
                ]);

                // Act
                const result = await hasDistancePermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('hasDistancePermission returns false when permission is not granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'SleepSession', accessType: 'read' }
                ]);

                // Act
                const result = await hasDistancePermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('hasDistancePermission handles errors', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));

                // Act
                const result = await hasDistancePermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('hasSleepPermission returns true when permission is granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'SleepSession', accessType: 'read' }
                ]);

                // Act
                const result = await hasSleepPermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('hasSleepPermission handles errors', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));

                // Act
                const result = await hasSleepPermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });

            it('hasExercisePermission returns true when permission is granted', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockResolvedValue([
                    { recordType: 'ExerciseSession', accessType: 'read' }
                ]);

                // Act
                const result = await hasExercisePermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(true);
            });

            it('hasExercisePermission handles errors', async () => {
                // Setup
                (getGrantedPermissions as jest.Mock).mockRejectedValue(new Error('Permission error'));

                // Act
                const result = await hasExercisePermission();

                // Assert
                expect(getGrantedPermissions).toHaveBeenCalled();
                expect(result).toBe(false);
            });
        });

        describe('readDistanceData', () => {
            it('reads distance data for a specific time range', async () => {
                // Setup
                const mockDistanceData = {
                    records: [
                        { startTime: '2023-01-01T00:00:00.000Z', endTime: '2023-01-01T23:59:59.999Z', distance: { inMeters: 5000 } }
                    ]
                };
                (readRecords as jest.Mock).mockResolvedValue(mockDistanceData);

                const startTime = '2023-01-01T00:00:00.000Z';
                const endTime = '2023-01-01T23:59:59.999Z';

                // Act
                const result = await readDistanceData(startTime, endTime);

                // Assert
                expect(readRecords).toHaveBeenCalledWith('Distance', {
                    timeRangeFilter: {
                        operator: 'between',
                        startTime,
                        endTime,
                    },
                });
                expect(result).toEqual(mockDistanceData.records);
            });

            it('handles error when reading distance data', async () => {
                // Setup
                (readRecords as jest.Mock).mockRejectedValue(new Error('Read error'));

                const startTime = '2023-01-01T00:00:00.000Z';
                const endTime = '2023-01-01T23:59:59.999Z';

                // Act
                const result = await readDistanceData(startTime, endTime);

                // Assert
                expect(readRecords).toHaveBeenCalled();
                expect(result).toEqual([]);
            });
        });

        describe('getTotalExerciseStats', () => {
            it('gets total exercise stats for a specific time range', async () => {
                // Setup
                const mockExerciseStats = {
                    EXERCISE_DURATION_TOTAL: 5400, // 1.5 hours in seconds
                    dataOrigins: ['com.google.android.apps.fitness']
                };
                (aggregateRecord as jest.Mock).mockResolvedValue(mockExerciseStats);

                const startTime = '2023-01-01T00:00:00.000Z';
                const endTime = '2023-01-01T23:59:59.999Z';

                // Act
                const result = await getTotalExerciseStats(startTime, endTime);

                // Assert
                expect(aggregateRecord).toHaveBeenCalledWith({
                    recordType: 'ExerciseSession',
                    timeRangeFilter: {
                        operator: 'between',
                        startTime,
                        endTime,
                    },
                });
                expect(result).toEqual(mockExerciseStats);
            });

            it('handles error when getting total exercise stats', async () => {
                // Setup
                (aggregateRecord as jest.Mock).mockRejectedValue(new Error('Aggregation error'));

                const startTime = '2023-01-01T00:00:00.000Z';
                const endTime = '2023-01-01T23:59:59.999Z';

                // Act
                const result = await getTotalExerciseStats(startTime, endTime);

                // Assert
                expect(aggregateRecord).toHaveBeenCalled();
                expect(result).toBeNull();
            });
        });

        describe('openHealthSettings', () => {
            it('calls openHealthConnectSettings from the SDK', () => {
                // Act
                openHealthSettings();

                // Assert
                expect(openHealthConnectSettings).toHaveBeenCalled();
            });

            it('handles errors when opening Health Connect settings', () => {
                // Setup
                (openHealthConnectSettings as jest.Mock).mockImplementation(() => {
                    throw new Error('Settings error');
                });

                // Spy on console.error
                const consoleSpy = jest.spyOn(console, 'error');

                // Act - should not throw
                openHealthSettings();

                // Assert
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error opening Health Connect settings:',
                    expect.any(Error)
                );
            });
        });

        describe('Utility functions', () => {
            describe('getSleepQualityDescription', () => {
                it('returns poor quality for less than 6 hours', () => {
                    // 5 hours in milliseconds
                    const durationMs = 5 * 60 * 60 * 1000;

                    // Act
                    const result = getSleepQualityDescription(durationMs);

                    // Assert
                    expect(result.quality).toBe('poor');
                    expect(result.description).toContain('Insufficient sleep');
                });

                it('returns good quality for 7-9 hours', () => {
                    // 8 hours in milliseconds
                    const durationMs = 8 * 60 * 60 * 1000;

                    // Act
                    const result = getSleepQualityDescription(durationMs);

                    // Assert
                    expect(result.quality).toBe('good');
                    expect(result.description).toContain('Optimal sleep');
                });

                it('returns fair quality for more than 10 hours', () => {
                    // 11 hours in milliseconds
                    const durationMs = 11 * 60 * 60 * 1000;

                    // Act
                    const result = getSleepQualityDescription(durationMs);

                    // Assert
                    expect(result.quality).toBe('fair');
                    expect(result.description).toContain('Excessive sleep');
                });

                it('returns fair quality for 6-7 or 9-10 hours', () => {
                    // 6.5 hours in milliseconds
                    const durationMs = 6.5 * 60 * 60 * 1000;

                    // Act
                    const result = getSleepQualityDescription(durationMs);

                    // Assert
                    expect(result.quality).toBe('fair');
                    expect(result.description).toContain('Acceptable sleep');
                });
            });

            describe('formatDistance', () => {
                it('formats distance in kilometers for values >= 1000m', () => {
                    // Setup
                    const distanceData = { DISTANCE: { inMeters: 1500, inKilometers: 1.5 } };

                    // Act
                    const result = formatDistance(distanceData);

                    // Assert
                    expect(result).toBe('1.50 km');
                });

                it('formats distance in meters for values < 1000m', () => {
                    // Setup
                    const distanceData = { DISTANCE: { inMeters: 750, inKilometers: 0.75 } };

                    // Act
                    const result = formatDistance(distanceData);

                    // Assert
                    expect(result).toBe('750 m');
                });

                it('returns 0 m for null or undefined values', () => {
                    // Act & Assert
                    expect(formatDistance(null)).toBe('0 m');
                    expect(formatDistance(undefined)).toBe('0 m');
                    expect(formatDistance({})).toBe('0 m');
                    expect(formatDistance({ DISTANCE: null })).toBe('0 m');
                    expect(formatDistance({ DISTANCE: {} })).toBe('0 m');
                });
            });

            describe('getExerciseTypeName', () => {
                it('returns correct name for known exercise types', () => {
                    // Act & Assert
                    expect(getExerciseTypeName(ExerciseType.RUNNING)).toBe('Running');
                    expect(getExerciseTypeName(ExerciseType.BIKING)).toBe('Biking');
                    expect(getExerciseTypeName(ExerciseType.WALKING)).toBe('Walking');
                    expect(getExerciseTypeName(ExerciseType.HIKING)).toBe('Hiking');
                    expect(getExerciseTypeName(ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING)).toBe('HIIT');
                });

                it('returns "Unknown" for undefined exercise types', () => {
                    // Act & Assert
                    expect(getExerciseTypeName(999)).toBe('Unknown');
                });
            });

            describe('formatExerciseDuration', () => {
                it('formats duration as minutes for duration < 1 hour', () => {
                    // 45 minutes in milliseconds
                    const durationMs = 45 * 60 * 1000;

                    // Act
                    const result = formatExerciseDuration(durationMs);

                    // Assert
                    expect(result).toBe('45m');
                });

                it('formats duration as hours and minutes for duration >= 1 hour', () => {
                    // 1 hour 30 minutes in milliseconds
                    const durationMs = 90 * 60 * 1000;

                    // Act
                    const result = formatExerciseDuration(durationMs);

                    // Assert
                    expect(result).toBe('1h 30m');
                });

                it('returns 0m for null, undefined, or zero values', () => {
                    // Act & Assert
                    expect(formatExerciseDuration(0)).toBe('0m');
                    expect(formatExerciseDuration(null as any)).toBe('0m');
                    expect(formatExerciseDuration(undefined as any)).toBe('0m');
                });
            });
        });

        describe('Time range functions', () => {
            // Define a fixed timestamp once for all tests
            const fixedTimestamp = new Date('2023-01-15T12:00:00.000Z').getTime();
            
            describe('getTimeRangeForLastWeek', () => {
              it('returns correct time range for the last 7 days', () => {
                // Act - pass the fixed timestamp directly
                const result = getTimeRangeForLastWeek(fixedTimestamp);
                
                // Assert
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                const expectedStartTime = new Date(fixedTimestamp - sevenDaysMs).toISOString();
                const expectedEndTime = new Date(fixedTimestamp).toISOString();
                
                expect(result).toEqual({
                  startTime: expectedStartTime,
                  endTime: expectedEndTime
                });
              });
            });
          
            describe('getTimeRangeForLastMonth', () => {
              it('returns correct time range for the last 30 days', () => {
                // Act - pass the fixed timestamp directly
                const result = getTimeRangeForLastMonth(fixedTimestamp);
                
                // Assert
                const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                const expectedStartTime = new Date(fixedTimestamp - thirtyDaysMs).toISOString();
                const expectedEndTime = new Date(fixedTimestamp).toISOString();
                
                expect(result).toEqual({
                  startTime: expectedStartTime,
                  endTime: expectedEndTime
                });
              });
            });
          
            describe('getTimeRangeForLastYear', () => {
              it('returns correct time range for the last 365 days', () => {
                // Act - pass the fixed timestamp directly
                const result = getTimeRangeForLastYear(fixedTimestamp);
                
                // Assert
                const yearDaysMs = 365 * 24 * 60 * 60 * 1000;
                const expectedStartTime = new Date(fixedTimestamp - yearDaysMs).toISOString();
                const expectedEndTime = new Date(fixedTimestamp).toISOString();
                
                expect(result).toEqual({
                  startTime: expectedStartTime,
                  endTime: expectedEndTime
                });
              });
            });

            describe('getTimeRangeForSpecificDay', () => {
                it('returns correct time range for a specific day', () => {
                    // Setup
                    const specificDate = new Date('2023-03-15T14:30:00.000Z'); // Some time on March 15, 2023

                    // Act
                    const result = getTimeRangeForSpecificDay(specificDate);

                    // Assert
                    const expectedStartTime = new Date('2023-03-15T00:00:00.000Z').toISOString();
                    const expectedEndTime = new Date('2023-03-15T23:59:59.999Z').toISOString();

                    expect(result).toEqual({
                        startTime: expectedStartTime,
                        endTime: expectedEndTime
                    });
                });
            });

            describe('formatDateRangeLabel', () => {
                it('formats "day" time range correctly', () => {
                    expect(formatDateRangeLabel('day')).toBe('Last 24 Hours');
                });

                it('formats "week" time range correctly', () => {
                    expect(formatDateRangeLabel('week')).toBe('Last 7 Days');
                });

                it('formats "month" time range correctly', () => {
                    expect(formatDateRangeLabel('month')).toBe('Last 30 Days');
                });

                it('formats "year" time range correctly', () => {
                    expect(formatDateRangeLabel('year')).toBe('Last 365 Days');
                });

                it('formats "specific" time range correctly with a date', () => {
                    const date = new Date('2023-03-15');
                    const result = formatDateRangeLabel('specific', date);

                    // This test may be locale-dependent, so we'll check for key parts
                    expect(result).toContain('Mar');
                    expect(result).toContain('15');
                    expect(result).toContain('2023');
                });

                it('formats "specific" time range correctly without a date', () => {
                    expect(formatDateRangeLabel('specific')).toBe('Specific Day');
                });

                it('defaults to "Last 7 Days" for invalid time ranges', () => {
                    expect(formatDateRangeLabel('invalid' as any)).toBe('Last 7 Days');
                });
            });
        });

        describe('updateLastHealthSyncTime', () => {
            it('saves the current time to SecureStore', async () => {
                // Act
                const result = await updateLastHealthSyncTime();

                // Assert
                expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                    'LAST_HEALTH_SYNC_TIME',
                    expect.any(String)
                );
                expect(result).toBe(true);
            });

            it('handles errors when saving to SecureStore', async () => {
                // Setup
                (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

                // Spy on console.error
                const consoleSpy = jest.spyOn(console, 'error');

                // Act
                const result = await updateLastHealthSyncTime();

                // Assert
                expect(SecureStore.setItemAsync).toHaveBeenCalled();
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Error updating last health sync time:',
                    expect.any(Error)
                );
                expect(result).toBe(false);
            });
        });
    });
});