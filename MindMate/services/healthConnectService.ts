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
    if (this.isInitialized) {
      console.log('Health Connect already initialized, availability:', this.isAvailable);
      return this.isAvailable;
    }
  
    console.log('Initializing Health Connect...');
    try {
      const isAvailable = await HealthConnect.initialize();
      console.log('Health Connect initialized successfully:', isAvailable);
      this.isAvailable = isAvailable;
      this.isInitialized = true;
      return isAvailable;
    } catch (error) {
      console.error('Error initializing Health Connect:', error);
      this.isAvailable = false;
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Request permission to access step count data
   */
  async requestStepCountPermission(): Promise<boolean> {
    console.log('Starting requestStepCountPermission...');
  
    if (!this.isInitialized) {
      console.log('Health Connect not initialized, initializing now...');
      await this.initialize();
    }
  
    if (!this.isAvailable) {
      console.warn('Health Connect not available after initialization');
      return false;
    }
  
    // Add a small delay to ensure the native module is ready
    await new Promise(resolve => setTimeout(resolve, 500));
  
    try {
      console.log('Calling HealthConnect.requestPermission...');
      const permissions = await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
      ]);
      console.log('Permissions response:', permissions);
      return permissions.length > 0;
    } catch (error) {
      console.error('Error in requestStepCountPermission:', error);
      return false;
    }
  }

  /**
   * Get the total step count for today
   */
  async getTodayStepCount(): Promise<number> {
    console.log('Starting getTodayStepCount...');
  
    if (!this.isAvailable) {
      console.log('Health Connect not available, attempting to initialize...');
      const available = await this.initialize();
      if (!available) {
        console.warn('Health Connect not available after initialization');
        return 0;
      }
    }
  
    try {
      console.log('Requesting step count permission...');
      const hasPermission = await this.requestStepCountPermission();
      if (!hasPermission) {
        console.warn('No permission to access step count data');
        return 0;
      }
  
      console.log('Creating time range for today...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      console.log('Reading step count records...');
      const stepsResult = await HealthConnect.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: today.toISOString(),
          endTime: new Date().toISOString(),
        },
      });
  
      console.log('Steps result:', JSON.stringify(stepsResult));
  
      let totalSteps = 0;
      if (stepsResult?.records?.length > 0) {
        totalSteps = stepsResult.records.reduce((sum, record) => {
          return sum + (Number(record.count) || 0);
        }, 0);
      }
  
      console.log('Total steps calculated:', totalSteps);
      return totalSteps;
    } catch (error) {
      console.error('Error in getTodayStepCount:', error);
      throw error; // Re-throw to let fetchStepData handle it
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