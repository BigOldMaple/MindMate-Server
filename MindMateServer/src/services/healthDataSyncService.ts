// server/services/healthDataSyncService.ts
import { HealthData } from '../Database/HealthDataSchema';
import { Types } from 'mongoose';
import { DeviceToken } from '../Database/DeviceTokenSchema';

// Helper function to calculate ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface HealthDataSync {
  steps?: {
    count: number;
    startTime: string;
    endTime: string;
    dataOrigins: string[];
  };
  distance?: {
    inMeters: number;
    inKilometers: number;
    startTime: string;
    endTime: string;
    dataOrigins: string[];
  };
  sleep?: {
    startTime: string;
    endTime: string;
    durationInSeconds: number;
    quality: string;
    stages?: Array<{
      stageType: string;
      startTime: string;
      endTime: string;
      durationInSeconds: number;
    }>;
    dataOrigins: string[];
  };
  exercise?: {
    type: string;
    startTime: string;
    endTime: string;
    durationInSeconds: number;
    calories?: number;
    distance?: {
      inMeters: number;
      inKilometers: number;
    };
    dataOrigins: string[];
  };
}

class HealthDataSyncService {
  /**
   * Save health data received from the mobile app
   * @param userId User ID
   * @param healthData Health data to save
   * @returns Result of the operation
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

      // First, check if we have synced historical data before
      // If we've synced data for a week or more in the past, we'll assume historical sync is complete
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const hasHistoricalData = await HealthData.exists({
        userId: new Types.ObjectId(userId),
        date: { $lt: oneWeekAgo }
      });
      
      // If we have historical data, only update today's records
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Save steps data if provided
      if (healthData.steps) {
        const { count, startTime, endTime, dataOrigins } = healthData.steps;
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        
        // Create a record date (midnight of the day the data belongs to)
        const recordDate = new Date(startDate);
        recordDate.setHours(0, 0, 0, 0);
        
        // If we have historical data and this isn't today's record, skip it
        if (hasHistoricalData && recordDate.getTime() < today.getTime()) {
          console.log(`Skipping historical steps data for ${recordDate.toISOString().split('T')[0]}`);
        } else {
          // Check if we already have a record for this day
          const existingRecord = await HealthData.findOne({
            userId: new Types.ObjectId(userId),
            dataType: 'steps',
            date: recordDate
          });
          
          if (!existingRecord) {
            // Create new record
            await HealthData.create({
              userId: new Types.ObjectId(userId),
              dataType: 'steps',
              date: recordDate,
              weekNumber: getWeekNumber(recordDate),
              month: recordDate.getMonth(),
              year: recordDate.getFullYear(),
              stepsData: {
                count,
                startTime: startDate,
                endTime: endDate,
                dataSource: dataOrigins?.join(', ') || 'unknown'
              },
              lastSyncedAt: new Date(),
              originalId: `steps_${userId}_${recordDate.toISOString().split('T')[0]}`
            });
            saved.steps = true;
          } else {
            // Update existing record
            existingRecord.stepsData.count = count;
            existingRecord.stepsData.startTime = startDate;
            existingRecord.stepsData.endTime = endDate;
            existingRecord.lastSyncedAt = new Date();
            await existingRecord.save();
            saved.steps = true;
          }
        }
      }

      // Save distance data if provided
      if (healthData.distance) {
        const { inMeters, inKilometers, startTime, endTime, dataOrigins } = healthData.distance;
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        
        // Create a record date (midnight of the day the data belongs to)
        const recordDate = new Date(startDate);
        recordDate.setHours(0, 0, 0, 0);
        
        // If we have historical data and this isn't today's record, skip it
        if (hasHistoricalData && recordDate.getTime() < today.getTime()) {
          console.log(`Skipping historical distance data for ${recordDate.toISOString().split('T')[0]}`);
        } else {
          // Check if we already have a record for this day
          const existingRecord = await HealthData.findOne({
            userId: new Types.ObjectId(userId),
            dataType: 'distance',
            date: recordDate
          });
          
          if (!existingRecord) {
            // Create new record
            await HealthData.create({
              userId: new Types.ObjectId(userId),
              dataType: 'distance',
              date: recordDate,
              weekNumber: getWeekNumber(recordDate),
              month: recordDate.getMonth(),
              year: recordDate.getFullYear(),
              distanceData: {
                distance: {
                  inMeters,
                  inKilometers
                },
                startTime: startDate,
                endTime: endDate,
                dataSource: dataOrigins?.join(', ') || 'unknown'
              },
              lastSyncedAt: new Date(),
              originalId: `distance_${userId}_${recordDate.toISOString().split('T')[0]}`
            });
            saved.distance = true;
          } else {
            // Update existing record
            if (existingRecord.distanceData && existingRecord.distanceData.distance) {
              existingRecord.distanceData.distance.inMeters = inMeters;
              existingRecord.distanceData.distance.inKilometers = inKilometers;
              existingRecord.distanceData.startTime = startDate;
              existingRecord.distanceData.endTime = endDate;
              existingRecord.lastSyncedAt = new Date();
              await existingRecord.save();
              saved.distance = true;
            }
          }
        }
      }

      // Save sleep data if provided
      if (healthData.sleep) {
        const { startTime, endTime, durationInSeconds, quality, stages, dataOrigins } = healthData.sleep;
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        
        // Sleep sessions often span multiple days, so use the date when the sleep session ended
        const recordDate = new Date(endDate);
        recordDate.setHours(0, 0, 0, 0);
        
        // If we have historical data and this isn't today's record, skip it
        if (hasHistoricalData && recordDate.getTime() < today.getTime()) {
          console.log(`Skipping historical sleep data for ${recordDate.toISOString().split('T')[0]}`);
        } else {
          // Check if we already have a record for this sleep session (using same day and duration)
          const existingRecord = await HealthData.findOne({
            userId: new Types.ObjectId(userId),
            dataType: 'sleep',
            date: recordDate,
            'sleepData.durationInSeconds': durationInSeconds
          });
          
          if (!existingRecord) {
            // Create new record
            await HealthData.create({
              userId: new Types.ObjectId(userId),
              dataType: 'sleep',
              date: recordDate,
              weekNumber: getWeekNumber(recordDate),
              month: recordDate.getMonth(),
              year: recordDate.getFullYear(),
              sleepData: {
                startTime: startDate,
                endTime: endDate,
                durationInSeconds,
                quality,
                stages: stages?.map(stage => ({
                  stageType: stage.stageType,
                  startTime: new Date(stage.startTime),
                  endTime: new Date(stage.endTime),
                  durationInSeconds: stage.durationInSeconds
                })),
                dataSource: dataOrigins?.join(', ') || 'unknown'
              },
              lastSyncedAt: new Date(),
              originalId: `sleep_${userId}_${recordDate.toISOString().split('T')[0]}_${durationInSeconds}`
            });
            saved.sleep = true;
          } else {
            // Sleep data doesn't typically change, so we don't need to update
            saved.sleep = true;
          }
        }
      }

      // Save exercise data if provided
      if (healthData.exercise) {
        try {
          const { type, startTime, endTime, durationInSeconds, calories, distance, dataOrigins } = healthData.exercise;
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          
          // Create a record date (midnight of the day the data belongs to)
          const recordDate = new Date(startDate);
          recordDate.setHours(0, 0, 0, 0);
          
          // If we have historical data and this isn't today's record, skip it
          if (hasHistoricalData && recordDate.getTime() < today.getTime()) {
            console.log(`Skipping historical exercise data for ${recordDate.toISOString().split('T')[0]}`);
          } else {
            // Check if we already have a record for this day and exercise type
            const existingRecord = await HealthData.findOne({
              userId: new Types.ObjectId(userId),
              dataType: 'exercise',
              date: recordDate,
              // We can't query inside a JSON string, so we'll check based on date only
            });
            
            // Create exercise data object
            const exerciseDataObj = {
              type,
              startTime: startDate,
              endTime: endDate,
              durationInSeconds,
              calories,
              distance: distance ? {
                inMeters: distance.inMeters,
                inKilometers: distance.inKilometers
              } : undefined,
              dataSource: dataOrigins?.join(', ') || 'unknown'
            };
            
            // Convert exercise data to string
            const exerciseDataString = JSON.stringify(exerciseDataObj);
            
            if (!existingRecord) {
              // Create new record
              await HealthData.create({
                userId: new Types.ObjectId(userId),
                dataType: 'exercise',
                date: recordDate,
                weekNumber: getWeekNumber(recordDate),
                month: recordDate.getMonth(),
                year: recordDate.getFullYear(),
                exerciseData: exerciseDataString,
                lastSyncedAt: new Date(),
                originalId: `exercise_${userId}_${type}_${recordDate.toISOString().split('T')[0]}`
              });
              saved.exercise = true;
            } else {
              // Update existing record
              existingRecord.exerciseData = exerciseDataString;
              existingRecord.lastSyncedAt = new Date();
              await existingRecord.save();
              saved.exercise = true;
            }
          }
        } catch (error) {
          console.error('Error saving exercise data:', error);
          // Continue with other data types even if exercise fails
        }
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

  // The rest of the methods remain the same
  // ...

  /**
   * Get aggregated health data for a user
   * @param userId User ID
   * @param startDate Start date for the query
   * @param endDate End date for the query
   * @param aggregateBy How to aggregate the data (daily, weekly, monthly)
   * @returns Aggregated health data
   */
  async getAggregatedHealthData(
    userId: string,
    startDate: Date,
    endDate: Date,
    aggregateBy: 'daily' | 'weekly' | 'monthly' = 'daily'
  ) {
    try {
      // Convert string dates to Date objects if needed
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      
      // Format dates to midnight to ensure complete day coverage
      start.setHours(0, 0, 0, 0);
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
      
      // Perform aggregation for steps
      const stepsAggregation = await HealthData.aggregate([
        { $match: { ...matchStage, dataType: 'steps' } },
        { 
          $group: {
            _id: groupId,
            totalSteps: { $sum: '$stepsData.count' },
            date: { $min: '$date' }, // Get the earliest date in the group for reference
            dataPoints: { $count: {} }
          }
        },
        { $sort: { date: 1 } }
      ]);
      
      // Perform aggregation for distance
      const distanceAggregation = await HealthData.aggregate([
        { $match: { ...matchStage, dataType: 'distance' } },
        { 
          $group: {
            _id: groupId,
            totalDistanceMeters: { $sum: '$distanceData.distance.inMeters' },
            date: { $min: '$date' },
            dataPoints: { $count: {} }
          }
        },
        { $sort: { date: 1 } }
      ]);
      
      // Perform aggregation for sleep
      // For sleep we want average duration and latest record per period
      const sleepAggregation = await HealthData.aggregate([
        { $match: { ...matchStage, dataType: 'sleep' } },
        { 
          $group: {
            _id: groupId,
            avgSleepDurationSeconds: { $avg: '$sleepData.durationInSeconds' },
            totalSleepDurationSeconds: { $sum: '$sleepData.durationInSeconds' },
            date: { $min: '$date' },
            dataPoints: { $count: {} }
          }
        },
        { $sort: { date: 1 } }
      ]);
      
      // For exercise data, we need to use a simpler approach since it's stored as a string
      // We'll just count the entries for now
      const exerciseAggregation = await HealthData.aggregate([
        { $match: { ...matchStage, dataType: 'exercise' } },
        { 
          $group: {
            _id: groupId,
            count: { $sum: 1 },
            date: { $min: '$date' }
          }
        },
        { $sort: { date: 1 } }
      ]);
      
      // Format the results based on aggregation type
      return {
        steps: stepsAggregation.map(item => ({
          period: this.formatPeriod(item._id, aggregateBy),
          totalSteps: item.totalSteps,
          dataPoints: item.dataPoints,
          date: item.date
        })),
        distance: distanceAggregation.map(item => ({
          period: this.formatPeriod(item._id, aggregateBy),
          totalDistanceMeters: item.totalDistanceMeters,
          totalDistanceKilometers: Math.round(item.totalDistanceMeters / 10) / 100, // Convert to km with 2 decimal places
          dataPoints: item.dataPoints,
          date: item.date
        })),
        sleep: sleepAggregation.map(item => ({
          period: this.formatPeriod(item._id, aggregateBy),
          avgSleepDurationHours: Math.round((item.avgSleepDurationSeconds / 3600) * 10) / 10, // Round to 1 decimal place
          totalSleepDurationHours: Math.round((item.totalSleepDurationSeconds / 3600) * 10) / 10,
          dataPoints: item.dataPoints,
          date: item.date
        })),
        exercise: exerciseAggregation.map(item => ({
          period: this.formatPeriod(item._id, aggregateBy),
          count: item.count,
          date: item.date
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
   * @param userId User ID
   * @returns Last sync timestamp or null if no sync has occurred
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