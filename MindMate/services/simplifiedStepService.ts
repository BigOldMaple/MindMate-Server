// services/simplifiedStepService.ts
import * as HealthConnect from 'react-native-health-connect';

export class StepService {
  // Initialize and check availability in one step
  async setup(): Promise<boolean> {
    try {
      return await HealthConnect.initialize();
    } catch (error) {
      console.error('Step tracking setup failed:', error);
      return false;
    }
  }

  // Simple permission request
  async requestPermission(): Promise<boolean> {
    try {
      const permissions = await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'Steps' }
      ]);
      return permissions.length > 0;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // Get today's steps
  async getTodaySteps(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const result = await HealthConnect.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: today.toISOString(),
          endTime: new Date().toISOString(),
        },
      });
      
      return result.records.reduce((sum, record) => 
        sum + (Number(record.count) || 0), 0);
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  }
}

export const stepService = new StepService();