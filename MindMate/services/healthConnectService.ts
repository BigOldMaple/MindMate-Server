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
  
  // Get currently granted permissions
  export const getHealthConnectPermissions = async () => {
    try {
      return await getGrantedPermissions();
    } catch (error) {
      console.error('Error getting Health Connect permissions:', error);
      return [];
    }
  };
  
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
      const result = await aggregateRecord({
        recordType: 'Distance',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
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
  
  // Open Health Connect settings
  export const openHealthSettings = () => {
    try {
      openHealthConnectSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
    }
  };
  
  // Export SdkAvailabilityStatus for convenience
  export { SdkAvailabilityStatus } from 'react-native-health-connect';