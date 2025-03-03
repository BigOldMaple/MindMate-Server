// services/backgroundStepService.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { stepService } from './simplifiedStepService';
import * as SecureStore from 'expo-secure-store';

const STEP_TRACKING_TASK = 'STEP_TRACKING_TASK';

// Register the task
TaskManager.defineTask(STEP_TRACKING_TASK, async () => {
  try {
    const isAvailable = await stepService.setup();
    if (!isAvailable) return BackgroundFetch.BackgroundFetchResult.NoData;
    
    // First check if we need to reset the step count for a new day
    await stepService.checkAndResetStepsIfNeeded();
    
    // Then get the current step count
    const steps = await stepService.getTodaySteps();
    
    // Store steps count for app to use when opened
    await SecureStore.setItemAsync('latestStepCount', steps.toString());
    await SecureStore.setItemAsync('lastStepUpdateTime', new Date().toISOString());
    
    console.log('Background step tracking updated, current steps:', steps);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background step tracking failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundStepTracking = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_TRACKING_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(STEP_TRACKING_TASK, {
        minimumInterval: 15, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Step tracking registered in background');
    } else {
      console.log('Step tracking task already registered');
    }
    return true;
  } catch (error) {
    console.error('Failed to register background step tracking:', error);
    return false;
  }
};

export const isBackgroundStepTrackingRegistered = async () => {
  return await TaskManager.isTaskRegisteredAsync(STEP_TRACKING_TASK);
};