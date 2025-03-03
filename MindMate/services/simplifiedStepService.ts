// services/simplifiedStepService.ts
import { Pedometer } from 'expo-sensors';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Storage keys
const LAST_RESET_DATE_KEY = 'lastStepResetDate';
const LATEST_STEP_COUNT_KEY = 'latestStepCount';
const LAST_STEP_UPDATE_TIME_KEY = 'lastStepUpdateTime';
const INITIAL_PEDOMETER_COUNT_KEY = 'initialPedometerCount';

export class StepService {
  private isAvailable = false;
  private currentStepCount = 0;
  private stepCountSubscription: { remove: () => void } | null = null;
  private lastResetDate: string | null = null;
  private initialPedometerCount = 0; // Used to track the base value from the pedometer
  private isInitialized = false;

  constructor() {
    // Load previous data, but don't wait for it
    this.loadSavedData();
  }

  private async loadSavedData() {
    try {
      // Load last reset date
      this.lastResetDate = await SecureStore.getItemAsync(LAST_RESET_DATE_KEY);
      if (!this.lastResetDate) {
        // If there's no reset date stored, set it to today
        const today = this.getTodayDateString();
        await SecureStore.setItemAsync(LAST_RESET_DATE_KEY, today);
        this.lastResetDate = today;
      }

      // Load saved step count
      const savedCount = await SecureStore.getItemAsync(LATEST_STEP_COUNT_KEY);
      if (savedCount) {
        this.currentStepCount = parseInt(savedCount, 10);
      }

      // Load initial pedometer count (used as a base value)
      const initialCount = await SecureStore.getItemAsync(INITIAL_PEDOMETER_COUNT_KEY);
      if (initialCount) {
        this.initialPedometerCount = parseInt(initialCount, 10);
      }

      console.log('Step service loaded saved data:', {
        lastResetDate: this.lastResetDate,
        currentStepCount: this.currentStepCount,
        initialPedometerCount: this.initialPedometerCount
      });
    } catch (error) {
      console.error('Error loading saved step data:', error);
    }
  }

  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  async checkAndResetStepsIfNeeded(): Promise<boolean> {
    try {
      const today = this.getTodayDateString();
      
      // If last reset date is null, initialize it
      if (!this.lastResetDate) {
        this.lastResetDate = today;
        await SecureStore.setItemAsync(LAST_RESET_DATE_KEY, today);
      }
      
      // Check if we need to reset for a new day
      if (this.lastResetDate !== today) {
        console.log(`Step count reset triggered: ${this.lastResetDate} → ${today}`);
        
        // Reset step count
        this.currentStepCount = 0;
        await SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, '0');
        
        // Reset initial pedometer count (we'll recalculate it on next reading)
        this.initialPedometerCount = 0;
        await SecureStore.setItemAsync(INITIAL_PEDOMETER_COUNT_KEY, '0');
        
        // Update the reset date
        await SecureStore.setItemAsync(LAST_RESET_DATE_KEY, today);
        this.lastResetDate = today;
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking/resetting steps:', error);
      return false;
    }
  }

  async setup(): Promise<boolean> {
    try {
      // If already initialized, just return availability
      if (this.isInitialized) {
        console.log('Step service already initialized');
        return this.isAvailable;
      }

      console.log('Initializing step service...');
      this.isAvailable = await Pedometer.isAvailableAsync();
      
      // Check if we need to reset steps for a new day
      await this.checkAndResetStepsIfNeeded();
      
      // If pedometer is available, start watching steps
      if (this.isAvailable) {
        await this.startWatchingSteps();
        this.isInitialized = true;
      }
      
      console.log('Step service initialized, available:', this.isAvailable);
      return this.isAvailable;
    } catch (error) {
      console.error('Pedometer setup failed:', error);
      this.isAvailable = false;
      return false;
    }
  }

