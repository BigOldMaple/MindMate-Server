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
import * as SecureStore from 'expo-secure-store';
import { auth } from './auth';
import { getApiConfig } from './apiConfig';

// Define interfaces for type safety
interface Exercise {
  type: string;
  startTime: Date;
  endTime: Date;
  durationInSeconds: number;
  calories?: number;
  distance?: {
    inMeters?: number;
    inKilometers?: number;
  };
  dataSource?: string;
}

interface HealthDayData {
  date: Date;
  steps?: {
    count: number;
    startTime: Date;
    endTime: Date;
    dataSource?: string;
  };
  distance?: {
    inMeters: number;
    inKilometers: number;
    startTime: Date;
    endTime: Date;
    dataSource?: string;
  };
  sleep?: {
    startTime: Date;
    endTime: Date;
    durationInSeconds: number;
    quality?: string;
    dataSource?: string;
  };
  exercises: Exercise[];
  summary: {
    totalSteps: number;
    totalDistanceMeters: number;
    totalSleepSeconds: number;
    totalExerciseSeconds: number;
    exerciseCount: number;
  };
}

// Define Health Connect record types
type ExerciseSessionRecord = {
  exerciseType: number;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
  metadata?: {
    dataOrigin?: string;
  };
  // These properties may not exist on all exercise records
  energy?: {
    inCalories?: number;
    inKilocalories?: number;
  };
  distance?: {
    inMeters?: number;
    inKilometers?: number;
  };
};

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

// ========== Exercise Related Types ==========
export enum ExerciseType {
  UNKNOWN = 0,
  BIKING = 1,
  RUNNING = 2,
  WALKING = 3,
  HIKING = 4,
  SWIMMING = 5,
  WORKOUT = 6,
  OTHER = 7,
  CALISTHENICS = 8,
  DANCING = 9,
  ELLIPTICAL = 10,
  HIGH_INTENSITY_INTERVAL_TRAINING = 11,
  ROWING = 12,
  STAIR_CLIMBING = 13,
  WEIGHT_TRAINING = 14,
  YOGA = 15,
  // Add other exercise types as needed
}

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

/**
 * Helper function to get midnight date for a given date
 */
const getMidnightDate = (date: Date): Date => {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
};

/**
 * Helper function to calculate ISO week number
 */
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/**
 * Syncs all available historical health data from Health Connect
 * 
 * @returns {Promise<{success: boolean, message: string, days?: number}>}
 */
