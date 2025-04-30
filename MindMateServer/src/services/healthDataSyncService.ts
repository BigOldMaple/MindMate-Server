// services/healthDataSyncService.ts

import { HealthData } from '../Database/HealthDataSchema';
import { Types } from 'mongoose';
import { DeviceToken } from '../Database/DeviceTokenSchema';

// Define interfaces for type safety
interface Exercise {
  type: string;
  startTime: Date;
  endTime: Date;
  durationInSeconds: number;
  calories?: number;
  distance?: {
    inMeters?: number;
    inKilometers?: number;
  };
  dataSource?: string;
}

interface HealthDataSync {
  steps?: {
    count: number;
    startTime: string;
    endTime: string;
    dataOrigins?: string[];
  };
  distance?: {
    inMeters: number;
    inKilometers: number;
    startTime: string;
    endTime: string;
    dataOrigins?: string[];
  };
  sleep?: {
    startTime: string;
    endTime: string;
    durationInSeconds: number;
    quality?: string;
    dataOrigins?: string[];
  };
  exercise?: {
    type: string;
    startTime: string;
    endTime: string;
    durationInSeconds: number;
    calories?: number;
    distance?: {
      inMeters?: number;
      inKilometers?: number;
    };
    dataOrigins?: string[];
  };
}

// Helper function to calculate ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

