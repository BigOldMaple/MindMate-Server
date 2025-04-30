// server/routes/healthData.ts
import express from 'express';
import { auth } from '../services/auth';
import { healthDataSyncService } from '../services/healthDataSyncService';
import { HealthData } from '../Database/HealthDataSchema';
import { Types } from 'mongoose';
import { ApiError } from '../middleware/error';
import { DeviceToken } from '../Database/DeviceTokenSchema';
import { healthTestingService } from '../services/healthTestingService';

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
  _id?: Types.ObjectId;
}

interface HealthDataSummary {
  totalSteps?: number;
  totalDistanceMeters?: number;
  totalSleepSeconds?: number;
  totalExerciseSeconds?: number;
  exerciseCount?: number;
}

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = auth.verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to calculate ISO week number
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

// Sync health data
router.post('/sync', authenticateToken, async (req: any, res) => {
  try {
    const healthData = req.body;

    // Validate the request body
    if (!healthData) {
      return res.status(400).json({ error: 'Health data is required' });
    }

    // Process and save the health data
    const result = await healthDataSyncService.saveHealthData(req.userId, healthData);

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Health data sync error:', error);
    res.status(500).json({ error: 'Failed to sync health data' });
  }
});

// Sync multiple days of health data
router.post('/sync-multiple', authenticateToken, async (req: any, res) => {
  try {
    const { days } = req.body;

    if (!days || typeof days !== 'object') {
      return res.status(400).json({ error: 'Health data is required in the format {days: {...}}' });
    }

    console.log(`Received health data for ${Object.keys(days).length} days`);

    // Track stats
    const stats = {
      totalDays: Object.keys(days).length,
      processed: 0,
      updated: {
        steps: 0,
        distance: 0,
        sleep: 0,
        exercise: 0
      },
      errors: 0
    };

    // Process each day's data
    for (const dateStr of Object.keys(days)) {
      const dayData = days[dateStr];

      try {
        stats.processed++;

        // Convert date string to Date object (assumes YYYY-MM-DD format)
        const recordDate = new Date(`${dateStr}T00:00:00.000Z`);
        
        // Find or create the document for this day
        let dayRecord = await HealthData.findOne({
          userId: new Types.ObjectId(req.userId),
          date: recordDate
        });
        
        if (!dayRecord) {
          // Create new document for this day
          dayRecord = new HealthData({
            userId: new Types.ObjectId(req.userId),
            date: recordDate,
            weekNumber: getWeekNumber(recordDate),
            month: recordDate.getMonth(),
            year: recordDate.getFullYear(),
            exercises: [],
            summary: {
              totalSteps: 0,
              totalDistanceMeters: 0,
              totalSleepSeconds: 0,
              totalExerciseSeconds: 0,
              exerciseCount: 0
            },
            lastSyncedAt: new Date()
          });
        }

        // Process steps data if available
        if (dayData.steps) {
          const { count, startTime, endTime, dataOrigins } = dayData.steps;
          
          dayRecord.steps = {
            count,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            dataSource: dataOrigins?.join(', ') || 'unknown'
          };
          
          if (dayRecord.summary) {
            dayRecord.summary.totalSteps = count;
          }
          
          stats.updated.steps++;
        }

        // Process distance data if available
        if (dayData.distance) {
          const { inMeters, inKilometers, startTime, endTime, dataOrigins } = dayData.distance;
          
          dayRecord.distance = {
            inMeters,
            inKilometers,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            dataSource: dataOrigins?.join(', ') || 'unknown'
          };
          
          if (dayRecord.summary) {
            dayRecord.summary.totalDistanceMeters = inMeters;
          }
          
          stats.updated.distance++;
        }

        // Process sleep data if available
        if (dayData.sleep) {
          const { startTime, endTime, durationInSeconds, quality, dataOrigins } = dayData.sleep;
          
          dayRecord.sleep = {
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            durationInSeconds,
            quality,
            dataSource: dataOrigins?.join(', ') || 'unknown'
          };
          
          if (dayRecord.summary) {
            dayRecord.summary.totalSleepSeconds = durationInSeconds;
          }
          
          stats.updated.sleep++;
        }

        // Process exercise data if available
        if (dayData.exercise) {
          const { type, startTime, endTime, durationInSeconds, calories, distance, dataOrigins } = dayData.exercise;
          
          // Create exercise object
          const exerciseObj: Exercise = {
            type,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            durationInSeconds,
            calories,
            distance,
            dataSource: dataOrigins?.join(', ') || 'unknown'
          };
          
          // Check if this exercise already exists
          const existingIndex = dayRecord.exercises.findIndex((ex: Exercise) => 
            ex.startTime.getTime() === new Date(startTime).getTime());
          
          if (existingIndex >= 0) {
            // Update existing exercise
            dayRecord.exercises[existingIndex] = exerciseObj;
          } else {
            // Add new exercise
            dayRecord.exercises.push(exerciseObj);
          }
          
          // Update exercise summary
          if (dayRecord.summary) {
            dayRecord.summary.totalExerciseSeconds = dayRecord.exercises.reduce(
              (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
            );
            dayRecord.summary.exerciseCount = dayRecord.exercises.length;
          }
          
          stats.updated.exercise++;
        }

        // Save the updated record
        dayRecord.lastSyncedAt = new Date();
        await dayRecord.save();

      } catch (error) {
        console.error(`Error processing data for day ${dateStr}:`, error);
        stats.errors++;
      }
    }

    // Update last sync time for the user's devices
    await DeviceToken.updateMany(
      { userId: new Types.ObjectId(req.userId) },
      { $set: { 'metadata.lastHealthSync': new Date() } }
    );

    // Create a message summarizing what was done
    const updatedTotal = stats.updated.steps + stats.updated.distance + stats.updated.sleep + stats.updated.exercise;
    
    const message = `Successfully processed ${stats.processed} days of health data. ` +
      `Updated ${updatedTotal} metrics (Steps: ${stats.updated.steps}, Distance: ${stats.updated.distance}, ` +
      `Sleep: ${stats.updated.sleep}, Exercise: ${stats.updated.exercise}).`;
    
    // Change success flag to be false if there were any errors
    const success = stats.errors === 0;
    
    res.status(200).json({ 
      success,
      message, 
      stats 
    });
  } catch (error) {
    console.error('Multiple health data sync error:', error);
    res.status(500).json({ error: 'Failed to sync health data' });
  }
});

// Get the last sync time
router.get('/last-sync', authenticateToken, async (req: any, res) => {
  try {
    const lastSyncTime = await healthDataSyncService.getLastSyncTime(req.userId);

    res.json({
      lastSyncTime,
      message: lastSyncTime
        ? `Last sync was at ${lastSyncTime.toISOString()}`
        : 'No sync history found'
    });
  } catch (error) {
    console.error('Error getting last sync time:', error);
    res.status(500).json({ error: 'Failed to get last sync time' });
  }
});

// Get aggregated health data
router.get('/aggregate', authenticateToken, async (req: any, res) => {
  try {
    const { startDate, endDate, aggregateBy } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Validate aggregation type
    const validAggregationTypes = ['daily', 'weekly', 'monthly'];
    const aggregationType = aggregateBy || 'daily';

    if (!validAggregationTypes.includes(aggregationType)) {
      return res.status(400).json({
        error: `Invalid aggregation type. Must be one of: ${validAggregationTypes.join(', ')}`
      });
    }

    // Get aggregated data
    const data = await healthDataSyncService.getAggregatedHealthData(
      req.userId,
      new Date(startDate),
      new Date(endDate),
      aggregationType as 'daily' | 'weekly' | 'monthly'
    );

    res.json(data);
  } catch (error) {
    console.error('Error getting aggregated health data:', error);
    res.status(500).json({ error: 'Failed to get aggregated health data' });
  }
});

// Get recent health data for a specific data type (compatibile with previous API)
router.get('/recent/:dataType', authenticateToken, async (req: any, res) => {
  try {
    const { dataType } = req.params;
    const { limit = 10 } = req.query;

    // Validate data type
    const validDataTypes = ['steps', 'distance', 'sleep', 'exercise'];

    if (!validDataTypes.includes(dataType)) {
      return res.status(400).json({
        error: `Invalid data type. Must be one of: ${validDataTypes.join(', ')}`
      });
    }

    // Set up the query conditions based on the new schema
    const conditions: any = {
      userId: new Types.ObjectId(req.userId)
    };
    
    // Only include documents that have the requested data type
    if (dataType === 'exercise') {
      conditions.exercises = { $exists: true, $ne: [] };
    } else {
      conditions[dataType] = { $exists: true };
    }

    // Fetch recent data
    const recentData = await HealthData.find(conditions)
      .sort({ date: -1 })
      .limit(parseInt(limit as string))
      .lean();

    // Format the data to be compatible with the old API
    let formattedData;
    
    if (dataType === 'exercise') {
      // For exercise, expand each exercise session into its own record
      formattedData = [];
      
      for (const dayRecord of recentData) {
        // Each exercise session becomes its own record
        for (const exercise of dayRecord.exercises || []) {
          formattedData.push({
            _id: exercise._id || dayRecord._id,
            userId: dayRecord.userId,
            date: dayRecord.date,
            year: dayRecord.year,
            month: dayRecord.month,
            weekNumber: dayRecord.weekNumber,
            dataType: 'exercise',
            exerciseData: exercise,
            lastSyncedAt: dayRecord.lastSyncedAt
          });
        }
      }
    } else {
      // For other data types, create a record for each day
      formattedData = recentData.map(dayRecord => ({
        _id: dayRecord._id,
        userId: dayRecord.userId,
        date: dayRecord.date,
        year: dayRecord.year,
        month: dayRecord.month,
        weekNumber: dayRecord.weekNumber,
        dataType,
        [`${dataType}Data`]: dayRecord[dataType],
        lastSyncedAt: dayRecord.lastSyncedAt
      }));
    }

    res.json(formattedData);
  } catch (error) {
    console.error(`Error getting recent ${req.params.dataType} data:`, error);
    res.status(500).json({ error: `Failed to get recent ${req.params.dataType} data` });
  }
});

// Get all recent health data
router.get('/recent', authenticateToken, async (req: any, res) => {
  try {
    const { limit = 10 } = req.query;

    // Fetch recent data with all metrics
    const recentData = await HealthData.find({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ date: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json(recentData);
  } catch (error) {
    console.error('Error getting recent health data:', error);
    res.status(500).json({ error: 'Failed to get recent health data' });
  }
});

// Delete a health data record
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid health data ID');
    }

    // Find the record
    const record = await HealthData.findOne({
      _id: id,
      userId: new Types.ObjectId(req.userId)
    });

    if (!record) {
      throw new ApiError(404, 'Health data record not found');
    }

    // Delete the record
    await record.deleteOne();

    res.json({ message: 'Health data record deleted successfully' });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Error deleting health data:', error);
      res.status(500).json({ error: 'Failed to delete health data' });
    }
  }
});

