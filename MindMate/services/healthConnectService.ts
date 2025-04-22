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

// Export SdkAvailabilityStatus for convenience
export { SdkAvailabilityStatus } from 'react-native-health-connect';