// services/healthDataSyncService.ts
import * as SecureStore from 'expo-secure-store';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getApiConfig } from './apiConfig';
import { auth } from './auth';
import {
  initializeHealthConnect,
  checkHealthConnectAvailability,
  getAggregatedSteps,
  getAggregatedDistance,
  getTotalSleepTime,
  readSleepSessions,
  getTotalExerciseStats,
  readExerciseSessions,
  SdkAvailabilityStatus,
  ExerciseType,
} from './healthConnectService';

// Constants
const HEALTH_DATA_SYNC_TASK = 'HEALTH_DATA_SYNC_TASK';
const LAST_SYNC_KEY = 'last_health_data_sync';
const SYNC_INTERVAL_MINUTES = 15;

// Define interfaces for better type safety
interface ExerciseEnergy {
  inCalories?: number;
  inJoules?: number;
  inKilocalories?: number;
  inKilojoules?: number;
  value?: number;
  unit?: string;
}

interface ExerciseDistance {
  inMeters?: number;
  inKilometers?: number;
  value?: number;
  unit?: string;
}

interface ExerciseSession {
  exerciseType: ExerciseType | number;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
  // Using optional properties for potentially missing data
  energy?: ExerciseEnergy;
  distance?: ExerciseDistance;
  // Add other possible properties
  [key: string]: any;
}

