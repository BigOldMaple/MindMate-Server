// server/routes/checkIn.ts
import express from 'express';
import { CheckIn } from '../Database/CheckInSchema';
import { auth } from '../services/auth';

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

// Submit a new check-in
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { mood, activities, notes } = req.body;

    const checkIn = new CheckIn({
      userId: req.userId,
      mood,
      activities,
      notes,
      timestamp: new Date()
    });

    await checkIn.save();

    res.status(201).json({
      message: 'Check-in submitted successfully',
      checkIn
    });
  } catch (error) {
    console.error('Submit check-in error:', error);
    res.status(500).json({ error: 'Failed to submit check-in' });
  }
});

// Get recent check-ins
router.get('/recent', authenticateToken, async (req: any, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const checkIns = await CheckIn.find({
      userId: req.userId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: -1 });

    res.json(checkIns);
  } catch (error) {
    console.error('Get recent check-ins error:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const lastCheckIn = await CheckIn.findOne(
      { userId: req.userId },
      {},
      { sort: { timestamp: -1 } }
    );

    if (!lastCheckIn) {
      return res.json({ canCheckIn: true });
    }

    const now = new Date();
    const timeSinceLastCheckIn = now.getTime() - lastCheckIn.timestamp.getTime();
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (timeSinceLastCheckIn < cooldownPeriod) {
      const nextCheckInTime = new Date(lastCheckIn.timestamp.getTime() + cooldownPeriod);
      return res.json({
        canCheckIn: false,
        nextCheckInTime
      });
    }

    res.json({ canCheckIn: true });
  } catch (error) {
    console.error('Get check-in status error:', error);
    res.status(500).json({ error: 'Failed to get check-in status' });
  }
});

// DEVELOPER OPTION: Reset the check-in timer -------------------------------------------------
router.post('/reset-timer', authenticateToken, async (req: any, res) => {
  try {
    // Delete the most recent check-in for testing
    await CheckIn.findOneAndDelete(
      { userId: req.userId },
      { sort: { timestamp: -1 } }
    );
    
    res.json({ message: 'Check-in timer reset successfully' });
  } catch (error) {
    console.error('Reset check-in timer error:', error);
    res.status(500).json({ error: 'Failed to reset check-in timer' });
  }
});
// --------------------------------------------------------------------------------------------

// Get check-in statistics
router.get('/stats', authenticateToken, async (req: any, res) => {
  try {
    const pipeline = [
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: null,
          averageMood: { $avg: '$mood.score' },
          totalCheckIns: { $sum: 1 },
          moodDistribution: {
            $push: '$mood.score'
          },
          activityLevels: {
            $push: '$activities'
          }
        }
      }
    ];

    const stats = await CheckIn.aggregate(pipeline);

    if (stats.length === 0) {
      return res.json({
        averageMood: 0,
        totalCheckIns: 0,
        moodDistribution: [],
        activityLevels: []
      });
    }

    // Process the mood distribution
    const moodDistribution = stats[0].moodDistribution.reduce((acc: any, score: number) => {
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});

    // Process activity levels
    const activityStats = stats[0].activityLevels.flat().reduce((acc: any, activity: any) => {
      if (!acc[activity.type]) {
        acc[activity.type] = { low: 0, moderate: 0, high: 0 };
      }
      acc[activity.type][activity.level]++;
      return acc;
    }, {});

    res.json({
      averageMood: Math.round(stats[0].averageMood * 10) / 10,
      totalCheckIns: stats[0].totalCheckIns,
      moodDistribution,
      activityStats
    });
  } catch (error) {
    console.error('Get check-in stats error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in statistics' });
  }
});

export default router;