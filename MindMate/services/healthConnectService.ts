// services/healthConnectService.ts
import {
    initialize,
    getSdkStatus,
    SdkAvailabilityStatus,
    requestPermission,
    getGrantedPermissions,
    readRecords,
    insertRecords,
    aggregateRecord,
    openHealthConnectSettings,
  } from 'react-native-health-connect';
  
  // ========== Sleep Related Types ==========
  export enum SleepStageType {
    UNKNOWN = 0,
    AWAKE = 1,
    SLEEPING = 2,
    OUT_OF_BED = 3,
    LIGHT = 4,
    DEEP = 5,
    REM = 6,
  }
  
  export type SleepStage = {
    startTime: string;
    endTime: string;
    stage: SleepStageType;
  };
  
  // ========== Core Functions ==========
  
  // Initialize the Health Connect client
  export const initializeHealthConnect = async (): Promise<boolean> => {
    try {
      return await initialize();
    } catch (error) {
      console.error('Error initializing Health Connect:', error);
      return false;
    }
  };
  
  // Check if Health Connect is available on the device
  export const checkHealthConnectAvailability = async (): Promise<number> => {
    try {
      return await getSdkStatus();
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      return SdkAvailabilityStatus.SDK_UNAVAILABLE;
    }
  };
  
  // ========== Permission Functions ==========
  
  // Get currently granted permissions
  export const getHealthConnectPermissions = async () => {
    try {
      return await getGrantedPermissions();
    } catch (error) {
      console.error('Error getting Health Connect permissions:', error);
      return [];
    }
  };
  
  // Request permissions for steps and distance
  export const requestHealthConnectPermissions = async () => {
    try {
      return await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'write', recordType: 'Distance' },
      ]);
    } catch (error) {
      console.error('Error requesting Health Connect permissions:', error);
      throw error;
    }
  };
  
  // Request permissions for sleep data
  export const requestSleepPermissions = async () => {
    try {
      return await requestPermission([
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'write', recordType: 'SleepSession' },
      ]);
    } catch (error) {
      console.error('Error requesting sleep permissions:', error);
      throw error;
    }
  };
  
  // Request all health permissions (steps, distance, sleep)
  export const requestAllHealthPermissions = async () => {
    try {
      return await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'write', recordType: 'Distance' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'write', recordType: 'SleepSession' },
      ]);
    } catch (error) {
      console.error('Error requesting all health permissions:', error);
      throw error;
    }
  };
  
  // Check if specific permissions are granted
  export const hasStepPermission = async () => {
    try {
      const permissions = await getHealthConnectPermissions();
      return permissions.some(
        (p) => p.recordType === 'Steps' && p.accessType === 'read'
      );
    } catch (error) {
      console.error('Error checking step permission:', error);
      return false;
    }
  };
  
  export const hasDistancePermission = async () => {
    try {
      const permissions = await getHealthConnectPermissions();
      return permissions.some(
        (p) => p.recordType === 'Distance' && p.accessType === 'read'
      );
    } catch (error) {
      console.error('Error checking distance permission:', error);
      return false;
    }
  };
  
  export const hasSleepPermission = async () => {
    try {
      const permissions = await getHealthConnectPermissions();
      return permissions.some(
        (p) => p.recordType === 'SleepSession' && p.accessType === 'read'
      );
    } catch (error) {
      console.error('Error checking sleep permission:', error);
      return false;
    }
  };
  
  // ========== Steps & Distance Functions ==========
  
  // Read steps data for a specific time range
  export const readStepsData = async (startTime: string, endTime: string) => {
    try {
      const response = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      return response.records;
    } catch (error) {
      console.error('Error reading steps data:', error);
      return [];
    }
  };
  
  // Read distance data for a specific time range
  export const readDistanceData = async (startTime: string, endTime: string) => {
    try {
      const response = await readRecords('Distance', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      return response.records;
    } catch (error) {
      console.error('Error reading distance data:', error);
      return [];
    }
  };
  
  // Get aggregated steps data for a specific time range
  export const getAggregatedSteps = async (startTime: string, endTime: string) => {
    try {
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      return result;
    } catch (error) {
      console.error('Error getting aggregated steps:', error);
      return null;
    }
  };
  
  // Get aggregated distance data for a specific time range
  export const getAggregatedDistance = async (startTime: string, endTime: string) => {
    try {
      console.log('Requesting distance with timeRange:', { startTime, endTime });
      const result = await aggregateRecord({
        recordType: 'Distance',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      console.log('Distance aggregation result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Error getting aggregated distance:', error);
      return null;
    }
  };
  
  // Insert steps data
  export const insertStepsData = async (count: number, startTime: string, endTime: string) => {
    try {
      const recordIds = await insertRecords([
        {
          recordType: 'Steps',
          count,
          startTime,
          endTime,
        },
      ]);
      return recordIds;
    } catch (error) {
      console.error('Error inserting steps data:', error);
      return [];
    }
  };
  
  // Insert distance data
  export const insertDistanceData = async (
    distance: number,
    startTime: string,
    endTime: string
  ) => {
    try {
      const recordIds = await insertRecords([
        {
          recordType: 'Distance',
          distance: {
            value: distance,
            unit: 'meters',
          },
          startTime,
          endTime,
        },
      ]);
      return recordIds;
    } catch (error) {
      console.error('Error inserting distance data:', error);
      return [];
    }
  };
  
  // ========== Sleep Functions ==========
  
  // Read sleep sessions for a specific time range
  export const readSleepSessions = async (startTime: string, endTime: string) => {
    try {
      const response = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      console.log(`Found ${response.records.length} sleep sessions`);
      return response.records;
    } catch (error) {
      console.error('Error reading sleep sessions:', error);
      return [];
    }
  };
  
  // Insert a sleep session
  export const insertSleepSession = async (
    startTime: string,
    endTime: string,
    notes: string = '',
    stages: SleepStage[] = []
  ) => {
    try {
      const recordIds = await insertRecords([
        {
          recordType: 'SleepSession',
          startTime,
          endTime,
          notes,
          stages,
        },
      ]);
      return recordIds;
    } catch (error) {
      console.error('Error inserting sleep session:', error);
      return [];
    }
  };
  
  // Get sleep aggregate data (total time)
  export const getTotalSleepTime = async (startTime: string, endTime: string) => {
    try {
      const result = await aggregateRecord({
        recordType: 'SleepSession',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
      console.log('Sleep aggregation result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Error getting sleep aggregates:', error);
      return null;
    }
  };
  
  // ========== Utility Functions ==========
  
  // Open Health Connect settings
  export const openHealthSettings = () => {
    try {
      openHealthConnectSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
    }
  };
  
  // Helper function to format sleep duration in hours and minutes
  export const formatSleepDuration = (durationInMillis: number): string => {
    if (!durationInMillis) return '0h 0m';
    
    const totalMinutes = Math.floor(durationInMillis / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };
  
  // Helper to get sleep quality description based on duration and stages
  export const getSleepQualityDescription = (
    durationInMillis: number,
    deepSleepPercentage: number = 0
  ): { quality: 'poor' | 'fair' | 'good'; description: string } => {
    const hoursSlept = durationInMillis / 3600000;
    
    if (hoursSlept < 6) {
      return {
        quality: 'poor',
        description: 'Insufficient sleep duration. Most adults need 7-9 hours of sleep.'
      };
    } else if (hoursSlept > 10) {
      return {
        quality: 'fair',
        description: 'Excessive sleep duration. Consider checking for sleep quality issues.'
      };
    } else if (deepSleepPercentage < 15 && deepSleepPercentage > 0) {
      return {
        quality: 'fair',
        description: 'Lower than ideal deep sleep percentage. Deep sleep is important for recovery.'
      };
    } else if (hoursSlept >= 7 && hoursSlept <= 9) {
      return {
        quality: 'good',
        description: 'Optimal sleep duration. Consistent 7-9 hours supports mental health.'
      };
    } else {
      return {
        quality: 'fair',
        description: 'Acceptable sleep duration, but consistency is important for mental wellbeing.'
      };
    }
  };
  
  // Format distance to 2 decimal places and add unit
  export const formatDistance = (distanceData: any): string => {
    if (!distanceData) return '0 m';
    
    // The actual distance is nested inside the DISTANCE property
    const distance = distanceData.DISTANCE;
    if (!distance || !distance.inMeters) return '0 m';
    
    if (distance.inMeters >= 1000) {
      return `${(distance.inMeters / 1000).toFixed(2)} km`;
    } else {
      return `${Math.round(distance.inMeters)} m`;
    }
  };
  
  // Export SdkAvailabilityStatus for convenience
  export { SdkAvailabilityStatus } from 'react-native-health-connect';