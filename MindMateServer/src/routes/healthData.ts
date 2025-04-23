// server/routes/healthData.ts
import express from 'express';
import { auth } from '../services/auth';
import { healthDataSyncService } from '../services/healthDataSyncService';
import { HealthData } from '../Database/HealthDataSchema';
import { Types } from 'mongoose';
import { ApiError } from '../middleware/error';
import { DeviceToken } from '../Database/DeviceTokenSchema';

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
      created: {
        steps: 0,
        distance: 0,
        sleep: 0,
        exercise: 0
      },
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

        // Process steps data if available
        if (dayData.steps) {
          const result = await processStepsData(req.userId, recordDate, dayData.steps);
          if (result.created) {
            stats.created.steps++;
          } else if (result.updated) {
            stats.updated.steps++;
          }
        }

        // Process distance data if available
        if (dayData.distance) {
          const result = await processDistanceData(req.userId, recordDate, dayData.distance);
          if (result.created) {
            stats.created.distance++;
          } else if (result.updated) {
            stats.updated.distance++;
          }
        }

        // Process sleep data if available
        if (dayData.sleep) {
          const result = await processSleepData(req.userId, recordDate, dayData.sleep);
          if (result.created) {
            stats.created.sleep++;
          } else if (result.updated) {
            stats.updated.sleep++;
          }
        }

        // Process exercise data if available
        if (dayData.exercise) {
          const result = await processExerciseData(req.userId, recordDate, dayData.exercise);
          if (result.created) {
            stats.created.exercise++;
          } else if (result.updated) {
            stats.updated.exercise++;
          }
        }
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
    const createdTotal = stats.created.steps + stats.created.distance + stats.created.sleep + stats.created.exercise;
    const updatedTotal = stats.updated.steps + stats.updated.distance + stats.updated.sleep + stats.updated.exercise;
    
    const message = `Successfully processed ${stats.processed} days of health data. ` +
      `Created ${createdTotal} new records and updated ${updatedTotal} existing records.`;
    
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

