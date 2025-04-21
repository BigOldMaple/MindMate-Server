// services/backgroundHealthService.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import {
  initializeHealthConnect,
  getAggregatedSteps,
  getAggregatedDistance,
} from './healthConnectService';

// Define the background task name
const HEALTH_CONNECT_FETCH_TASK = 'HEALTH_CONNECT_FETCH_TASK';

// Register the background task
TaskManager.defineTask(HEALTH_CONNECT_FETCH_TASK, async () => {
  try {
    console.log('[BackgroundHealthService] Background fetch started');
    
    // Initialize Health Connect
    const initialized = await initializeHealthConnect();
    if (!initialized) {
      console.log('[BackgroundHealthService] Health Connect not initialized');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
    
    // Get the current date and time
    const endTime = new Date().toISOString();
    // Get data from the last 24 hours
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch steps and distance data
    const stepsData = await getAggregatedSteps(startTime, endTime);
    const distanceData = await getAggregatedDistance(startTime, endTime);
    
    // Log the retrieved data
    console.log('[BackgroundHealthService] Steps data:', stepsData);
    console.log('[BackgroundHealthService] Distance data:', distanceData);
    
    // Save the data to your app's storage or send to your server
    // This is where you'd implement the code to store the health data
    
    // Return success
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundHealthService] Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register the background fetch
export const registerBackgroundHealthFetch = async () => {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    
    // If the background fetch is already registered, return
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      console.log('[BackgroundHealthService] Background fetch already registered');
      return true;
    }
    
    // Register the background fetch task
    await BackgroundFetch.registerTaskAsync(HEALTH_CONNECT_FETCH_TASK, {
      minimumInterval: 60 * 15, // 15 minutes (in seconds)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('[BackgroundHealthService] Background fetch registered');
    return true;
  } catch (error) {
    console.error('[BackgroundHealthService] Error registering background fetch:', error);
    return false;
  }
};

// Unregister the background fetch
export const unregisterBackgroundHealthFetch = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(HEALTH_CONNECT_FETCH_TASK);
    console.log('[BackgroundHealthService] Background fetch unregistered');
    return true;
  } catch (error) {
    console.error('[BackgroundHealthService] Error unregistering background fetch:', error);
    return false;
  }
};

// Check if the background fetch is registered
export const isBackgroundHealthFetchRegistered = async () => {
  try {
    return await TaskManager.isTaskRegisteredAsync(HEALTH_CONNECT_FETCH_TASK);
  } catch (error) {
    console.error('[BackgroundHealthService] Error checking background fetch status:', error);
    return false;
  }
};