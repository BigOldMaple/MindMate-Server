// server/routes/notifications.ts
import express from 'express';
import { Notification } from '../Database/NotificationSchema';
import { DeviceToken } from '../Database/DeviceTokenSchema';
import { auth } from '../services/auth';
import { ApiError } from '../middleware/error';
import { formatDistanceToNow } from '../utils/dateFormatter';
import { pushNotificationService } from '../services/pushNotificationService';
import { CheckIn } from '../Database/CheckInSchema';

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

// Create a new notification
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { type, title, message, actionable, actionRoute, actionParams } = req.body;
    
    if (!type || !title || !message) {
      return res.status(400).json({ error: 'Type, title, and message are required' });
    }
    
    const notification = new Notification({
      userId: req.userId,
      type,
      title,
      message,
      read: false,
      time: new Date(),
      actionable: actionable || false,
      actionRoute,
      actionParams
    });
    
    await notification.save();
    
    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get all notifications for the current user
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ time: -1 })
      .lean();

    // Format the time field to human-readable format
    const formattedNotifications = notifications.map(notification => ({
      ...notification,
      time: formatDistanceToNow(notification.time)
    }));

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark a notification as read
router.post('/:id/read', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      console.log(`Request to mark notification ${id} as read for user ${req.userId}`);
      
      // Validate the notification ID
      if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ error: 'Invalid notification ID' });
      }
  
      // Find the notification but don't require it to exist
      // This handles cases where the notification might have been deleted
      const notification = await Notification.findOne({
        _id: id,
        userId: req.userId
      });
  
      if (!notification) {
        console.log(`Notification ${id} not found for user ${req.userId}`);
        return res.status(404).json({ error: 'Notification not found' });
      }
  
      console.log(`Marking notification ${id} as read`);
      notification.read = true;
      await notification.save();
  
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

// Mark all notifications as read
router.post('/read-all', authenticateToken, async (req: any, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { $set: { read: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      userId: req.userId
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    await notification.deleteOne();

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }
});

// Register device for push notifications
router.post('/register-device', authenticateToken, async (req: any, res) => {
  try {
    const { token, platform, deviceId } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }

    // Check if token already exists and update it
    const existingToken = await DeviceToken.findOne({ token });

    if (existingToken) {
      existingToken.userId = req.userId;
      existingToken.platform = platform;
      if (deviceId) existingToken.deviceId = deviceId;
      existingToken.lastActive = new Date();
      await existingToken.save();

      return res.json({ message: 'Device token updated' });
    }

    // Create new token
    const deviceToken = new DeviceToken({
      userId: req.userId,
      token,
      platform,
      deviceId,
      lastActive: new Date()
    });

    await deviceToken.save();

    res.status(201).json({ message: 'Device registered for notifications' });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Create a check-in availability notification (triggered by the server)
router.post('/create-check-in-notification', authenticateToken, async (req: any, res) => {
    try {
      // This endpoint is mainly for testing, in production it would be triggered by a scheduled task
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
      
      res.status(201).json({ 
        message: 'Check-in notification created',
        notification
      });
    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({ error: 'Failed to create notification' });
    }
  });
  
  // Create a test notification
  router.post('/test-notification', authenticateToken, async (req: any, res) => {
    try {
      const notification = await pushNotificationService.createTestNotification(req.userId);
      
      res.status(201).json({ 
        message: 'Test notification created',
        notification
      });
    } catch (error) {
      console.error('Create test notification error:', error);
      res.status(500).json({ error: 'Failed to create test notification' });
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
      
      // For demo purposes - use a shorter cooldown period (5 minutes)
      // const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
  
      if (timeSinceLastCheckIn < cooldownPeriod) {
        const nextCheckInTime = new Date(lastCheckIn.timestamp.getTime() + cooldownPeriod);
        
        // Check if a notification already exists for this check-in period
        const { Notification } = require('../Database/NotificationSchema');
        
        // Look for any existing "Check-In Available" notifications that were created 
        // after the last check-in but before the next scheduled one
        const existingNotification = await Notification.findOne({
          userId: req.userId,
          type: 'wellness',
          title: 'Check-In Available',
          time: { 
            $gte: lastCheckIn.timestamp,
            $lt: nextCheckInTime
          }
        });
        
        // Only create a notification when we're within 30 seconds of the cooldown ending
        // and no notification already exists for this check-in period
        const isAlmostAvailable = timeSinceLastCheckIn > (cooldownPeriod - 30000);
        
        if (isAlmostAvailable && !existingNotification) {
          // Create a notification that the check-in will be available soon
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
          console.log('Created check-in available notification');
        }
        
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
  
  export default router;