class HealthDataSyncService {
  /**
   * Save health data received from the mobile app
   */
  async saveHealthData(userId: string, healthData: HealthDataSync): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Receiving health data sync for user ${userId}`);
      
      // Track what was successfully saved
      const saved = {
        steps: false,
        distance: false,
        sleep: false,
        exercise: false
      };

      // Process steps data
      if (healthData.steps) {
        await this.processStepsData(userId, healthData.steps);
        saved.steps = true;
      }

      // Process distance data
      if (healthData.distance) {
        await this.processDistanceData(userId, healthData.distance);
        saved.distance = true;
      }

      // Process sleep data
      if (healthData.sleep) {
        await this.processSleepData(userId, healthData.sleep);
        saved.sleep = true;
      }

      // Process exercise data
      if (healthData.exercise) {
        await this.processExerciseData(userId, healthData.exercise);
        saved.exercise = true;
      }

      // Update the last health sync time for the user's devices
      await DeviceToken.updateMany(
        { userId: new Types.ObjectId(userId) },
        { $set: { 'metadata.lastHealthSync': new Date() } }
      );

      // Generate success message
      const savedTypes = Object.entries(saved)
        .filter(([_, isSaved]) => isSaved)
        .map(([type]) => type);
      
      return {
        success: savedTypes.length > 0,
        message: savedTypes.length > 0 
          ? `Successfully saved health data: ${savedTypes.join(', ')}` 
          : 'No health data saved'
      };
    } catch (error) {
      console.error('Error saving health data:', error);
      return {
        success: false,
        message: `Failed to save health data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process steps data and save to the day-centric model
   */
  private async processStepsData(userId: string, stepsData: any): Promise<void> {
    const { count, startTime, endTime, dataOrigins } = stepsData;
    const startDate = new Date(startTime);
    
    // Create a record date (midnight of the day the data belongs to)
    const recordDate = new Date(startDate);
    recordDate.setHours(0, 0, 0, 0);

    // Prepare steps data
    const steps = {
      count,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      dataSource: dataOrigins?.join(', ') || 'unknown'
    };

    // Try to update existing document first
    const result = await HealthData.findOneAndUpdate(
      { 
        userId: new Types.ObjectId(userId),
        date: recordDate
      },
      {
        $set: { 
          steps,
          'summary.totalSteps': count,
          lastSyncedAt: new Date()
        }
      },
      { new: true }
    );

    if (result) {
      // Existing document was updated
      if (!result.summary) {
        // Initialize summary if it doesn't exist
        await HealthData.updateOne(
          { _id: result._id },
          { 
            $set: { 
              summary: {
                totalSteps: count,
                totalDistanceMeters: result.distance?.inMeters || 0,
                totalSleepSeconds: result.sleep?.durationInSeconds || 0,
                totalExerciseSeconds: result.exercises?.reduce(
                  (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
                ) || 0,
                exerciseCount: result.exercises?.length || 0
              }
            }
          }
        );
      }
    } else {
      // No existing document - create a new one
      await HealthData.create({
        userId: new Types.ObjectId(userId),
        date: recordDate,
        weekNumber: getWeekNumber(recordDate),
        month: recordDate.getMonth(),
        year: recordDate.getFullYear(),
        steps,
        exercises: [], // Initialize empty array
        summary: {
          totalSteps: count,
          totalDistanceMeters: 0,
          totalSleepSeconds: 0,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        lastSyncedAt: new Date()
      });
    }
  }

  /**
   * Process distance data and save to the day-centric model
   */
  private async processDistanceData(userId: string, distanceData: any): Promise<void> {
    const { inMeters, inKilometers, startTime, endTime, dataOrigins } = distanceData;
    const startDate = new Date(startTime);
    
    // Create a record date (midnight of the day the data belongs to)
    const recordDate = new Date(startDate);
    recordDate.setHours(0, 0, 0, 0);

    // Prepare distance data
    const distance = {
      inMeters,
      inKilometers,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      dataSource: dataOrigins?.join(', ') || 'unknown'
    };

    // Try to update existing document first
    const result = await HealthData.findOneAndUpdate(
      { 
        userId: new Types.ObjectId(userId),
        date: recordDate
      },
      {
        $set: { 
          distance,
          'summary.totalDistanceMeters': inMeters,
          lastSyncedAt: new Date()
        }
      },
      { new: true }
    );

    if (result) {
      // Existing document was updated
      if (!result.summary) {
        // Initialize summary if it doesn't exist
        await HealthData.updateOne(
          { _id: result._id },
          { 
            $set: { 
              summary: {
                totalSteps: result.steps?.count || 0,
                totalDistanceMeters: inMeters,
                totalSleepSeconds: result.sleep?.durationInSeconds || 0,
                totalExerciseSeconds: result.exercises?.reduce(
                  (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
                ) || 0,
                exerciseCount: result.exercises?.length || 0
              }
            }
          }
        );
      }
    } else {
      // No existing document - create a new one
      await HealthData.create({
        userId: new Types.ObjectId(userId),
        date: recordDate,
        weekNumber: getWeekNumber(recordDate),
        month: recordDate.getMonth(),
        year: recordDate.getFullYear(),
        distance,
        exercises: [], // Initialize empty array
        summary: {
          totalSteps: 0,
          totalDistanceMeters: inMeters,
          totalSleepSeconds: 0,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        lastSyncedAt: new Date()
      });
    }
  }

  /**
   * Process sleep data and save to the day-centric model
   */
  private async processSleepData(userId: string, sleepData: any): Promise<void> {
    const { startTime, endTime, durationInSeconds, quality, dataOrigins } = sleepData;
    
    // Sleep should be attributed to the day the person woke up (end time)
    const endDate = new Date(endTime);
    const recordDate = new Date(endDate);
    recordDate.setHours(0, 0, 0, 0);

    // Prepare sleep data
    const sleep = {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationInSeconds,
      quality,
      dataSource: dataOrigins?.join(', ') || 'unknown'
    };

    // Try to update existing document first
    const result = await HealthData.findOneAndUpdate(
      { 
        userId: new Types.ObjectId(userId),
        date: recordDate
      },
      {
        $set: { 
          sleep,
          'summary.totalSleepSeconds': durationInSeconds,
          lastSyncedAt: new Date()
        }
      },
      { new: true }
    );

    if (result) {
      // Existing document was updated
      if (!result.summary) {
        // Initialize summary if it doesn't exist
        await HealthData.updateOne(
          { _id: result._id },
          { 
            $set: { 
              summary: {
                totalSteps: result.steps?.count || 0,
                totalDistanceMeters: result.distance?.inMeters || 0,
                totalSleepSeconds: durationInSeconds,
                totalExerciseSeconds: result.exercises?.reduce(
                  (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
                ) || 0,
                exerciseCount: result.exercises?.length || 0
              }
            }
          }
        );
      }
    } else {
      // No existing document - create a new one
      await HealthData.create({
        userId: new Types.ObjectId(userId),
        date: recordDate,
        weekNumber: getWeekNumber(recordDate),
        month: recordDate.getMonth(),
        year: recordDate.getFullYear(),
        sleep,
        exercises: [], // Initialize empty array
        summary: {
          totalSteps: 0,
          totalDistanceMeters: 0,
          totalSleepSeconds: durationInSeconds,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        lastSyncedAt: new Date()
      });
    }
  }

  /**
   * Process exercise data and save to the day-centric model
   */
  private async processExerciseData(userId: string, exerciseData: any): Promise<void> {
    const { type, startTime, endTime, durationInSeconds, calories, distance, dataOrigins } = exerciseData;
    
    // Exercise is attributed to the day it started
    const startDate = new Date(startTime);
    const recordDate = new Date(startDate);
    recordDate.setHours(0, 0, 0, 0);

    // Prepare exercise data object
    const exerciseObj: Exercise = {
      type,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationInSeconds,
      calories,
      distance,
      dataSource: dataOrigins?.join(', ') || 'unknown'
    };

    // Find the document for this day
    const dailyRecord = await HealthData.findOne({
      userId: new Types.ObjectId(userId),
      date: recordDate
    });

    if (dailyRecord) {
      // Check if this exercise already exists (by start time)
      const existingExerciseIndex = dailyRecord.exercises.findIndex((ex: Exercise) => 
        ex.startTime.getTime() === new Date(startTime).getTime()
      );

      if (existingExerciseIndex >= 0) {
        // Update existing exercise
        dailyRecord.exercises[existingExerciseIndex] = exerciseObj;
      } else {
        // Add new exercise
        dailyRecord.exercises.push(exerciseObj);
      }

      // Update summary
      if (!dailyRecord.summary) {
        dailyRecord.summary = {};
      }
      
      // Calculate total exercise seconds and count
      const totalExerciseSeconds = dailyRecord.exercises.reduce(
        (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
      );
      
      dailyRecord.summary.totalExerciseSeconds = totalExerciseSeconds;
      dailyRecord.summary.exerciseCount = dailyRecord.exercises.length;
      dailyRecord.lastSyncedAt = new Date();
      
      await dailyRecord.save();
    } else {
      // Create new record with the exercise
      await HealthData.create({
        userId: new Types.ObjectId(userId),
        date: recordDate,
        weekNumber: getWeekNumber(recordDate),
        month: recordDate.getMonth(),
        year: recordDate.getFullYear(),
        exercises: [exerciseObj],
        summary: {
          totalSteps: 0,
          totalDistanceMeters: 0,
          totalSleepSeconds: 0,
          totalExerciseSeconds: durationInSeconds,
          exerciseCount: 1
        },
        lastSyncedAt: new Date()
      });
    }
  }

  /**
   * Get aggregated health data for a time range
   */
  async getAggregatedHealthData(
    userId: string,
    startDate: Date,
    endDate: Date,
    aggregateBy: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    try {
      // Format dates to midnight to ensure complete day coverage
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      // Base match condition for the query
      const matchStage = {
        userId: new Types.ObjectId(userId),
        date: { $gte: start, $lte: end }
      };
      
      // Determine group ID based on aggregation type
      let groupId;
      
      if (aggregateBy === 'daily') {
        groupId = { 
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        };
      } else if (aggregateBy === 'weekly') {
        groupId = { 
          year: '$year',
          week: '$weekNumber'
        };
      } else {
        groupId = { 
          year: '$year',
          month: '$month'
        };
      }
      
      // Get aggregated data - now using day-centric model
      const aggregatedData = await HealthData.aggregate([
        { $match: matchStage },
        { 
          $group: {
            _id: groupId,
            totalSteps: { $sum: '$summary.totalSteps' },
            totalDistanceMeters: { $sum: '$summary.totalDistanceMeters' },
            totalSleepSeconds: { $sum: '$summary.totalSleepSeconds' },
            totalExerciseSeconds: { $sum: '$summary.totalExerciseSeconds' },
            totalExerciseCount: { $sum: '$summary.exerciseCount' },
            days: { $count: {} },
            firstDate: { $min: '$date' },
            lastDate: { $max: '$date' }
          }
        },
        { $sort: { firstDate: 1 } }
      ]);
      
      // Format the results based on aggregation type
      return {
        aggregateBy,
        data: aggregatedData.map(item => ({
          period: this.formatPeriod(item._id, aggregateBy),
          totalSteps: item.totalSteps || 0,
          totalDistanceKm: (item.totalDistanceMeters / 1000) || 0,
          totalSleepHours: (item.totalSleepSeconds / 3600) || 0,
          totalExerciseMinutes: (item.totalExerciseSeconds / 60) || 0,
          exerciseCount: item.totalExerciseCount || 0,
          days: item.days,
          startDate: item.firstDate,
          endDate: item.lastDate
        }))
      };
    } catch (error) {
      console.error('Error getting aggregated health data:', error);
      throw error;
    }
  }

  /**
   * Format period identifier based on aggregation type
   */
  private formatPeriod(idObj: any, aggregateBy: 'daily' | 'weekly' | 'monthly') {
    if (aggregateBy === 'daily') {
      return `${idObj.year}-${String(idObj.month).padStart(2, '0')}-${String(idObj.day).padStart(2, '0')}`;
    } else if (aggregateBy === 'weekly') {
      return `${idObj.year}-W${String(idObj.week).padStart(2, '0')}`;
    } else {
      return `${idObj.year}-${String(idObj.month).padStart(2, '0')}`;
    }
  }

  /**
   * Get the timestamp of the last sync for a user
   */
  async getLastSyncTime(userId: string): Promise<Date | null> {
    try {
      const latestRecord = await HealthData.findOne({ 
        userId: new Types.ObjectId(userId) 
      })
      .sort({ lastSyncedAt: -1 })
      .limit(1);
      
      return latestRecord ? latestRecord.lastSyncedAt : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }
}

export const healthDataSyncService = new HealthDataSyncService();