import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords
} from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

interface StepRecord {
  count: number;
  // Other properties that might exist in a step record
  startTime?: string;
  endTime?: string;
}

const useHealthData = (date: Date) => {
  const [steps, setSteps] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Android - Health Connect
  const readStepData = async () => {
    // Reset states on each data fetch
    setIsLoading(true);
    setError(null);

    try {
      // Initialize the client
      const isInitialized = await initialize();
      if (!isInitialized) {
        setError('Failed to initialize Health Connect');
        return;
      }
      
      // Request permissions without storing the result
      await requestPermission([
        { accessType: 'read', recordType: 'Steps' }
      ]);
      
      // Create time range for the specified date (full day)
      const dateObj = new Date(date);
      const timeRangeFilter: TimeRangeFilter = {
        operator: 'between',
        startTime: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0).toISOString(),
        endTime: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999).toISOString(),
      };
      
      // Read step records
      const { records } = await readRecords('Steps', { timeRangeFilter });
      
      // Calculate total steps
      const totalSteps = records.reduce(
        (sum: number, cur: StepRecord) => sum + cur.count, 
        0
      );
      
      setSteps(totalSteps);
    } catch (error) {
      console.error('Error reading step data:', error);
      setError('Failed to read step data from Health Connect');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    readStepData();
  }, [date]);

  return {
    steps,
    isLoading,
    error,
    refreshSteps: readStepData
  };
};

export default useHealthData;