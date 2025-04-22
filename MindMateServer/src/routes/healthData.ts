// server/routes/healthData.ts
import express from 'express';
import { auth } from '../services/auth';
import { healthDataSyncService } from '../services/healthDataSyncService';
import { HealthData } from '../Database/HealthDataSchema';
import { Types } from 'mongoose';
import { ApiError } from '../middleware/error';

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

export default router;