  private async startWatchingSteps() {
    // Clean up any existing subscription
    this.cleanup();

    console.log('Starting to watch steps...');
    
    // Start watching steps
    if (Platform.OS === 'android') {
      // On Android, we use watchStepCount to get continuous updates
      this.stepCountSubscription = Pedometer.watchStepCount(async result => {
        try {
          // If this is the first reading, store it as initial count
          if (this.initialPedometerCount === 0) {
            this.initialPedometerCount = result.steps;
            await SecureStore.setItemAsync(INITIAL_PEDOMETER_COUNT_KEY, result.steps.toString());
            console.log('Set initial pedometer count:', result.steps);
          }
          
          // Calculate relative steps (since last reset)
          // Note: On Android, the step counter is cumulative since device reboot
          const relativeSteps = Math.max(0, result.steps - this.initialPedometerCount);
          this.currentStepCount = relativeSteps;
          
          // Save the latest count
          await SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, relativeSteps.toString());
          await SecureStore.setItemAsync(LAST_STEP_UPDATE_TIME_KEY, new Date().toISOString());
          
          console.log(`Step update - Raw: ${result.steps}, Initial: ${this.initialPedometerCount}, Relative: ${relativeSteps}`);
        } catch (error) {
          console.error('Error processing step update:', error);
        }
      });
    } else if (Platform.OS === 'ios') {
      // On iOS, we can use the iOS-specific approach
      // This is simpler because iOS step counts reset at midnight automatically
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      // Initial reading
      try {
        const { steps } = await Pedometer.getStepCountAsync(startOfDay, new Date());
        this.currentStepCount = steps;
        await SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, steps.toString());
        console.log('Initial iOS step count:', steps);
      } catch (error) {
        console.error('Error getting initial iOS step count:', error);
      }
      
      // Set up periodic reading every minute
      const intervalId = setInterval(async () => {
        try {
          const { steps } = await Pedometer.getStepCountAsync(startOfDay, new Date());
          this.currentStepCount = steps;
          await SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, steps.toString());
          await SecureStore.setItemAsync(LAST_STEP_UPDATE_TIME_KEY, new Date().toISOString());
        } catch (error) {
          console.error('Error updating iOS step count:', error);
        }
      }, 60000);
      
      // Create a subscription-like object for cleanup
      this.stepCountSubscription = {
        remove: () => clearInterval(intervalId)
      };
    }
  }

  async requestPermission(): Promise<boolean> {
    // No explicit permission request method for Pedometer, so we just try to use it
    return this.isAvailable || await this.setup();
  }

  async getTodaySteps(): Promise<number> {
    // Check if we need to reset steps for a new day
    const wasReset = await this.checkAndResetStepsIfNeeded();
    
    // If not initialized or pedometer not available, try to set up
    if (!this.isInitialized || !this.isAvailable) {
      const available = await this.setup();
      if (!available) {
        console.log('Pedometer not available, returning cached count');
        return this.currentStepCount;
      }
    }

    if (Platform.OS === 'ios') {
      try {
        // For iOS, get the current day's steps directly
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const { steps } = await Pedometer.getStepCountAsync(start, now);
        
        // Store the latest step count
        this.currentStepCount = steps;
        await SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, steps.toString());
        await SecureStore.setItemAsync(LAST_STEP_UPDATE_TIME_KEY, now.toISOString());
        
        return steps;
      } catch (error) {
        console.error('Error fetching steps on iOS:', error);
        return this.currentStepCount; // Return the last known count
      }
    } else {
      // For Android, return the current tracked count
      return this.currentStepCount;
    }
  }

  subscribeToUpdates(callback: (steps: number) => void): { remove: () => void } {
    console.log('New subscription to step updates requested');
    
    // Make sure step service is initialized
    if (!this.isInitialized) {
      this.setup().then(available => {
        if (!available) {
          console.warn('Pedometer is not available for subscription');
        }
      });
    }

    // Create an update interval that checks for date changes and gets the latest steps
    const intervalId = setInterval(async () => {
      // Check if we need to reset steps
      const wasReset = await this.checkAndResetStepsIfNeeded();
      
      // If reset or we're just due for an update, call the callback
      if (wasReset || true) {
        callback(this.currentStepCount);
      }
    }, 1000); // Update every second
    
    // Return an object that mimics the Expo sensor subscription API
    return {
      remove: () => {
        console.log('Removing step update subscription');
        clearInterval(intervalId);
      }
    };
  }

  cleanup() {
    if (this.stepCountSubscription) {
      console.log('Cleaning up step service subscription');
      this.stepCountSubscription.remove();
      this.stepCountSubscription = null;
    }
    
    // Save current state before cleanup
    if (this.currentStepCount > 0) {
      SecureStore.setItemAsync(LATEST_STEP_COUNT_KEY, this.currentStepCount.toString());
    }
  }
}

// Create a truly singleton instance
export const stepService = new StepService();