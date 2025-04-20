// services/healthConnectService.ts - WORKAROUND VERSION
import {
  initialize,
  readRecords
} from 'react-native-health-connect';
import * as SecureStore from 'expo-secure-store';
import { Platform, Linking } from 'react-native';

// Health Connect service class for managing interactions with Google Health Connect
export class HealthConnectService {
  private static instance: HealthConnectService;
  private isInitialized = false;
  private readonly STEPS_STORAGE_KEY = 'health_connect_steps';
  private readonly LAST_SYNC_KEY = 'health_connect_last_sync';
  private readonly HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

  private constructor() { }

  static getInstance(): HealthConnectService {
      if (!HealthConnectService.instance) {
          HealthConnectService.instance = new HealthConnectService();
      }
      return HealthConnectService.instance;
  }

  // Check if Health Connect is available (Android only)
  isAvailable(): boolean {
      return Platform.OS === 'android';
  }

  // Initialize Health Connect - just the initialization, no permissions
  async initialize(): Promise<boolean> {
      if (!this.isAvailable()) {
        console.log('Health Connect is not available on this platform');
        return false;
      }
    
      if (this.isInitialized) {
        console.log('Health Connect already initialized');
        return true;
      }
    
      try {
        console.log('Initializing Health Connect...');
        
        // First check if Health Connect is available on the device
        if (Platform.OS !== 'android') {
          console.log('Health Connect is only available on Android');
          return false;
        }
        
        // Initialize the Health Connect client
        const initResult = await initialize();
        
        // Set initialized flag
        this.isInitialized = !!initResult;
        console.log('Health Connect initialization result:', initResult);
        return this.isInitialized;
      } catch (error) {
        console.error('Failed to initialize Health Connect:', error);
        this.isInitialized = false;
        return false;
      }
  }
    
  // WORKAROUND: Instead of using the broken requestPermission function,
  // direct the user to configure permissions in the Health Connect app
  async requestStepPermissions(): Promise<boolean> {
      console.log('Opening Health Connect app for permissions...');
      
      try {
          // Open the Health Connect app directly
          await Linking.openURL('package:' + this.HEALTH_CONNECT_PACKAGE);
          return true; // Just return true to continue the flow
      } catch (error) {
          console.error('Failed to open Health Connect app:', error);
          
          // Try to open the Play Store if the app isn't installed
          try {
              await Linking.openURL('market://details?id=' + this.HEALTH_CONNECT_PACKAGE);
              return false;
          } catch (storeError) {
              console.error('Failed to open Play Store:', storeError);
              return false;
          }
      }
  }

  // Try to read steps - will fail if permissions aren't granted
  async readSteps(startTime: string, endTime: string): Promise<any[]> {
      // Ensure we're initialized before attempting to read data
      if (!this.isInitialized) {
          const initSuccess = await this.initialize();
          if (!initSuccess) {
              console.error('Failed to initialize Health Connect before reading steps');
              return [];
          }
      }

      try {
          console.log(`Reading steps from ${startTime} to ${endTime}`);
          
          // This will throw an error if permissions aren't granted
          const result = await readRecords(
              'Steps',  // First argument: record type
              {         // Second argument: options
                  timeRangeFilter: {
                      operator: 'between',
                      startTime,
                      endTime
                  }
              }
          );

          console.log(`Found ${result.records?.length || 0} step records`);
          return result.records || [];
      } catch (error) {
          console.error('Failed to read steps from Health Connect:', error);
          return [];
      }
  }

  // Try to get total steps - permissions check happens implicitly when we try to read
  async getTotalSteps(startTime: string, endTime: string): Promise<number> {
      try {
          const stepRecords = await this.readSteps(startTime, endTime);
          return stepRecords.reduce((total, record) => total + record.count, 0);
      } catch (error) {
          console.error('Failed to calculate total steps:', error);
          return 0;
      }
  }

