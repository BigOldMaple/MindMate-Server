// services/__tests__/notificationsApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  jest.mock('../notificationService', () => ({
    notificationService: {
      sendLocalNotification: jest.fn().mockResolvedValue('test-notification-id')
    }
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { notificationsApi, Notification } from '../notificationsApi';
  import { notificationService } from '../notificationService';
  import { notificationTracker } from '../notificationTracker';
  
  // Create mock for global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  // Mock for notificationTracker
  jest.mock('../notificationTracker', () => ({
    notificationTracker: {
      hasShownCheckInNotification: jest.fn().mockResolvedValue(false),
      markCheckInNotificationShown: jest.fn().mockResolvedValue(undefined)
    }
  }));
  
  describe('Notifications API Service', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
      
      // Set up a token for auth
      SecureStore.setItemAsync('userToken', 'test-token');
      
      // Reset fetch mock to a default implementation
      (global.fetch as jest.Mock).mockReset().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
    });
  
    describe('getNotifications', () => {
      it('fetches user notifications from server', async () => {
        // Arrange
        const mockNotifications: Notification[] = [
          {
            _id: 'notif1',
            type: 'wellness',
            title: 'Check-In Available',
            message: 'Your daily check-in is available now',
            time: '2025-04-02T10:00:00.000Z',
            read: false,
            actionable: true,
            actionRoute: '/home/check_in'
          },
          {
            _id: 'notif2',
            type: 'support',
            title: 'Support Request',
            message: 'A buddy has requested support',
            time: '2025-04-01T15:30:00.000Z',
            read: true,
            actionable: true,
            actionRoute: '/support/request'
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockNotifications)
          })
        );
  
        // Act
        const result = await notificationsApi.getNotifications();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/notifications',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockNotifications);
      });
  
      it('handles errors when fetching notifications', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(notificationsApi.getNotifications()).rejects.toThrow('Failed to fetch notifications');
      });
    });
  
    describe('markAsRead', () => {
      it('updates read status on server', async () => {
        // Arrange
        const notificationId = 'notif1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await notificationsApi.markAsRead(notificationId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/notifications/${notificationId}/read`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when marking as read', async () => {
        // Arrange
        const notificationId = 'notif1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Notification not found' })
          })
        );
  
        // Act & Assert
        await expect(notificationsApi.markAsRead(notificationId)).rejects.toThrow();
      });
  
      it('processes JSON object ID strings correctly', async () => {
        // Arrange
        const objectIdString = '{"_id":"notif1","type":"wellness"}';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await notificationsApi.markAsRead(objectIdString);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/notifications/notif1/read`,
          expect.anything()
        );
      });
    });
  
    describe('deleteNotification', () => {
      it('removes notification from server', async () => {
        // Arrange
        const notificationId = 'notif1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await notificationsApi.deleteNotification(notificationId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/notifications/${notificationId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when deleting notification', async () => {
        // Arrange
        const notificationId = 'notif1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Notification not found' })
          })
        );
  
        // Act & Assert
        await expect(notificationsApi.deleteNotification(notificationId)).rejects.toThrow();
      });
    });
  
    describe('checkForCheckInStatus', () => {
      it('creates notification if check-in is available', async () => {
        // Arrange
        const checkInStatus = { canCheckIn: true };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(checkInStatus)
          })
        );
        
        (notificationTracker.hasShownCheckInNotification as jest.Mock).mockResolvedValue(false);
  
        // Act
        const result = await notificationsApi.checkForCheckInStatus();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/check-in/status',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
          'Check-In Available',
          'Your next check-in is now available. How are you feeling today?',
          expect.objectContaining({
            type: 'wellness',
            actionable: true,
            actionRoute: '/home/check_in'
          })
        );
        expect(notificationTracker.markCheckInNotificationShown).toHaveBeenCalled();
        expect(result).toBe(true);
      });
  
      it('does not create notification if check-in is not available', async () => {
        // Arrange
        const checkInStatus = { canCheckIn: false, nextCheckInTime: new Date().toISOString() };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(checkInStatus)
          })
        );
  
        // Act
        const result = await notificationsApi.checkForCheckInStatus();
  
        // Assert
        expect(global.fetch).toHaveBeenCalled();
        expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
  
      it('does not create notification if already shown for this cycle', async () => {
        // Arrange
        (notificationTracker.hasShownCheckInNotification as jest.Mock).mockResolvedValue(true);
  
        // Act
        const result = await notificationsApi.checkForCheckInStatus();
  
        // Assert
        expect(global.fetch).not.toHaveBeenCalled();
        expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
  
      it('handles errors checking check-in status', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act
        const result = await notificationsApi.checkForCheckInStatus();
  
        // Assert
        expect(result).toBe(false);
      });
    });
  
    describe('markAllAsRead', () => {
      it('marks all notifications as read', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await notificationsApi.markAllAsRead();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/notifications/read-all',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when marking all as read', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(notificationsApi.markAllAsRead()).rejects.toThrow();
      });
    });
  
    describe('createNotification', () => {
      it('creates a new notification', async () => {
        // Arrange
        const newNotification: Omit<Notification, 'id' | '_id'> = {
          type: 'wellness',
          title: 'Test Notification',
          message: 'This is a test notification',
          time: new Date().toISOString(),
          read: false
        };
        
        const createdNotification = {
          _id: 'new-notif-123',
          ...newNotification
        };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createdNotification)
          })
        );
  
        // Act
        const result = await notificationsApi.createNotification(newNotification);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/notifications',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(newNotification)
          }
        );
        expect(result).toEqual(createdNotification);
      });
  
      it('creates local notification for check-in type', async () => {
        // Arrange
        const checkInNotification: Omit<Notification, 'id' | '_id'> = {
          type: 'wellness',
          title: 'Check-In Available',
          message: 'Your daily check-in is available now',
          time: new Date().toISOString(),
          read: false,
          actionable: true,
          actionRoute: '/home/check_in'
        };
        
        const createdNotification = {
          _id: 'new-notif-123',
          ...checkInNotification
        };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createdNotification)
          })
        );
  
        // Act
        await notificationsApi.createNotification(checkInNotification);
  
        // Assert
        expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
          checkInNotification.title,
          checkInNotification.message,
          expect.objectContaining({
            type: checkInNotification.type,
            actionable: checkInNotification.actionable,
            actionRoute: checkInNotification.actionRoute,
            notificationId: createdNotification._id
          })
        );
      });
  
      it('handles errors when creating notification', async () => {
        // Arrange
        const newNotification: Omit<Notification, 'id' | '_id'> = {
          type: 'wellness',
          title: 'Test Notification',
          message: 'This is a test notification',
          time: new Date().toISOString(),
          read: false
        };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(notificationsApi.createNotification(newNotification)).rejects.toThrow();
      });
    });
  });