import { pushNotificationService } from '../pushNotificationService';
import { DeviceToken } from '../../Database/DeviceTokenSchema';
import { Notification } from '../../Database/NotificationSchema';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../Database/DeviceTokenSchema');
jest.mock('../../Database/NotificationSchema');

describe('Push Notification Service', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('sendToUser', () => {
    it('should create notification and return true when device tokens exist', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const title = 'Test Notification';
      const body = 'This is a test notification';
      const data = { type: 'alert', actionRoute: '/test' };
      
      // Mock device tokens
      const mockDeviceTokens = [
        { token: 'device-token-1' },
        { token: 'device-token-2' }
      ];
      
      // Mock notification
      const mockNotification = {
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Setup mocks
      (DeviceToken.find as jest.Mock).mockResolvedValue(mockDeviceTokens);
      (Notification as jest.MockedClass<typeof Notification>).mockImplementation(() => mockNotification as any);
      
      // Execute
      const result = await pushNotificationService.sendToUser(
        userId,
        title,
        body,
        data
      );
      
      // Verify
      expect(result).toBe(true);
      expect(DeviceToken.find).toHaveBeenCalledWith({ userId });
      expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: data.type,
        title,
        message: body,
        read: false,
        actionable: true,
        actionRoute: data.actionRoute
      }));
      expect(mockNotification.save).toHaveBeenCalled();
    });
    
    it('should return false when no device tokens exist', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      (DeviceToken.find as jest.Mock).mockResolvedValue([]);
      
      // Execute
      const result = await pushNotificationService.sendToUser(
        userId,
        'Test',
        'Message'
      );
      
      // Verify
      expect(result).toBe(false);
      expect(DeviceToken.find).toHaveBeenCalledWith({ userId });
      expect(Notification).not.toHaveBeenCalled();
    });
    
    it('should not create notification for silent notifications', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const mockDeviceTokens = [{ token: 'device-token-1' }];
      
      (DeviceToken.find as jest.Mock).mockResolvedValue(mockDeviceTokens);
      
      // Execute
      const result = await pushNotificationService.sendToUser(
        userId,
        'Test',
        'Message',
        { type: 'health_sync' },
        true // silent notification
      );
      
      // Verify
      expect(result).toBe(true);
      expect(DeviceToken.find).toHaveBeenCalledWith({ userId });
      expect(Notification).not.toHaveBeenCalled();
    });
  });
  
  describe('sendCheckInAvailableNotification', () => {
    it('should send notification with correct check-in data', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Spy on sendToUser method
      const sendToUserSpy = jest.spyOn(pushNotificationService, 'sendToUser')
        .mockResolvedValue(true);
      
      // Execute
      const result = await pushNotificationService.sendCheckInAvailableNotification(userId);
      
      // Verify
      expect(result).toBe(true);
      expect(sendToUserSpy).toHaveBeenCalledWith(
        userId,
        'Check-In Available',
        'Your next check-in is now available. How are you feeling today?',
        {
          type: 'wellness',
          actionRoute: '/home/check_in'
        }
      );
      
      // Restore original method
      sendToUserSpy.mockRestore();
    });
  });
  
  describe('createTestNotification', () => {
    it('should create and return a test notification', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Mock notification with _id
      const mockNotification = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        type: 'alert',
        title: 'Test Notification',
        message: 'This is a test notification from MindMate',
        read: false,
        time: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Notification as jest.MockedClass<typeof Notification>).mockImplementation(() => mockNotification as any);
      
      // Execute
      const result = await pushNotificationService.createTestNotification(userId);
      
      // Verify
      expect(result).toBe(mockNotification);
      expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: 'alert',
        title: 'Test Notification',
        message: 'This is a test notification from MindMate',
        read: false
      }));
      expect(mockNotification.save).toHaveBeenCalled();
    });
  });
});