// Get recent raw health data
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

    // Fetch recent data
    const recentData = await HealthData.find({
      userId: new Types.ObjectId(req.userId),
      dataType
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

// Helper functions to process each type of health data

// Below are the modified processing functions:
async function processStepsData(userId: string, date: Date, stepsData: any) {
  // Generate a unique original ID for deduplication
  const originalId = `steps_${userId}_${date.toISOString().split('T')[0]}`;

  // Calculate required fields
  const year = date.getFullYear();
  const month = date.getMonth();

  // Calculate ISO week number
  const d = new Date(Date.UTC(year, month, date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Check if record already exists
  const existingRecord = await HealthData.findOne({
    userId: new Types.ObjectId(userId),
    dataType: 'steps',
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    }
  });

  if (existingRecord) {
    // Update existing record if count changed
    if (existingRecord.stepsData?.count !== stepsData.count) {
      existingRecord.stepsData.count = stepsData.count;
      existingRecord.lastSyncedAt = new Date();
      await existingRecord.save();
      return { updated: true };
    }
    return { updated: false };
  } else {
    // Create new record with explicitly set fields
    await HealthData.create({
      userId: new Types.ObjectId(userId),
      dataType: 'steps',
      date,
      year,         // Added explicit value
      month,        // Added explicit value
      weekNumber,   // Added explicit value
      stepsData: {
        count: stepsData.count,
        startTime: new Date(stepsData.startTime),
        endTime: new Date(stepsData.endTime),
        dataSource: stepsData.dataOrigins?.join(', ') || 'unknown'
      },
      lastSyncedAt: new Date(),
      originalId
    });
    return { created: true };
  }
}

async function processDistanceData(userId: string, date: Date, distanceData: any) {
  // Generate a unique original ID for deduplication
  const originalId = `distance_${userId}_${date.toISOString().split('T')[0]}`;

  // Calculate required fields
  const year = date.getFullYear();
  const month = date.getMonth();

  // Calculate ISO week number
  const d = new Date(Date.UTC(year, month, date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Check if record already exists
  const existingRecord = await HealthData.findOne({
    userId: new Types.ObjectId(userId),
    dataType: 'distance',
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    }
  });

  if (existingRecord) {
    // Update existing record if distance changed
    if (existingRecord.distanceData?.distance.inMeters !== distanceData.inMeters) {
      existingRecord.distanceData.distance.inMeters = distanceData.inMeters;
      existingRecord.distanceData.distance.inKilometers = distanceData.inKilometers;
      existingRecord.lastSyncedAt = new Date();
      await existingRecord.save();
      return { updated: true };
    }
    return { updated: false };
  } else {
    // Create new record with explicitly set fields
    await HealthData.create({
      userId: new Types.ObjectId(userId),
      dataType: 'distance',
      date,
      year,         // Added explicit value
      month,        // Added explicit value
      weekNumber,   // Added explicit value
      distanceData: {
        distance: {
          inMeters: distanceData.inMeters,
          inKilometers: distanceData.inKilometers
        },
        startTime: new Date(distanceData.startTime),
        endTime: new Date(distanceData.endTime),
        dataSource: distanceData.dataOrigins?.join(', ') || 'unknown'
      },
      lastSyncedAt: new Date(),
      originalId
    });
    return { created: true };
  }
}

async function processSleepData(userId: string, date: Date, sleepData: any) {
  // Generate a unique original ID for deduplication
  const originalId = `sleep_${userId}_${date.toISOString().split('T')[0]}`;

  // Calculate required fields
  const year = date.getFullYear();
  const month = date.getMonth();

  // Calculate ISO week number
  const d = new Date(Date.UTC(year, month, date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Check if record already exists
  const existingRecord = await HealthData.findOne({
    userId: new Types.ObjectId(userId),
    dataType: 'sleep',
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    }
  });

  if (existingRecord) {
    // Update existing record if duration changed
    if (existingRecord.sleepData?.durationInSeconds !== sleepData.durationInSeconds) {
      existingRecord.sleepData.durationInSeconds = sleepData.durationInSeconds;
      existingRecord.sleepData.quality = sleepData.quality;
      existingRecord.sleepData.startTime = new Date(sleepData.startTime);
      existingRecord.sleepData.endTime = new Date(sleepData.endTime);
      existingRecord.lastSyncedAt = new Date();
      await existingRecord.save();
      return { updated: true };
    }
    return { updated: false };
  } else {
    // Create new record with explicitly set fields
    await HealthData.create({
      userId: new Types.ObjectId(userId),
      dataType: 'sleep',
      date,
      year,         // Added explicit value
      month,        // Added explicit value
      weekNumber,   // Added explicit value
      sleepData: {
        startTime: new Date(sleepData.startTime),
        endTime: new Date(sleepData.endTime),
        durationInSeconds: sleepData.durationInSeconds,
        quality: sleepData.quality,
        dataSource: sleepData.dataOrigins?.join(', ') || 'unknown'
      },
      lastSyncedAt: new Date(),
      originalId
    });
    return { created: true };
  }
}

async function processExerciseData(userId: string, date: Date, exerciseData: any) {
  // Generate a unique original ID for deduplication
  const originalId = `exercise_${userId}_${exerciseData.type}_${date.toISOString().split('T')[0]}`;
  
  // Calculate required fields
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Calculate ISO week number
  const d = new Date(Date.UTC(year, month, date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  
  // Check if record already exists
  const existingRecord = await HealthData.findOne({ 
    userId: new Types.ObjectId(userId),
    dataType: 'exercise',
    date: { 
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()), 
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    },
    // Remove object path querying since exerciseData is stored as a string
    // 'exerciseData.type': exerciseData.type 
  });
  
  if (existingRecord) {
    // We need to parse the string back to an object for comparison
    let existingExerciseData;
    try {
      existingExerciseData = JSON.parse(existingRecord.exerciseData as string);
    } catch (err) {
      // If parsing fails, assume data is different
      existingExerciseData = { durationInSeconds: 0 };
    }
    
    // Update existing record if duration changed
    if (existingExerciseData.durationInSeconds !== exerciseData.durationInSeconds) {
      // Create updated data and stringify it
      const updatedData = {
        type: exerciseData.type,
        startTime: new Date(exerciseData.startTime),
        endTime: new Date(exerciseData.endTime),
        durationInSeconds: exerciseData.durationInSeconds,
        calories: exerciseData.calories,
        distance: exerciseData.distance,
        dataSource: exerciseData.dataOrigins?.join(', ') || 'unknown'
      };
      
      existingRecord.exerciseData = JSON.stringify(updatedData);
      existingRecord.lastSyncedAt = new Date();
      await existingRecord.save();
      return { updated: true };
    }
    return { updated: false };
  } else {
    // Create new record with explicitly set fields
    const exerciseDataObj = {
      type: exerciseData.type,
      startTime: new Date(exerciseData.startTime),
      endTime: new Date(exerciseData.endTime),
      durationInSeconds: exerciseData.durationInSeconds,
      calories: exerciseData.calories,
      distance: exerciseData.distance,
      dataSource: exerciseData.dataOrigins?.join(', ') || 'unknown'
    };
    
    await HealthData.create({
      userId: new Types.ObjectId(userId),
      dataType: 'exercise',
      date,
      year,
      month,
      weekNumber,
      // Convert object to string for storage
      exerciseData: JSON.stringify(exerciseDataObj),
      lastSyncedAt: new Date(),
      originalId
    });
    return { created: true };
  }
}

export default router;