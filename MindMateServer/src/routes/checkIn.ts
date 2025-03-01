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
      console.log('No previous check-in found, user can check in');
      
      // Create a notification that check-in is available
      const { Notification } = require('../Database/NotificationSchema');
      
      // Find any existing "Check-In Available" notifications from the last 24 hours
      const existingNotification = await Notification.findOne({
        userId: req.userId,
        type: 'wellness',
        title: 'Check-In Available',
        time: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      // Only create a notification if one doesn't exist in the last 24 hours
      if (!existingNotification) {
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
        console.log('Created initial check-in available notification');
      }
      
      return res.json({ 
        canCheckIn: true,
        notificationCreated: !existingNotification
      });
    }

    const now = new Date();
    const timeSinceLastCheckIn = now.getTime() - lastCheckIn.timestamp.getTime();
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // For demo purposes, you could use a shorter cooldown
    // const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeSinceLastCheckIn < cooldownPeriod) {
      // User is in cooldown, cannot check in
      const nextCheckInTime = new Date(lastCheckIn.timestamp.getTime() + cooldownPeriod);
      
      // Update device metadata to indicate cooldown
      const { DeviceToken } = require('../Database/DeviceTokenSchema');
      await DeviceToken.updateMany(
        { userId: req.userId },
        { 
          $set: { 
            'metadata.checkInCooldown': true,
            'metadata.lastCheckIn': lastCheckIn.timestamp
          }
        }
      );
      
      return res.json({
        canCheckIn: false,
        nextCheckInTime
      });
    }
    
    // Cooldown is over, user can check in
    // When transitioning from cooldown to available, create a notification
    console.log('Cooldown period is over, creating check-in available notification');
    
    const { DeviceToken } = require('../Database/DeviceTokenSchema');
    const { Notification } = require('../Database/NotificationSchema');
    
    // Reset the cooldown flag for all user devices
    await DeviceToken.updateMany(
      { userId: req.userId },
      { $set: { 'metadata.checkInCooldown': false } }
    );
    
    // Find any existing unread Check-In Available notifications
    const existingNotification = await Notification.findOne({
      userId: req.userId,
      type: 'wellness',
      title: 'Check-In Available',
      read: false
    });
    
    // Only create a notification if one doesn't exist
    if (!existingNotification) {
      // Create a notification that check-in is now available
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
      
      res.json({ 
        canCheckIn: true,
        notificationCreated: true,
        notificationId: notification._id
      });
    } else {
      res.json({ 
        canCheckIn: true,
        notificationCreated: false
      });
    }
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
    
    // Clear any existing "Check-In Available" or "Check-In Complete" notifications
    const { Notification } = require('../Database/NotificationSchema');
    await Notification.deleteMany({
      userId: req.userId,
      type: 'wellness',
      title: { $in: ['Check-In Available', 'Check-In Available Soon', 'Check-In Complete'] }
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