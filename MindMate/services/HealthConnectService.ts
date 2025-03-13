// services/healthConnectService.ts
import {
    initialize,
    requestPermission,
    readRecords
} from 'react-native-health-connect';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Add these type definitions at the top of your HealthConnectService.ts file
type PermissionStatus = 'granted' | 'denied' | 'not_determined';

interface Permission {
  status?: PermissionStatus;
  granted?: boolean;
}

interface PermissionResult {
  status?: PermissionStatus;
  [recordType: string]: Permission | PermissionStatus | undefined;
}

// Health Connect service class for managing interactions with Google Health Connect
export class HealthConnectService {
    private static instance: HealthConnectService;
    private isInitialized = false;
    private readonly STEPS_STORAGE_KEY = 'health_connect_steps';
    private readonly LAST_SYNC_KEY = 'health_connect_last_sync';

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

    // Initialize Health Connect
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
          
          // Add a delay to ensure everything is loaded properly
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Initialize the Health Connect client
          await initialize();
          
          // Set initialized flag
          this.isInitialized = true;
          console.log('Health Connect initialization successful');
          return true;
        } catch (error) {
          console.error('Failed to initialize Health Connect:', error);
          this.isInitialized = false;
          return false;
        }
      }
      
      // Ensure your requestStepPermissions method is robust
      async requestStepPermissions(): Promise<boolean> {
        // Make sure we're on Android
        if (!this.isAvailable()) {
          console.log('Health Connect is not available on this platform');
          return false;
        }
      
        // Always ensure we're initialized before requesting permissions
        if (!this.isInitialized) {
          console.log('Health Connect not initialized, initializing now...');
          const initSuccess = await this.initialize();
          if (!initSuccess) {
            console.error('Failed to initialize Health Connect before permission request');
            return false;
          }
        }
      
        try {
          console.log('Requesting Health Connect permissions for steps...');
          // Request permission for reading steps
          const result = (await requestPermission([
            { recordType: 'Steps', accessType: 'read' }
          ])) as unknown as PermissionResult | boolean;
      
          // Check if we have the result object at all
          if (!result) {
            console.log('Permission request returned no result');
            return false;
          }
      
          console.log('Permission result received:', result);
      
          // Handle different response formats that might be returned
          // by different versions of the library
      
          // If result is a simple boolean
          if (typeof result === 'boolean') {
            console.log('Permission result (boolean):', result);
            return result;
          }
      
          // If result is a simple object with a status field
          if ('status' in result) {
            const granted = result.status === 'granted';
            console.log('Permission status:', granted ? 'granted' : 'denied');
            return granted;
          }
      
          // If result is an object with recordType keys
          if (typeof result === 'object' && Object.keys(result).length > 0) {
            // Check if any permission was explicitly denied
            for (const key in result) {
              const permission = result[key] as Permission | undefined;
      
              // If any permission is explicitly false or a boolean false, return false
              if (typeof permission === 'boolean' && !permission) {
                console.log(`Permission denied for ${key}`);
                return false;
              }
      
              // Handle more complex permission objects
              if (typeof permission === 'object' && permission !== null) {
                if ('granted' in permission && !permission.granted) {
                  console.log(`Permission denied for ${key} (complex object)`);
                  return false;
                }
                
                if ('status' in permission && permission.status !== 'granted') {
                  console.log(`Permission denied for ${key} (status object)`);
                  return false;
                }
              }
            }
      
            // If we got here, no permissions were explicitly denied
            console.log('All permissions appear to be granted');
            return true;
          }
      
          // Default: assume permission not granted if we can't determine
          console.log('Could not determine permission status from:', result);
          return false;
        } catch (error) {
          console.error('Failed to request Health Connect permissions:', error);
          return false;
        }
      }

    // Read step data for a specific time range
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
            // Use the correct readRecords format with record type and time range
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

    // Get total steps for a specific time range
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

    // Runs a background check for steps
    async refreshBackgroundSteps(): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            // Make sure to check initialization result
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('Failed to initialize Health Connect for background refresh');
                return false;
            }

            const hasPermission = await this.requestStepPermissions();

            if (hasPermission) {
                const steps = await this.getTodaySteps();
                await this.storeStepCount(steps);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to refresh background steps:', error);
            return false;
        }
    }
}

export const healthConnectService = HealthConnectService.getInstance();