// Register the background task for health data sync
TaskManager.defineTask(HEALTH_DATA_SYNC_TASK, async () => {
  try {
    console.log('[HealthDataSync] Background sync started');
    const result = await syncHealthData();
    
    if (result.success) {
      console.log('[HealthDataSync] Sync successful');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[HealthDataSync] No new data to sync');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
  } catch (error) {
    console.error('[HealthDataSync] Sync error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background health data sync task
 */
export const registerHealthDataSync = async (): Promise<boolean> => {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(HEALTH_DATA_SYNC_TASK);
    
    if (isRegistered) {
      console.log('[HealthDataSync] Task already registered');
      return true;
    }
    
    // Register the task
    await BackgroundFetch.registerTaskAsync(HEALTH_DATA_SYNC_TASK, {
      minimumInterval: SYNC_INTERVAL_MINUTES * 60, // Convert minutes to seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('[HealthDataSync] Background task registered');
    
    // Run an initial sync
    setTimeout(() => {
      syncHealthData().catch(error => {
        console.error('[HealthDataSync] Initial sync error:', error);
      });
    }, 5000); // Wait 5 seconds to make sure app is fully initialized
    
    return true;
  } catch (error) {
    console.error('[HealthDataSync] Failed to register task:', error);
    return false;
  }
};

/**
 * Unregister the background health data sync task
 */
export const unregisterHealthDataSync = async (): Promise<boolean> => {
  try {
    await BackgroundFetch.unregisterTaskAsync(HEALTH_DATA_SYNC_TASK);
    console.log('[HealthDataSync] Background task unregistered');
    return true;
  } catch (error) {
    console.error('[HealthDataSync] Failed to unregister task:', error);
    return false;
  }
};

/**
 * Check if we should sync health data based on last sync time
 */
const shouldSyncHealthData = async (): Promise<boolean> => {
  try {
    // Only relevant for Android
    if (Platform.OS !== 'android') {
      return false;
    }
    
    // Check if Health Connect is available
    const status = await checkHealthConnectAvailability();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log('[HealthDataSync] Health Connect not available');
      return false;
    }
    
    // Check if user is logged in
    const authInfo = await auth.getAuthInfo();
    if (!authInfo?.token) {
      console.log('[HealthDataSync] User not logged in');
      return false;
    }
    
    // Get last sync time
    const lastSyncStr = await SecureStore.getItemAsync(LAST_SYNC_KEY);
    if (!lastSyncStr) {
      console.log('[HealthDataSync] No previous sync, should sync now');
      return true;
    }
    
    // Parse last sync time
    const lastSync = new Date(lastSyncStr);
    const now = new Date();
    const diffInMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
    
    // Check if enough time has passed since last sync
    const shouldSync = diffInMinutes >= SYNC_INTERVAL_MINUTES;
    console.log(`[HealthDataSync] Last sync was ${diffInMinutes.toFixed(1)} minutes ago, should sync: ${shouldSync}`);
    
    return shouldSync;
  } catch (error) {
    console.error('[HealthDataSync] Error checking sync status:', error);
    return false;
  }
};

/**
 * Extract energy value from an exercise session
 */
const extractEnergyValue = (session: ExerciseSession): number | undefined => {
  if (!session.energy) return undefined;
  
  const energy = session.energy;
  
  // Check all possible properties in order of preference
  if (typeof energy.inKilocalories === 'number') return energy.inKilocalories;
  if (typeof energy.inCalories === 'number') return energy.inCalories / 1000; // Convert to kcal
  if (typeof energy.value === 'number' && energy.unit === 'kilocalories') return energy.value;
  if (typeof energy.value === 'number' && energy.unit === 'calories') return energy.value / 1000;
  
  return undefined;
};

/**
 * Extract distance values from an exercise session
 */
const extractDistanceValues = (session: ExerciseSession): { inMeters?: number, inKilometers?: number } => {
  const result: { inMeters?: number, inKilometers?: number } = {};
  
  if (!session.distance) return result;
  
  const distance = session.distance;
  
  // Extract meters value
  if (typeof distance.inMeters === 'number') {
    result.inMeters = distance.inMeters;
  } else if (typeof distance.value === 'number' && distance.unit === 'meters') {
    result.inMeters = distance.value;
  }
  
  // Extract or calculate kilometers value
  if (typeof distance.inKilometers === 'number') {
    result.inKilometers = distance.inKilometers;
  } else if (result.inMeters) {
    result.inKilometers = result.inMeters / 1000;
  }
  
  return result;
};

/**
 * Sync health data with the server
 */
export const syncHealthData = async (forceSync = false): Promise<{ success: boolean, message: string }> => {
  try {
    // Skip sync on non-Android platforms
    if (Platform.OS !== 'android') {
      return { success: false, message: 'Health Connect is only available on Android' };
    }
    
    // Check if we should sync
    if (!forceSync && !(await shouldSyncHealthData())) {
      return { success: false, message: 'Sync not needed at this time' };
    }
    
    console.log('[HealthDataSync] Starting sync process');
    
    // Initialize Health Connect
    const initialized = await initializeHealthConnect();
    if (!initialized) {
      return { success: false, message: 'Failed to initialize Health Connect' };
    }
    
    // Get auth token
    const authInfo = await auth.getAuthInfo();
    if (!authInfo?.token) {
      return { success: false, message: 'User not authenticated' };
    }
    
    // Determine time range
    // For the first sync, get data from the last 7 days
    // For subsequent syncs, get data since the last sync
    let startTime: string;
    const lastSyncStr = await SecureStore.getItemAsync(LAST_SYNC_KEY);
    
    if (lastSyncStr && !forceSync) {
      // Get data since last sync
      startTime = lastSyncStr;
    } else {
      // Get data from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      startTime = sevenDaysAgo.toISOString();
    }
    
    const endTime = new Date().toISOString();
    
    console.log(`[HealthDataSync] Fetching data from ${startTime} to ${endTime}`);
    
    // Fetch health data
    const [stepsData, distanceData, sleepData, exerciseStats, sleepSessions, exerciseSessions] = await Promise.all([
      getAggregatedSteps(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching steps:', e);
        return null;
      }),
      getAggregatedDistance(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching distance:', e);
        return null;
      }),
      getTotalSleepTime(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching sleep time:', e);
        return null;
      }),
      getTotalExerciseStats(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching exercise stats:', e);
        return null;
      }),
      readSleepSessions(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching sleep sessions:', e);
        return [];
      }),
      readExerciseSessions(startTime, endTime).catch(e => {
        console.error('[HealthDataSync] Error fetching exercise sessions:', e);
        return [];
      }),
    ]);
    
    // Prepare data for sync
    const healthData: any = {};
    
    // Add steps data if available
    if (stepsData && stepsData.COUNT_TOTAL) {
      healthData.steps = {
        count: stepsData.COUNT_TOTAL,
        startTime,
        endTime,
        dataOrigins: stepsData.dataOrigins || [],
      };
    }
    
    // Add distance data if available
    if (distanceData && distanceData.DISTANCE?.inMeters) {
      healthData.distance = {
        inMeters: distanceData.DISTANCE.inMeters,
        inKilometers: distanceData.DISTANCE.inKilometers,
        startTime,
        endTime,
        dataOrigins: distanceData.dataOrigins || [],
      };
    }
    
    // Add sleep data if available
    if (sleepData?.SLEEP_DURATION_TOTAL && sleepSessions.length > 0) {
      // Find the most recent sleep session
      const sortedSessions = [...sleepSessions].sort((a, b) =>
        new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      );
      
      const lastSession = sortedSessions[0];
      const durationInSeconds = sleepData.SLEEP_DURATION_TOTAL;
      
      // Determine sleep quality based on duration
      let quality = 'fair';
      const durationHours = durationInSeconds / 3600;
      
      if (durationHours < 6) {
        quality = 'poor';
      } else if (durationHours >= 7 && durationHours <= 9) {
        quality = 'good';
      }
      
      healthData.sleep = {
        startTime: lastSession.startTime,
        endTime: lastSession.endTime,
        durationInSeconds,
        quality,
        dataOrigins: sleepData.dataOrigins || [],
      };
    }
    
    // Add exercise data if available
    if (exerciseStats?.EXERCISE_DURATION_TOTAL?.inSeconds && exerciseSessions.length > 0) {
      // Find the most recent exercise session
      const sortedSessions = [...exerciseSessions].sort((a, b) =>
        new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      );
      
      // Safely cast to our interface for proper type checking
      const lastSession = sortedSessions[0] as unknown as ExerciseSession;
      const durationInSeconds = exerciseStats.EXERCISE_DURATION_TOTAL.inSeconds;
      
      // Extract energy value safely
      const calories = extractEnergyValue(lastSession);
      
      // Extract distance values safely
      const distance = extractDistanceValues(lastSession);
      
      healthData.exercise = {
        type: lastSession.exerciseType.toString(),
        startTime: lastSession.startTime,
        endTime: lastSession.endTime,
        durationInSeconds,
        ...(calories !== undefined && { calories }),
        ...(Object.keys(distance).length > 0 && { distance }),
        dataOrigins: exerciseStats.dataOrigins || [],
      };
    }
    
    // Check if we have any data to sync
    if (Object.keys(healthData).length === 0) {
      console.log('[HealthDataSync] No new health data to sync');
      
      // Update last sync time even if no data was found
      await SecureStore.setItemAsync(LAST_SYNC_KEY, new Date().toISOString());
      
      return { success: false, message: 'No new health data to sync' };
    }
    
    // Send data to server
    console.log('[HealthDataSync] Sending data to server:', JSON.stringify(healthData, null, 2));
    
    const apiConfig = getApiConfig();
    const response = await fetch(`${apiConfig.baseUrl}/health-data/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authInfo.token}`,
      },
      body: JSON.stringify(healthData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Server error: ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update last sync time
    await SecureStore.setItemAsync(LAST_SYNC_KEY, new Date().toISOString());
    
    return { success: true, message: result.message || 'Health data synced successfully' };
  } catch (error) {
    console.error('[HealthDataSync] Sync error:', error);
    return { 
      success: false, 
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Get the last sync time
 */
export const getLastHealthSyncTime = async (): Promise<Date | null> => {
  try {
    const lastSyncStr = await SecureStore.getItemAsync(LAST_SYNC_KEY);
    return lastSyncStr ? new Date(lastSyncStr) : null;
  } catch (error) {
    console.error('[HealthDataSync] Error getting last sync time:', error);
    return null;
  }
};

/**
 * Check server for last sync time
 */
export const checkServerLastSyncTime = async (): Promise<Date | null> => {
  try {
    // Get auth token
    const authInfo = await auth.getAuthInfo();
    if (!authInfo?.token) {
      console.log('[HealthDataSync] User not authenticated');
      return null;
    }
    
    // Call server API
    const apiConfig = getApiConfig();
    const response = await fetch(`${apiConfig.baseUrl}/health-data/last-sync`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authInfo.token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.lastSyncTime ? new Date(data.lastSyncTime) : null;
  } catch (error) {
    console.error('[HealthDataSync] Error checking server sync time:', error);
    return null;
  }
};

// Handle push notification for health data sync
export const handleHealthSyncNotification = async (): Promise<void> => {
  try {
    console.log('[HealthDataSync] Received sync notification');
    await syncHealthData();
  } catch (error) {
    console.error('[HealthDataSync] Error handling sync notification:', error);
  }
};

// Export standalone sync function
export default {
  sync: syncHealthData,
  register: registerHealthDataSync,
  unregister: unregisterHealthDataSync,
  getLastSyncTime: getLastHealthSyncTime,
  handlePushNotification: handleHealthSyncNotification,
};