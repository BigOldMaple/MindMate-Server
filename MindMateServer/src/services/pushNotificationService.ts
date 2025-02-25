// server/services/pushNotificationService.ts
import { DeviceToken } from '../Database/DeviceTokenSchema';
import { Notification, INotification } from '../Database/NotificationSchema';
import { Types } from 'mongoose';

class PushNotificationService {
  /**
   * Send a push notification to a specific user
   * @param userId The user ID to send the notification to
   * @param title The notification title
   * @param body The notification body
   * @param data Additional data to include with the notification
   */
  async sendToUser(
    userId: string | Types.ObjectId,
    title: string,
    body: string,
    data: any = {}
  ): Promise<boolean> {
    try {
      // Get all device tokens for the user
      const deviceTokens = await DeviceToken.find({ userId });
      
      if (deviceTokens.length === 0) {
        console.log(`No device tokens found for user ${userId}`);
        return false;
      }
      
      // In a real implementation, we would use Firebase or another push service
      // to actually send the notification to the devices
      console.log(`Sending push notification to ${deviceTokens.length} devices for user ${userId}`);
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('Data:', data);
      
      // Create a notification record in the database
      const notification = new Notification({
        userId,
        type: data.type || 'alert',
        title,
        message: body,
        read: false,
        time: new Date(),
        actionable: !!data.actionRoute,
        actionRoute: data.actionRoute,
        actionParams: data.actionParams,
        relatedId: data.relatedId
      });
      
      await notification.save();
      
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }
  
  /**
   * Send a notification for an available check-in
   * @param userId The user ID to send the notification to
   */
  async sendCheckInAvailableNotification(userId: string | Types.ObjectId): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Check-In Available',
      'Your next check-in is now available. How are you feeling today?',
      {
        type: 'wellness',
        actionRoute: '/home/check_in'
      }
    );
  }
  
  /**
   * Create a test notification
   * @param userId The user ID to create the notification for
   */
  async createTestNotification(userId: string | Types.ObjectId): Promise<INotification> {
    const notification = new Notification({
      userId,
      type: 'alert',
      title: 'Test Notification',
      message: 'This is a test notification from MindMate',
      read: false,
      time: new Date(),
      actionable: false
    });
    
    await notification.save();
    return notification;
  }
}

export const pushNotificationService = new PushNotificationService();