export const syncHistoricalHealthData = async (): Promise<{success: boolean, message: string, days?: number}> => {
  try {
    console.log('[HealthConnect] Starting historical health data sync');
    
    // Initialize Health Connect
    const initialized = await initializeHealthConnect();
    if (!initialized) {
      return { success: false, message: 'Failed to initialize Health Connect' };
    }
    
    // Check permissions
    const permissions = await getHealthConnectPermissions();
    const hasSteps = permissions.some(p => p.recordType === 'Steps' && p.accessType === 'read');
    const hasSleep = permissions.some(p => p.recordType === 'SleepSession' && p.accessType === 'read');
    const hasExercise = permissions.some(p => p.recordType === 'ExerciseSession' && p.accessType === 'read');
    
    if (!hasSteps && !hasSleep && !hasExercise) {
      console.log('[HealthConnect] No health permissions granted');
      return { 
        success: false, 
        message: 'No health permissions granted. Please grant permissions in app settings.' 
      };
    }
    
    // Set time range for retrieving all historical data
    // Go back 365 days by default
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startTime = oneYearAgo.toISOString();
    const endTime = new Date().toISOString();
    
    console.log(`[HealthConnect] Fetching historical data from ${startTime} to ${endTime}`);
    
    // Create a map to store day-centric health data
    // Key: YYYY-MM-DD, Value: HealthDayData
    const dailyHealthData: Record<string, HealthDayData> = {};
    
    // Track days with data for stats
    let daysWithData = 0;
    
    // Function to get or create a day record
    const getOrCreateDayRecord = (date: Date): HealthDayData => {
      const dateStr = date.toISOString().split('T')[0];
      
      if (!dailyHealthData[dateStr]) {
        const midnight = getMidnightDate(date);
        
        dailyHealthData[dateStr] = {
          date: midnight,
          exercises: [],
          summary: {
            totalSteps: 0,
            totalDistanceMeters: 0,
            totalSleepSeconds: 0,
            totalExerciseSeconds: 0,
            exerciseCount: 0
          }
        };
        
        daysWithData++;
      }
      
      return dailyHealthData[dateStr];
    };
    
    // Fetch and process steps data
    if (hasSteps) {
      try {
        console.log('[HealthConnect] Fetching steps data...');
        
        // Get raw step records
        const stepsRecords = await readStepsData(startTime, endTime);
        console.log(`[HealthConnect] Found ${stepsRecords.length} step records`);
        
        // Process each record and organize by day
        for (const record of stepsRecords) {
          // Use date (YYYY-MM-DD) as key
          const recordDate = new Date(record.startTime);
          const dayRecord = getOrCreateDayRecord(recordDate);
          
          // Get steps for this specific day
          const dayStart = getMidnightDate(recordDate);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const stepsData = await getAggregatedSteps(
            dayStart.toISOString(), 
            dayEnd.toISOString()
          );
          
          if (stepsData && stepsData.COUNT_TOTAL) {
            dayRecord.steps = {
              count: stepsData.COUNT_TOTAL,
              startTime: new Date(record.startTime),
              endTime: new Date(record.endTime),
              dataSource: stepsData.dataOrigins?.join(', ') || 'unknown'
            };
            
            dayRecord.summary.totalSteps = stepsData.COUNT_TOTAL;
          }
        }
      } catch (error) {
        console.error('[HealthConnect] Error fetching steps data:', error);
      }
      
      // Also get distance data
      try {
        console.log('[HealthConnect] Fetching distance data...');
        
        const distanceRecords = await readDistanceData(startTime, endTime);
        console.log(`[HealthConnect] Found ${distanceRecords.length} distance records`);
        
        for (const record of distanceRecords) {
          const recordDate = new Date(record.startTime);
          const dayRecord = getOrCreateDayRecord(recordDate);
          
          const dayStart = getMidnightDate(recordDate);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const distanceData = await getAggregatedDistance(
            dayStart.toISOString(), 
            dayEnd.toISOString()
          );
          
          if (distanceData && distanceData.DISTANCE?.inMeters) {
            dayRecord.distance = {
              inMeters: distanceData.DISTANCE.inMeters,
              inKilometers: distanceData.DISTANCE.inKilometers,
              startTime: new Date(record.startTime),
              endTime: new Date(record.endTime),
              dataSource: distanceData.dataOrigins?.join(', ') || 'unknown'
            };
            
            dayRecord.summary.totalDistanceMeters = distanceData.DISTANCE.inMeters;
          }
        }
      } catch (error) {
        console.error('[HealthConnect] Error fetching distance data:', error);
      }
    }
    
    // Fetch and process sleep data
    if (hasSleep) {
      try {
        console.log('[HealthConnect] Fetching sleep data...');
        
        const sleepSessions = await readSleepSessions(startTime, endTime);
        console.log(`[HealthConnect] Found ${sleepSessions.length} sleep sessions`);
        
        for (const session of sleepSessions) {
          // Sleep should be attributed to the day the person woke up (end date)
          const endDate = new Date(session.endTime);
          const dayRecord = getOrCreateDayRecord(endDate);
          
          // Calculate duration
          const startTime = new Date(session.startTime).getTime();
          const endTime = endDate.getTime();
          const durationInSeconds = Math.round((endTime - startTime) / 1000);
          
          // Determine sleep quality
          const durationHours = durationInSeconds / 3600;
          let quality = 'fair';
          
          if (durationHours < 6) {
            quality = 'poor';
          } else if (durationHours >= 7 && durationHours <= 9) {
            quality = 'good';
          }
          
          dayRecord.sleep = {
            startTime: new Date(session.startTime),
            endTime: endDate,
            durationInSeconds,
            quality,
            dataSource: session.metadata?.dataOrigin || 'unknown'
          };
          
          dayRecord.summary.totalSleepSeconds = durationInSeconds;
        }
      } catch (error) {
        console.error('[HealthConnect] Error fetching sleep data:', error);
      }
    }
    
    // Fetch and process exercise data
    if (hasExercise) {
      try {
        console.log('[HealthConnect] Fetching exercise data...');
        
        const exerciseSessions = await readExerciseSessions(startTime, endTime);
        console.log(`[HealthConnect] Found ${exerciseSessions.length} exercise sessions`);
        
        for (const session of exerciseSessions as unknown as ExerciseSessionRecord[]) {
          // Exercise is attributed to the day it started
          const startDate = new Date(session.startTime);
          const dayRecord = getOrCreateDayRecord(startDate);
          
          // Calculate duration
          const endDate = new Date(session.endTime);
          const durationInSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
          
          // Create exercise object
          const exercise: Exercise = {
            type: session.exerciseType.toString(),
            startTime: startDate,
            endTime: endDate,
            durationInSeconds,
            dataSource: session.metadata?.dataOrigin || 'unknown'
          };
          
          // Add calories if available
          if (session.energy && 
              (session.energy.inKilocalories || 
               session.energy.inCalories)) {
            exercise.calories = session.energy.inKilocalories || 
                               (session.energy.inCalories ? session.energy.inCalories / 1000 : undefined);
          }
          
          // Add distance if available
          if (session.distance) {
            exercise.distance = {
              inMeters: session.distance.inMeters,
              inKilometers: session.distance.inKilometers
            };
          }
          
          // Add exercise to array
          dayRecord.exercises.push(exercise);
          
          // Update exercise summary
          dayRecord.summary.exerciseCount = dayRecord.exercises.length;
          dayRecord.summary.totalExerciseSeconds = dayRecord.exercises.reduce(
            (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
          );
        }
      } catch (error) {
        console.error('[HealthConnect] Error fetching exercise data:', error);
      }
    }
    
    // Check if we found any data
    if (daysWithData === 0) {
      console.log('[HealthConnect] No health data found');
      return { 
        success: false, 
        message: 'No health data found in Health Connect. Try using fitness apps that integrate with Health Connect first.' 
      };
    }
    
    console.log(`[HealthConnect] Found health data for ${daysWithData} days`);
    
    // Send data to server
    const apiConfig = getApiConfig();
    const token = await auth.getToken();
    
    if (!token) {
      return { 
        success: false, 
        message: 'Not authenticated. Please log in first.' 
      };
    }
    
    // Send data to server using the updated sync-multiple endpoint
    console.log(`[HealthConnect] Sending data for ${daysWithData} days to server`);
    const response = await fetch(`${apiConfig.baseUrl}/health-data/sync-multiple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ days: dailyHealthData }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Server error: ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update last sync time
    await SecureStore.setItemAsync('LAST_HEALTH_SYNC_TIME', new Date().toISOString());
    
    console.log('[HealthConnect] Historical health data sync completed successfully');
    
    // Return success with stats
    return { 
      success: true, 
      message: result.message || `Successfully synced health data for ${daysWithData} days`, 
      days: daysWithData 
    };
  } catch (error) {
    console.error('[HealthConnect] Historical health data sync error:', error);
    return { 
      success: false, 
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
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

// Request permissions for exercise data
export const requestExercisePermissions = async () => {
  try {
    return await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]);
  } catch (error) {
    console.error('Error requesting exercise permissions:', error);
    throw error;
  }
};

// Request all health permissions
export const requestAllHealthPermissions = async () => {
  try {
    return await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'write', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'write', recordType: 'Distance' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'write', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'ExerciseSession' },
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

export const hasExercisePermission = async () => {
  try {
    const permissions = await getHealthConnectPermissions();
    return permissions.some(
      (p) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
    );
  } catch (error) {
    console.error('Error checking exercise permission:', error);
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

// ========== Exercise Functions ==========

// Read exercise sessions for a specific time range
export const readExerciseSessions = async (startTime: string, endTime: string) => {
  try {
    const response = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log(`Found ${response.records.length} exercise sessions`);
    return response.records;
  } catch (error) {
    console.error('Error reading exercise sessions:', error);
    return [];
  }
};

// Get aggregated exercise data
export const getTotalExerciseStats = async (startTime: string, endTime: string) => {
  try {
    const result = await aggregateRecord({
      recordType: 'ExerciseSession',
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log('Exercise aggregation result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error getting exercise aggregates:', error);
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

// Helper to get sleep quality description based on duration
export const getSleepQualityDescription = (
  durationInMillis: number
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

// Helper to get exercise type name
export const getExerciseTypeName = (exerciseType: number): string => {
  switch (exerciseType) {
    case ExerciseType.BIKING: return 'Biking';
    case ExerciseType.RUNNING: return 'Running';
    case ExerciseType.WALKING: return 'Walking';
    case ExerciseType.HIKING: return 'Hiking';
    case ExerciseType.SWIMMING: return 'Swimming';
    case ExerciseType.WORKOUT: return 'Workout';
    case ExerciseType.CALISTHENICS: return 'Calisthenics';
    case ExerciseType.DANCING: return 'Dancing';
    case ExerciseType.ELLIPTICAL: return 'Elliptical';
    case ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING: return 'HIIT';
    case ExerciseType.ROWING: return 'Rowing';
    case ExerciseType.STAIR_CLIMBING: return 'Stair Climbing';
    case ExerciseType.WEIGHT_TRAINING: return 'Weight Training';
    case ExerciseType.YOGA: return 'Yoga';
    case ExerciseType.OTHER: return 'Other';
    default: return 'Unknown';
  }
};

// Format exercise duration
export const formatExerciseDuration = (durationInMillis: number): string => {
  if (!durationInMillis) return '0m';
  
  const totalMinutes = Math.floor(durationInMillis / 60000);
  
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h ${minutes}m`;
};

// ========== Time Range Helper Functions ==========

// Get time range for last day (24 hours)
export const getTimeRangeForLastDay = (): { startTime: string, endTime: string } => {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
};

// Get time range for last week (7 days)
export const getTimeRangeForLastWeek = (): { startTime: string, endTime: string } => {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
};

// Get time range for last month (30 days)
export const getTimeRangeForLastMonth = (): { startTime: string, endTime: string } => {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
};

// Get time range for last year (365 days)
export const getTimeRangeForLastYear = (): { startTime: string, endTime: string } => {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
};

// Get time range for a specific day
export const getTimeRangeForSpecificDay = (date: Date): { startTime: string, endTime: string } => {
  // Set time to beginning of the day (00:00:00)
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const startTime = startDate.toISOString();
  
  // Set time to end of the day (23:59:59.999)
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  const endTime = endDate.toISOString();
  
  return { startTime, endTime };
};

// Helper to format date range for display
export const formatDateRangeLabel = (timeRange: 'day' | 'week' | 'month' | 'year' | 'specific', specificDate?: Date): string => {
  const now = new Date();
  
  switch (timeRange) {
    case 'day':
      return 'Last 24 Hours';
    case 'week':
      return 'Last 7 Days';
    case 'month':
      return 'Last 30 Days';
    case 'year':
      return 'Last 365 Days';
    case 'specific':
      if (specificDate) {
        return specificDate.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return 'Specific Day';
    default:
      return 'Last 7 Days';
  }
};

// Save the last time health data was synced
export const updateLastHealthSyncTime = async (): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync('LAST_HEALTH_SYNC_TIME', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error updating last health sync time:', error);
    return false;
  }
};

// Get the last time health data was synced
export const getLastHealthSyncTime = async (): Promise<Date | null> => {
  try {
    const time = await SecureStore.getItemAsync('LAST_HEALTH_SYNC_TIME');
    return time ? new Date(time) : null;
  } catch (error) {
    console.error('Error getting last health sync time:', error);
    return null;
  }
};

// Export SdkAvailabilityStatus for convenience
export { SdkAvailabilityStatus } from 'react-native-health-connect';