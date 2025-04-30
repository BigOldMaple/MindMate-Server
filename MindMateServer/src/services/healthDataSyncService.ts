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
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
  /**
 * Generate test health data with a specific pattern
 */
  async generateTestData(
    userId: string,
    pattern: string,
    startDate: Date,
    days: number
  ): Promise<{
    success: boolean;
    message: string;
    metrics: {
      daysGenerated: number;
      sleepRecords: number;
      activityRecords: number;
      checkIns: number;
    };
  }> {
    try {
      console.log(`[TestData] Generating ${pattern} test data for user ${userId}, ${days} days from ${startDate.toISOString()}`);

      let sleepRecords = 0;
      let activityRecords = 0;
      let checkInRecords = 0;

      // Generate data for each day
      for (let i = 0; i < days; i++) {
        // Calculate the current day (startDate + i days)
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        // Set to midnight for consistency
        currentDate.setHours(0, 0, 0, 0);

        // Generate data based on the selected pattern
        const dayData = this.generateDayData(pattern, currentDate, i, days);

        // Insert sleep data if available
        if (dayData.sleep) {
          await this.insertTestSleepData(userId, currentDate, dayData.sleep);
          sleepRecords++;
        }

        // Insert activity data if available
        if (dayData.activity) {
          await this.insertTestActivityData(userId, currentDate, dayData.activity);
          activityRecords++;
        }

        // Insert check-in data if available
        if (dayData.checkIn) {
          await this.insertTestCheckInData(userId, currentDate, dayData.checkIn);
          checkInRecords++;
        }
      }

      return {
        success: true,
        message: `Successfully generated ${pattern} test data for ${days} days`,
        metrics: {
          daysGenerated: days,
          sleepRecords,
          activityRecords,
          checkIns: checkInRecords
        }
      };
    } catch (error) {
      console.error('[TestData] Error generating test data:', error);
      throw error;
    }
  }

  /**
   * Generate data for a specific day based on the pattern
   */
  private generateDayData(pattern: string, date: Date, dayIndex: number, totalDays: number): {
    sleep?: {
      startTime: Date;
      endTime: Date;
      quality: 'poor' | 'fair' | 'good';
    };
    activity?: {
      steps: number;
      activeMinutes: number;
    };
    checkIn?: {
      mood: number;
      note?: string;
    };
  } {
    // Base values that will be modified according to pattern
    let sleepHours = 7.5;
    let sleepQuality: 'poor' | 'fair' | 'good' = 'good';
    let steps = 8000;
    let activeMinutes = 45;
    let mood = 4;
    let note: string | undefined = undefined;

    // Calculate progress through the date range (0.0 to 1.0)
    const progress = dayIndex / (totalDays - 1 || 1); // Prevent division by zero if totalDays is 1

    // Apply randomization factor to add variation
    const randomFactor = () => (Math.random() * 0.2) - 0.1; // -10% to +10%

    switch (pattern) {
      case 'good':
        // Good pattern: stable positive metrics
        sleepHours = 7.5 + (Math.random() * 1.0);
        sleepQuality = Math.random() > 0.2 ? 'good' : 'fair';
        steps = 8000 + (Math.random() * 4000);
        activeMinutes = 45 + (Math.random() * 20);
        mood = 4 + (Math.random() * 0.8);

        // Sometimes add positive notes
        if (Math.random() > 0.6) {
          const goodNotes = [
            "Feeling great today!",
            "Had a productive day",
            "Enjoyed time with friends",
            "Feeling energized and motivated",
            "Had a good workout session"
          ];
          note = goodNotes[Math.floor(Math.random() * goodNotes.length)];
        }
        break;

      case 'declining':
        // Declining pattern: gradually worsening metrics
        sleepHours = 7.5 - (progress * 3) + randomFactor();
        sleepQuality = progress > 0.7 ? 'poor' : (progress > 0.3 ? 'fair' : 'good');
        steps = 8000 - (progress * 5000) + (Math.random() * 1000);
        activeMinutes = 45 - (progress * 30) + (Math.random() * 10);
        mood = 4 - (progress * 2.5) + randomFactor();

        // Add increasingly negative notes
        if (progress > 0.4 && Math.random() > 0.4) {
          const decliningNotes = [
            "Feeling a bit tired today",
            "Had trouble falling asleep",
            "Not very motivated",
            "Feeling somewhat stressed",
            "Didn't have much energy today",
            "Feeling a bit down"
          ];
          note = decliningNotes[Math.floor(Math.random() * decliningNotes.length)];
        }
        break;

      case 'critical':
        // Critical pattern: consistently poor metrics
        sleepHours = 4 + (Math.random() * 1.5);
        sleepQuality = 'poor';
        steps = 2000 + (Math.random() * 1500);
        activeMinutes = 10 + (Math.random() * 10);
        mood = 1.5 + (Math.random() * 0.8);

        // Add negative notes
        if (Math.random() > 0.3) {
          const criticalNotes = [
            "Feeling very tired and low energy",
            "Had a terrible night's sleep",
            "No motivation to do anything today",
            "Feeling overwhelmed and anxious",
            "Everything feels like too much effort",
            "Just want to stay in bed all day",
            "Feeling hopeless"
          ];
          note = criticalNotes[Math.floor(Math.random() * criticalNotes.length)];
        }
        break;

      case 'improving':
        // Improving pattern: gradually improving metrics
        sleepHours = 5 + (progress * 3) + randomFactor();
        sleepQuality = progress < 0.3 ? 'poor' : (progress < 0.7 ? 'fair' : 'good');
        steps = 3000 + (progress * 7000) + (Math.random() * 1000);
        activeMinutes = 15 + (progress * 40) + (Math.random() * 10);
        mood = 2 + (progress * 2.5) + randomFactor();

        // Add increasingly positive notes
        if (Math.random() > 0.4) {
          const improvingNotes = [
            "Feeling a bit better today",
            "Sleep was a little better",
            "Had some energy to go for a walk",
            "Made an effort to be active",
            "Mood is gradually improving",
            "Starting to feel more like myself"
          ];
          note = improvingNotes[Math.floor(Math.random() * improvingNotes.length)];
        }
        break;

      case 'fluctuating':
        // Fluctuating pattern: unpredictable ups and downs
        const fluctuation = Math.sin(dayIndex * 0.8) * 0.5 + randomFactor() * 2;
        sleepHours = 6.5 + (fluctuation * 2);
        sleepQuality = fluctuation < -0.3 ? 'poor' : (fluctuation > 0.3 ? 'good' : 'fair');
        steps = 5000 + (fluctuation * 4000) + (Math.random() * 2000);
        activeMinutes = 30 + (fluctuation * 25) + (Math.random() * 15);
        mood = 3 + fluctuation + randomFactor();

        // Add varying notes
        if (Math.random() > 0.5) {
          const fluctuatingNotes = fluctuation > 0 ?
            [
              "Feeling better than yesterday",
              "Had a good day today",
              "Energy levels are up today",
              "Mood has improved from yesterday"
            ] :
            [
              "Not feeling great today",
              "Energy levels are down",
              "Mood has dipped compared to yesterday",
              "Feeling more stressed today"
            ];
          note = fluctuatingNotes[Math.floor(Math.random() * fluctuatingNotes.length)];
        }
        break;
    }

    // Ensure values are within reasonable bounds
    sleepHours = Math.max(3, Math.min(10, sleepHours));
    steps = Math.max(1000, Math.min(15000, steps));
    activeMinutes = Math.max(5, Math.min(120, activeMinutes));
    mood = Math.max(1, Math.min(5, mood));

    // Convert sleep hours to start/end times
    const sleepStart = new Date(date);
    sleepStart.setDate(sleepStart.getDate() - 1); // Sleep started the day before
    sleepStart.setHours(23, 0, 0, 0); // Assuming sleep started at 11 PM

    const sleepEnd = new Date(date);
    sleepEnd.setHours(7, 0, 0, 0); // Base wake-up time at 7 AM

    // Adjust end time based on sleep hours
    const sleepMinutes = Math.round(sleepHours * 60);
    sleepEnd.setMinutes(sleepMinutes - (24 - 23) * 60); // Adjust from 11 PM start

    return {
      sleep: {
        startTime: sleepStart,
        endTime: sleepEnd,
        quality: sleepQuality
      },
      activity: {
        steps: Math.round(steps),
        activeMinutes: Math.round(activeMinutes)
      },
      checkIn: {
        mood: parseFloat(mood.toFixed(1)),
        note
      }
    };
  }

  /**
   * Insert test sleep data for a specific day
   */
  private async insertTestSleepData(userId: string, date: Date, sleepData: { startTime: Date; endTime: Date; quality: string }): Promise<void> {
    try {
      const { HealthData } = require('../Database/HealthDataSchema');

      // Set up sleep record with proper fields
      const sleepRecord = {
        startTime: sleepData.startTime,
        endTime: sleepData.endTime,
        durationInSeconds: Math.round((sleepData.endTime.getTime() - sleepData.startTime.getTime()) / 1000),
        quality: sleepData.quality,
        dataSource: 'test-data-generator'
      };

      // Check if a record already exists for this date
      let record = await HealthData.findOne({
        userId: new Types.ObjectId(userId),
        date: date
      });

      if (record) {
        // Update existing record
        record.sleep = sleepRecord;
        if (record.summary) {
          record.summary.totalSleepSeconds = sleepRecord.durationInSeconds;
        } else {
          record.summary = {
            totalSteps: 0,
            totalDistanceMeters: 0,
            totalSleepSeconds: sleepRecord.durationInSeconds,
            totalExerciseSeconds: 0,
            exerciseCount: 0
          };
        }
        record.lastSyncedAt = new Date();
        await record.save();
      } else {
        // Create new record
        const weekNumber = this.getWeekNumber(date);
        record = new HealthData({
          userId: new Types.ObjectId(userId),
          date: date,
          weekNumber,
          month: date.getMonth(),
          year: date.getFullYear(),
          sleep: sleepRecord,
          exercises: [],
          summary: {
            totalSteps: 0,
            totalDistanceMeters: 0,
            totalSleepSeconds: sleepRecord.durationInSeconds,
            totalExerciseSeconds: 0,
            exerciseCount: 0
          },
          lastSyncedAt: new Date()
        });
        await record.save();
      }
    } catch (error) {
      console.error('[TestData] Error inserting test sleep data:', error);
      throw error;
    }
  }

  /**
   * Insert test activity data for a specific day
   */
  private async insertTestActivityData(userId: string, date: Date, activityData: { steps: number; activeMinutes: number }): Promise<void> {
    try {
      const { HealthData } = require('../Database/HealthDataSchema');

      // Calculate distance based on steps (rough approximation)
      const distanceInMeters = activityData.steps * 0.762; // Average stride length

      // Set up activity data
      const stepsData = {
        count: activityData.steps,
        startTime: new Date(new Date(date).setHours(8, 0, 0, 0)), // Start at 8 AM
        endTime: new Date(new Date(date).setHours(20, 0, 0, 0)),  // End at 8 PM
        dataSource: 'test-data-generator'
      };

      const distanceData = {
        inMeters: distanceInMeters,
        inKilometers: distanceInMeters / 1000,
        startTime: new Date(new Date(date).setHours(8, 0, 0, 0)),
        endTime: new Date(new Date(date).setHours(20, 0, 0, 0)),
        dataSource: 'test-data-generator'
      };

      // Exercise records based on active minutes
      const exercises = [];
      if (activityData.activeMinutes > 0) {
        const exerciseStart = new Date(new Date(date).setHours(17, 0, 0, 0)); // 5 PM
        const exerciseEnd = new Date(exerciseStart);
        exerciseEnd.setTime(exerciseStart.getTime() + (activityData.activeMinutes * 60 * 1000));

        exercises.push({
          type: Math.random() > 0.5 ? 'walking' : 'running',
          startTime: exerciseStart,
          endTime: exerciseEnd,
          durationInSeconds: activityData.activeMinutes * 60,
          calories: activityData.activeMinutes * 7, // Rough estimate
          dataSource: 'test-data-generator'
        });
      }

      // Check if a record already exists for this date
      let record = await HealthData.findOne({
        userId: new Types.ObjectId(userId),
        date: date
      });

      if (record) {
        // Update existing record
        record.steps = stepsData;
        record.distance = distanceData;
        record.exercises = exercises;

        if (record.summary) {
          record.summary.totalSteps = activityData.steps;
          record.summary.totalDistanceMeters = distanceInMeters;
          record.summary.totalExerciseSeconds = activityData.activeMinutes * 60;
          record.summary.exerciseCount = exercises.length;
        } else {
          record.summary = {
            totalSteps: activityData.steps,
            totalDistanceMeters: distanceInMeters,
            totalSleepSeconds: 0,
            totalExerciseSeconds: activityData.activeMinutes * 60,
            exerciseCount: exercises.length
          };
        }

        record.lastSyncedAt = new Date();
        await record.save();
      } else {
        // Create new record
        const weekNumber = this.getWeekNumber(date);
        record = new HealthData({
          userId: new Types.ObjectId(userId),
          date: date,
          weekNumber,
          month: date.getMonth(),
          year: date.getFullYear(),
          steps: stepsData,
          distance: distanceData,
          exercises,
          summary: {
            totalSteps: activityData.steps,
            totalDistanceMeters: distanceInMeters,
            totalSleepSeconds: 0,
            totalExerciseSeconds: activityData.activeMinutes * 60,
            exerciseCount: exercises.length
          },
          lastSyncedAt: new Date()
        });
        await record.save();
      }
    } catch (error) {
      console.error('[TestData] Error inserting test activity data:', error);
      throw error;
    }
  }

  /**
   * Insert test check-in data for a specific day
   */
  private async insertTestCheckInData(userId: string, date: Date, checkInData: { mood: number; note?: string }): Promise<void> {
    try {
      const { CheckIn } = require('../Database/CheckInSchema');

      // Get mood label based on score
      let moodLabel = 'Neutral';
      if (checkInData.mood <= 1.5) moodLabel = 'Very Low';
      else if (checkInData.mood <= 2.5) moodLabel = 'Low';
      else if (checkInData.mood <= 3.5) moodLabel = 'Neutral';
      else if (checkInData.mood <= 4.5) moodLabel = 'Good';
      else moodLabel = 'Very Good';

      // Create check-in at a random time between 8 AM and 10 PM
      const checkInTime = new Date(date);
      const randomHour = 8 + Math.floor(Math.random() * 14); // 8 AM to 10 PM
      const randomMinute = Math.floor(Math.random() * 60);
      checkInTime.setHours(randomHour, randomMinute, 0, 0);

      // Create check-in record
      const checkIn = new CheckIn({
        userId: new Types.ObjectId(userId),
        timestamp: checkInTime,
        mood: {
          score: checkInData.mood,
          label: moodLabel,
          description: checkInData.note
        },
        activities: [],
        notes: checkInData.note
      });

      await checkIn.save();
    } catch (error) {
      console.error('[TestData] Error inserting test check-in data:', error);
      throw error;
    }
  }

  /**
   * Clear test data for a specific date range
   */
  async clearTestData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; message: string; deletedRecords: { healthData: number; checkIns: number } }> {
    try {
      console.log(`[TestData] Clearing test data for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const { HealthData } = require('../Database/HealthDataSchema');
      const { CheckIn } = require('../Database/CheckInSchema');

      // Delete health data
      const healthDataResult = await HealthData.deleteMany({
        userId: new Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        $or: [
          { 'sleep.dataSource': 'test-data-generator' },
          { 'steps.dataSource': 'test-data-generator' }
        ]
      });

      // Delete check-ins
      const checkInResult = await CheckIn.deleteMany({
        userId: new Types.ObjectId(userId),
        timestamp: { $gte: startDate, $lte: endDate }
      });

      return {
        success: true,
        message: `Successfully cleared test data for the specified date range`,
        deletedRecords: {
          healthData: healthDataResult.deletedCount || 0,
          checkIns: checkInResult.deletedCount || 0
        }
      };
    } catch (error) {
      console.error('[TestData] Error clearing test data:', error);
      throw error;
    }
  }
}



export const healthDataSyncService = new HealthDataSyncService();