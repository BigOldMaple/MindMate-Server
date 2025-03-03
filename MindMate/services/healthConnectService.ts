import * as HealthConnect from 'react-native-health-connect';

export class HealthConnectService {
  private static instance: HealthConnectService;
  private isInitialized: boolean = false;
  private isAvailable: boolean = false;

  private constructor() {}

  static getInstance(): HealthConnectService {
    if (!HealthConnectService.instance) {
      HealthConnectService.instance = new HealthConnectService();
    }
    return HealthConnectService.instance;
  }

  /**
   * Initialize Health Connect and check if it's available on the device
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return this.isAvailable;

    try {
      // Check if Health Connect is available
      const isAvailable = await HealthConnect.initialize();
      this.isAvailable = isAvailable;
      this.isInitialized = true;
      
      console.log('Health Connect availability:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('Error initializing Health Connect:', error);
      return false;
    }
  }

  /**
   * Request permission to access step count data
   */
  async requestStepCountPermission(): Promise<boolean> {
    if (!this.isAvailable) {
      const available = await this.initialize();
      if (!available) return false;
    }

    try {
      // Request permission for reading step data
      const permissions = await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'Steps' }
      ]);
      
      // Check if we received the permission by seeing if any were granted
      return permissions.length > 0;
    } catch (error) {
      console.error('Error requesting Health Connect permissions:', error);
      return false;
    }
  }

  /**
   * Get the total step count for today
   */
  async getTodayStepCount(): Promise<number> {
    if (!this.isAvailable) {
      const available = await this.initialize();
      if (!available) return 0;
    }

    try {
      // Make sure we have permission
      const hasPermission = await this.requestStepCountPermission();
      if (!hasPermission) {
        console.warn('No permission to access step count data');
        return 0;
      }

      // Create time range for today (midnight to now)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Read step count records using the correct function signature
      const stepsResult = await HealthConnect.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: today.toISOString(),
          endTime: new Date().toISOString()
        }
      });

      // Sum up all step counts from the result
      let totalSteps = 0;
      
      // Safely process the records
      if (stepsResult && stepsResult.records && Array.isArray(stepsResult.records)) {
        for (const record of stepsResult.records) {
          // We need to use a type guard to safely access properties
          if (record && typeof record === 'object' && 'count' in record) {
            totalSteps += Number(record.count) || 0;
          }
        }
      }

      console.log('Retrieved daily step count:', totalSteps);
      return totalSteps;
    } catch (error) {
      console.error('Error getting daily step count:', error);
      return 0;
    }
  }

  /**
   * Open Health Connect settings or app store if needed
   */
  async openHealthConnectSettings(): Promise<void> {
    // Make sure we've initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // This will open Health Connect settings if available
      // If not available, it might direct to the Play Store
      await HealthConnect.openHealthConnectSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
      throw error; // Let the caller handle this error
    }
  }
}

export const healthConnectService = HealthConnectService.getInstance();