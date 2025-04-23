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

export type SleepStage = {
  startTime: string;
  endTime: string;
  stage: SleepStageType;
};

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
    
    // Object to store daily health data
    // Format: { 'YYYY-MM-DD': { steps: {...}, sleep: {...}, ... } }
    const dailyHealthData: Record<string, any> = {};
    
    // Track days with data for stats
    let daysWithData = 0;
    
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
          const date = new Date(record.startTime);
          const dateStr = date.toISOString().split('T')[0];
          
          // Get steps for this specific day
          const dayStart = new Date(dateStr + 'T00:00:00.000Z');
          const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
          
          const stepsData = await getAggregatedSteps(
            dayStart.toISOString(), 
            dayEnd.toISOString()
          );
          
          if (stepsData && stepsData.COUNT_TOTAL) {
            if (!dailyHealthData[dateStr]) {
              dailyHealthData[dateStr] = {};
              daysWithData++;
            }
            
            dailyHealthData[dateStr].steps = {
              count: stepsData.COUNT_TOTAL,
              startTime: dayStart.toISOString(),
              endTime: dayEnd.toISOString(),
              dataOrigins: stepsData.dataOrigins || []
            };
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
          const date = new Date(record.startTime);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayStart = new Date(dateStr + 'T00:00:00.000Z');
          const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
          
          const distanceData = await getAggregatedDistance(
            dayStart.toISOString(), 
            dayEnd.toISOString()
          );
          
          if (distanceData && distanceData.DISTANCE?.inMeters) {
            if (!dailyHealthData[dateStr]) {
              dailyHealthData[dateStr] = {};
              daysWithData++;
            }
            
            dailyHealthData[dateStr].distance = {
              inMeters: distanceData.DISTANCE.inMeters,
              inKilometers: distanceData.DISTANCE.inKilometers,
              startTime: dayStart.toISOString(),
              endTime: dayEnd.toISOString(),
              dataOrigins: distanceData.dataOrigins || []
            };
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
          // Use the end date as the day the sleep belongs to
          const endDate = new Date(session.endTime);
          const dateStr = endDate.toISOString().split('T')[0];
          
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
          
          if (!dailyHealthData[dateStr]) {
            dailyHealthData[dateStr] = {};
            daysWithData++;
          }
          
          dailyHealthData[dateStr].sleep = {
            startTime: session.startTime,
            endTime: session.endTime,
            durationInSeconds,
            quality,
            dataOrigins: [session.metadata?.dataOrigin || 'unknown']
          };
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
          // Use start date of the exercise
          const startDate = new Date(session.startTime);
          const dateStr = startDate.toISOString().split('T')[0];
          
          // Calculate duration
          const endTime = new Date(session.endTime).getTime();
          const durationInSeconds = Math.round((endTime - startDate.getTime()) / 1000);
          
          const exerciseData: any = {
            type: session.exerciseType.toString(),
            startTime: session.startTime,
            endTime: session.endTime,
            durationInSeconds,
            dataOrigins: [session.metadata?.dataOrigin || 'unknown']
          };
          
          // Add calories if available
          if (session.energy && 
              (session.energy.inKilocalories || 
               session.energy.inCalories)) {
            exerciseData.calories = session.energy.inKilocalories || 
                                   (session.energy.inCalories ? session.energy.inCalories / 1000 : undefined);
          }
          
          // Add distance if available
          if (session.distance) {
            exerciseData.distance = {
              inMeters: session.distance.inMeters,
              inKilometers: session.distance.inKilometers
            };
          }
          
          if (!dailyHealthData[dateStr]) {
            dailyHealthData[dateStr] = {};
            daysWithData++;
          }
          
          // If we already have exercise data for this day, store as an array
          if (dailyHealthData[dateStr].exercise) {
            if (!dailyHealthData[dateStr].exercises) {
              dailyHealthData[dateStr].exercises = [dailyHealthData[dateStr].exercise];
            }
            
            dailyHealthData[dateStr].exercises.push(exerciseData);
            
            // Update total exercise duration
            dailyHealthData[dateStr].exercise.durationInSeconds += durationInSeconds;
            
            // Update calories if available
            if (exerciseData.calories && dailyHealthData[dateStr].exercise.calories) {
              dailyHealthData[dateStr].exercise.calories += exerciseData.calories;
            }
          } else {
            dailyHealthData[dateStr].exercise = exerciseData;
          }
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
    
    // Send data to server using the new sync-multiple endpoint
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

// Insert an exercise session
export const insertExerciseSession = async (
  exerciseType: ExerciseType,
  startTime: string,
  endTime: string,
  title?: string,
  notes?: string,
  energyInKcal?: number,
  distanceInMeters?: number
) => {
  try {
    const session: any = {
      recordType: 'ExerciseSession',
      startTime,
      endTime,
      exerciseType,
    };

    if (title) session.title = title;
    if (notes) session.notes = notes;
    
    if (energyInKcal) {
      session.energy = {
        value: energyInKcal,
        unit: 'kilocalories',
      };
    }
    
    if (distanceInMeters) {
      session.distance = {
        value: distanceInMeters,
        unit: 'meters',
      };
    }

    const recordIds = await insertRecords([session]);
    return recordIds;
  } catch (error) {
    console.error('Error inserting exercise session:', error);
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

// Analyze exercise patterns for mental health insights
export const analyzeExercisePatterns = async (startTime: string, endTime: string) => {
  try {
    const exerciseSessions = await readExerciseSessions(startTime, endTime);
    const exerciseStats = await getTotalExerciseStats(startTime, endTime);
    
    // Calculate days between start and end
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Analysis results
    const result = {
      sessionsCount: exerciseSessions.length,
      averageSessionsPerWeek: (exerciseSessions.length / daysDiff) * 7,
      totalDuration: Number(exerciseStats?.EXERCISE_DURATION_TOTAL || 0),
      averageDurationPerSession: exerciseSessions.length ? 
        Number(exerciseStats?.EXERCISE_DURATION_TOTAL || 0) / exerciseSessions.length : 0,
      consistencyScore: 0,
      varietyScore: 0,
      mentalHealthInsight: ''
    };
    
    // Calculate consistency (how regularly spaced the sessions are)
    if (exerciseSessions.length > 1) {
      const sortedSessions = [...exerciseSessions].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      const timeGaps = [];
      for (let i = 1; i < sortedSessions.length; i++) {
        const prevTime = new Date(sortedSessions[i-1].startTime).getTime();
        const currTime = new Date(sortedSessions[i].startTime).getTime();
        timeGaps.push(currTime - prevTime);
      }
      
      // Standard deviation of gaps (lower is more consistent)
      const avgGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
      const variance = timeGaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / timeGaps.length;
      const stdDev = Math.sqrt(variance);
      
      // Convert to a 0-100 score (lower stdDev means higher consistency)
      const maxStdDev = 7 * 24 * 60 * 60 * 1000; // 1 week in ms
      result.consistencyScore = Math.max(0, Math.min(100, 100 - (stdDev / maxStdDev * 100)));
    }
    
    // Calculate variety (different types of exercise)
    const uniqueTypes = new Set(exerciseSessions.map(s => s.exerciseType)).size;
    result.varietyScore = Math.min(100, uniqueTypes * 20); // Each type is worth 20 points, max 100
    
    // Generate insight
    if (result.sessionsCount === 0) {
      result.mentalHealthInsight = "No exercise detected. Regular physical activity can help improve mood and reduce stress and anxiety.";
    } else if (result.averageSessionsPerWeek < 2) {
      result.mentalHealthInsight = "Low exercise frequency. Aim for at least 3 sessions per week for mental health benefits.";
    } else if (result.consistencyScore < 40) {
      result.mentalHealthInsight = "Exercise pattern is irregular. Consistent exercise schedules can help regulate mood and energy levels.";
    } else if (result.varietyScore < 40) {
      result.mentalHealthInsight = "Limited exercise variety. Trying different activities can increase engagement and psychological benefits.";
    } else {
      result.mentalHealthInsight = "Good exercise patterns! Your consistent and varied exercise routine is ideal for mental wellbeing.";
    }
    
    return result;
  } catch (error) {
    console.error('Error analyzing exercise patterns:', error);
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