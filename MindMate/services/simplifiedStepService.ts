// services/simplifiedStepService.ts
import { Pedometer } from 'expo-sensors';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class StepService {
  private isAvailable = false;
  private currentStepCount = 0;
  private stepCountSubscription: { remove: () => void } | null = null;

  async setup(): Promise<boolean> {
    try {
      this.isAvailable = await Pedometer.isAvailableAsync();
      
      // If pedometer is available and we're on Android, start watching steps right away
      if (this.isAvailable && Platform.OS === 'android') {
        await this.startWatchingSteps();
      }
      
      return this.isAvailable;
    } catch (error) {
      console.error('Pedometer setup failed:', error);
      this.isAvailable = false;
      return false;
    }
  }

  private async startWatchingSteps() {
    // Clean up any existing subscription
    if (this.stepCountSubscription) {
      this.stepCountSubscription.remove();
    }

    // Load the last saved step count
    try {
      const savedCount = await SecureStore.getItemAsync('latestStepCount');
      if (savedCount) {
        this.currentStepCount = parseInt(savedCount, 10);
      }
    } catch (error) {
      console.error('Error loading saved step count:', error);
    }

    // Start watching steps
    this.stepCountSubscription = Pedometer.watchStepCount(result => {
      this.currentStepCount = result.steps;
      // Save the latest count
      SecureStore.setItemAsync('latestStepCount', result.steps.toString());
      SecureStore.setItemAsync('lastStepUpdateTime', new Date().toISOString());
    });
  }

  async requestPermission(): Promise<boolean> {
    // Pedometer permissions are requested automatically when you start using it
    return this.isAvailable || await this.setup();
  }

  async getTodaySteps(): Promise<number> {
    if (!this.isAvailable) {
      const available = await this.setup();
      if (!available) return 0;
    }

    // Different implementation based on platform
    if (Platform.OS === 'ios') {
      try {
        // iOS supports getStepCountAsync with date ranges
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const { steps } = await Pedometer.getStepCountAsync(start, now);
        
        // Store the latest step count
        await SecureStore.setItemAsync('latestStepCount', steps.toString());
        await SecureStore.setItemAsync('lastStepUpdateTime', now.toISOString());
        
        return steps;
      } catch (error) {
        console.error('Error fetching steps on iOS:', error);
        return this.getFallbackStepCount();
      }
    } else {
      // Android - return the current step count from our subscription
      // If we haven't got any steps yet, try to return stored steps
      if (this.currentStepCount === 0) {
        return this.getFallbackStepCount();
      }
      return this.currentStepCount;
    }
  }

  private async getFallbackStepCount(): Promise<number> {
    try {
      const cachedSteps = await SecureStore.getItemAsync('latestStepCount');
      return cachedSteps ? parseInt(cachedSteps, 10) : 0;
    } catch {
      return 0;
    }
  }

  subscribeToUpdates(callback: (steps: number) => void): { remove: () => void } {
    if (!this.isAvailable) {
      this.setup().then(available => {
        if (!available) {
          console.warn('Pedometer is not available');
          return;
        }
      });
    }

    // For Android, we're already watching steps in setup()
    // We'll just create a timer that calls the callback with the current step count
    if (Platform.OS === 'android') {
      const intervalId = setInterval(() => {
        callback(this.currentStepCount);
      }, 1000); // Update every second
      
      return {
        remove: () => clearInterval(intervalId)
      };
    } else {
      // For iOS, we can use the built-in watchStepCount
      return Pedometer.watchStepCount(result => {
        callback(result.steps);
      });
    }
  }

  cleanup() {
    if (this.stepCountSubscription) {
      this.stepCountSubscription.remove();
      this.stepCountSubscription = null;
    }
  }
}

export const stepService = new StepService();