  // Get today's steps
  async getTodaySteps(): Promise<number> {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      return await this.getTotalSteps(
          startOfDay.toISOString(),
          endOfDay.toISOString()
      );
  }

  // Get steps for a specific date
  async getStepsForDate(date: Date): Promise<number> {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return await this.getTotalSteps(
          startOfDay.toISOString(),
          endOfDay.toISOString()
      );
  }

  // Get steps for the past week
  async getWeeklySteps(): Promise<{ date: string, steps: number }[]> {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      try {
          const stepRecords = await this.readSteps(
              startDate.toISOString(),
              endDate.toISOString()
          );

          // Group steps by day
          const dailySteps: Record<string, number> = {};

          // Initialize all days with 0
          for (let i = 0; i < 7; i++) {
              const date = new Date(startDate);
              date.setDate(date.getDate() + i);
              const dateString = date.toISOString().split('T')[0];
              dailySteps[dateString] = 0;
          }

          // Sum steps for each day
          stepRecords.forEach(record => {
              const recordDate = new Date(record.startTime).toISOString().split('T')[0];
              dailySteps[recordDate] = (dailySteps[recordDate] || 0) + record.count;
          });

          // Convert to array for easier use in frontend
          const result = Object.entries(dailySteps).map(([date, steps]) => ({
              date,
              steps
          }));

          return result.sort((a, b) => a.date.localeCompare(b.date));
      } catch (error) {
          console.error('Failed to get weekly steps:', error);
          return [];
      }
  }

  // Store step count to SecureStore for persistence
  async storeStepCount(steps: number): Promise<void> {
      try {
          await SecureStore.setItemAsync(this.STEPS_STORAGE_KEY, steps.toString());
          await SecureStore.setItemAsync(this.LAST_SYNC_KEY, new Date().toISOString());
      } catch (error) {
          console.error('Failed to store step count:', error);
      }
  }

  // Get the last stored step count
  async getStoredStepCount(): Promise<number | null> {
      try {
          const steps = await SecureStore.getItemAsync(this.STEPS_STORAGE_KEY);
          return steps ? parseInt(steps, 10) : null;
      } catch (error) {
          console.error('Failed to get stored step count:', error);
          return null;
      }
  }

  // Get last sync time
  async getLastSyncTime(): Promise<Date | null> {
      try {
          const lastSync = await SecureStore.getItemAsync(this.LAST_SYNC_KEY);
          return lastSync ? new Date(lastSync) : null;
      } catch (error) {
          console.error('Failed to get last sync time:', error);
          return null;
      }
  }

  // Runs a background check for steps by trying to read them directly
  async refreshBackgroundSteps(): Promise<boolean> {
      if (!this.isAvailable()) return false;

      try {
          // Make sure to check initialization result
          const initialized = await this.initialize();
          if (!initialized) {
              console.error('Failed to initialize Health Connect for background refresh');
              return false;
          }

          // Instead of checking permissions first, just try to get the steps
          try {
              const steps = await this.getTodaySteps();
              await this.storeStepCount(steps);
              return true;
          } catch (e) {
              // If this fails, we don't have permissions
              console.log('Could not read steps - likely no permissions');
              return false;
          }
      } catch (error) {
          console.error('Failed to refresh background steps:', error);
          return false;
      }
  }

  // Check if we have permissions by attempting to read data
  async checkPermission(): Promise<boolean> {
      try {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);

          // Try to read steps - this will throw if we don't have permissions
          const result = await readRecords(
              'Steps',
              {
                  timeRangeFilter: {
                      operator: 'between',
                      startTime: startOfDay.toISOString(),
                      endTime: endOfDay.toISOString()
                  }
              }
          );

          // If we get here, we have permissions
          return true;
      } catch (error) {
          console.log('Permission check failed, likely no permissions granted:', error);
          return false;
      }
  }
}

export const healthConnectService = HealthConnectService.getInstance();