// Delete a specific metric from a day's record
router.delete('/:id/metric/:metricType', authenticateToken, async (req: any, res) => {
  try {
    const { id, metricType } = req.params;

    // Validate ID
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid health data ID');
    }

    // Validate metric type
    const validMetricTypes = ['steps', 'distance', 'sleep'];

    if (!validMetricTypes.includes(metricType) && metricType !== 'exercise') {
      return res.status(400).json({
        error: `Invalid metric type. Must be one of: ${[...validMetricTypes, 'exercise'].join(', ')}`
      });
    }

    // Find the record
    const record = await HealthData.findOne({
      _id: id,
      userId: new Types.ObjectId(req.userId)
    });

    if (!record) {
      throw new ApiError(404, 'Health data record not found');
    }

    // Handle exercise differently since it's an array
    if (metricType === 'exercise') {
      const { exerciseId } = req.query;
      
      if (!exerciseId) {
        // Remove all exercises
        record.exercises = [];
        
        // Update summary
        if (record.summary) {
          record.summary.totalExerciseSeconds = 0;
          record.summary.exerciseCount = 0;
        }
      } else {
        // Remove the specific exercise from the array
        const exerciseIndex = record.exercises.findIndex((ex: Exercise) => ex._id?.toString() === exerciseId);
        
        if (exerciseIndex === -1) {
          throw new ApiError(404, 'Exercise not found');
        }
        
        record.exercises.splice(exerciseIndex, 1);
        
        // Update summary
        if (record.summary) {
          record.summary.totalExerciseSeconds = record.exercises.reduce(
            (total: number, ex: Exercise) => total + ex.durationInSeconds, 0
          );
          record.summary.exerciseCount = record.exercises.length;
        }
      }
    } else {
      // For other metrics, simply remove the field
      record[metricType] = undefined;
      
      // Update summary
      if (record.summary) {
        switch (metricType) {
          case 'steps':
            record.summary.totalSteps = 0;
            break;
          case 'distance':
            record.summary.totalDistanceMeters = 0;
            break;
          case 'sleep':
            record.summary.totalSleepSeconds = 0;
            break;
        }
      }
    }

    // Save the updated record
    record.lastSyncedAt = new Date();
    await record.save();

    res.json({ message: `${metricType} data deleted successfully` });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Error deleting metric data:', error);
      res.status(500).json({ error: 'Failed to delete metric data' });
    }
  }
});

// Generate test data
router.post('/generate-test-data', authenticateToken, async (req: any, res) => {
  try {
    const { pattern, startDate, days } = req.body;

    // Validate required parameters
    if (!pattern || !startDate || !days) {
      return res.status(400).json({ 
        error: 'Pattern, start date, and number of days are required' 
      });
    }

    // Validate pattern
    const validPatterns = ['good', 'declining', 'critical', 'improving', 'fluctuating'];
    if (!validPatterns.includes(pattern)) {
      return res.status(400).json({
        error: `Invalid pattern. Must be one of: ${validPatterns.join(', ')}`
      });
    }

    // Generate the test data
    const result = await healthTestingService.generateTestData({
      pattern,
      startDate,
      days,
      userId: req.userId
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error generating test data:', error);
    res.status(500).json({ error: 'Failed to generate test data' });
  }
});

// Clear test data
router.post('/clear-test-data', authenticateToken, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    // Clear the test data
    const result = await healthTestingService.clearTestData(
      req.userId,
      startDate,
      endDate
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error clearing test data:', error);
    res.status(500).json({ error: 'Failed to clear test data' });
  }
});

export default router;