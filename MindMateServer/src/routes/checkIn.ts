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

    // Create the check-in
    const checkIn = new CheckIn({
      userId: req.userId,
      mood,
      activities,
      notes,
      timestamp: new Date()
    });

    await checkIn.save();

    // After successful check-in submission, clear any existing "Check-In Available" notifications
    // to prevent notification spam during cooldown
    const { Notification } = require('../Database/NotificationSchema');
    await Notification.deleteMany({
      userId: req.userId,
      type: 'wellness',
      title: 'Check-In Available',
      read: false
    });

    // Set a flag in the database to indicate that we're in a cooldown period
    // This helps prevent duplicate notifications
    const { DeviceToken } = require('../Database/DeviceTokenSchema');
    await DeviceToken.updateMany(
      { userId: req.userId },
      { $set: { 'metadata.checkInCooldown': true, 'metadata.lastCheckIn': new Date() } }
    );

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
    
    // For demo purposes, you could use a shorter cooldown
    // const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeSinceLastCheckIn < cooldownPeriod) {
      // User is in cooldown, cannot check in
      const nextCheckInTime = new Date(lastCheckIn.timestamp.getTime() + cooldownPeriod);
      
      // DO NOT create a notification while in cooldown period unless approaching the end
      // Only check if we're within the last 30 seconds of cooldown
      const timeUntilAvailable = cooldownPeriod - timeSinceLastCheckIn;
      const isApproachingAvailability = timeUntilAvailable < 30000; // 30 seconds
      
      if (isApproachingAvailability) {
        const { Notification } = require('../Database/NotificationSchema');
        const { DeviceToken } = require('../Database/DeviceTokenSchema');
        
        // Check if we already sent a notification for this cooldown period
        const existingNotification = await Notification.findOne({
          userId: req.userId,
          type: 'wellness',
          title: 'Check-In Available',
          time: { $gt: lastCheckIn.timestamp }
        });
        
        // Also check device metadata to see if we're in a cooldown period
        const deviceWithCooldown = await DeviceToken.findOne({
          userId: req.userId,
          'metadata.checkInCooldown': true,
          'metadata.lastCheckIn': { $gte: lastCheckIn.timestamp }
        });
        
        // Only create notification if one doesn't exist and we're not in a cooldown
        if (!existingNotification && !deviceWithCooldown) {
          console.log('Creating check-in available notification (approaching availability)');
          
          // Schedule a notification for when the cooldown ends
          const notification = new Notification({
            userId: req.userId,
            type: 'wellness',
            title: 'Check-In Available Soon',
            message: 'Your next check-in will be available in less than 30 seconds',
            read: false,
            time: now,
            actionable: false
          });
          
          await notification.save();
          
          // Update all device tokens to mark notification as sent
          await DeviceToken.updateMany(
            { userId: req.userId },
            { 
              $set: { 
                'metadata.lastNotification': now 
              }
            }
          );
        }
      }
      
      return res.json({
        canCheckIn: false,
        nextCheckInTime
      });
    }
    
    // Cooldown is over, user can check in
    // When transitioning from cooldown to available, create a notification
    const { DeviceToken } = require('../Database/DeviceTokenSchema');
    
    // Find any devices that still have the cooldown flag set
    const devicesInCooldown = await DeviceToken.find({
      userId: req.userId,
      'metadata.checkInCooldown': true
    });
    
    if (devicesInCooldown.length > 0) {
      // Reset the cooldown flag
      await DeviceToken.updateMany(
        { userId: req.userId },
        { $set: { 'metadata.checkInCooldown': false } }
      );
      
      // Create a notification that check-in is now available
      const { Notification } = require('../Database/NotificationSchema');
      const notification = new Notification({
        userId: req.userId,
        type: 'wellness',
        title: 'Check-In Available',
        message: 'Your next check-in is now available. How are you feeling today?',
        read: false,
        time: now,
        actionable: true,
        actionRoute: '/home/check_in'
      });
      
      await notification.save();
      console.log('Created check-in available notification (cooldown ended)');
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
    
    // Reset cooldown flags on all devices
    const { DeviceToken } = require('../Database/DeviceTokenSchema');
    await DeviceToken.updateMany(
      { userId: req.userId },
      { $set: { 'metadata.checkInCooldown': false } }
    );
    
    // Clear any existing "Check-In Available" notifications
    const { Notification } = require('../Database/NotificationSchema');
    await Notification.deleteMany({
      userId: req.userId,
      type: 'wellness',
      title: { $in: ['Check-In Available', 'Check-In Available Soon'] }
    });
    
    // Create a fresh notification that the check-in is now available
    const notification = new Notification({
      userId: req.userId,
      type: 'wellness',
      title: 'Check-In Available',
      message: 'Your next check-in is now available. How are you feeling today?',
      read: false,
      time: new Date(),
      actionable: true,
      actionRoute: '/home/check_in'
    });

    await notification.save();
    
    // Add a flag to trigger an immediate local notification on the device
    res.json({ 
      message: 'Check-in timer reset successfully',
      notification: {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        shouldTriggerLocalNotification: true // This flag tells the app to show a local notification
      }
    });
  } catch (error) {
    console.error('Reset check-in timer error:', error);
    res.status(500).json({ error: 'Failed to reset check-in timer' });
  }
});

export default router;