import request from 'supertest';
import express from 'express';
import { Types } from 'mongoose';

// First, create the mock functions
const mockVerifyToken = jest.fn().mockReturnValue({ userId: new Types.ObjectId().toString() });
const mockFindNotification = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindOneCheckIn = jest.fn();
const mockCreateTestNotification = jest.fn();
const mockSave = jest.fn().mockResolvedValue(true);
const mockDeleteOne = jest.fn().mockResolvedValue(true);

// Create manual mocks for all dependencies
jest.mock('../../services/auth', () => ({
  auth: {
    verifyToken: mockVerifyToken
  }
}));

// Define interfaces for proper typing
interface NotificationModel {
  new(): NotificationDocument;
  find: jest.Mock;
  findOne: jest.Mock;
  updateMany: jest.Mock;
}

interface NotificationDocument {
  _id?: Types.ObjectId | string;
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  read?: boolean;
  time?: Date;
  actionable?: boolean;
  actionRoute?: string;
  save: jest.Mock;
  deleteOne?: jest.Mock;
}

// Create typed constructor mock
const NotificationConstructor = jest.fn().mockImplementation(() => ({
  save: mockSave
})) as unknown as NotificationModel;

// Set up static methods
NotificationConstructor.find = jest.fn().mockReturnValue({
  sort: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([])
  })
});
NotificationConstructor.findOne = mockFindNotification;
NotificationConstructor.updateMany = mockUpdateMany;

// Mock other modules
jest.mock('../../Database/NotificationSchema', () => ({
  Notification: NotificationConstructor
}));

jest.mock('../../Database/CheckInSchema', () => ({
  CheckIn: {
    findOne: mockFindOneCheckIn
  }
}));

jest.mock('../../Database/DeviceTokenSchema', () => ({
  DeviceToken: {
    findOne: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 })
  }
}));

jest.mock('../../services/pushNotificationService', () => ({
  pushNotificationService: {
    createTestNotification: mockCreateTestNotification
  }
}));

jest.mock('../../utils/dateFormatter', () => ({
  formatDistanceToNow: jest.fn().mockReturnValue('5 minutes ago')
}));

// Now import the modules AFTER mocking
import { auth } from '../../services/auth';
import notificationsRoutes from '../../routes/notifications';

describe('Notification Routes', () => {
  let app: express.Application;
  const userId = new Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/notifications', notificationsRoutes);
    
    // Reset the mock to return our userId
    mockVerifyToken.mockReturnValue({ userId });
  });
  
  // Test route mounting
  it('should have routes defined', () => {
    const routes = (notificationsRoutes as any).stack || [];
    expect(routes.length).toBeGreaterThan(0);
  });
  
  describe('GET /', () => {
    it('should return all notifications for the user', async () => {
      // Mock notifications
      const mockNotifications = [
        {
          _id: new Types.ObjectId().toString(),
          userId,
          type: 'wellness',
          title: 'Check-In Available',
          message: 'Your next check-in is now available.',
          read: false,
          time: new Date(),
          actionable: true,
          actionRoute: '/home/check_in'
        },
        {
          _id: new Types.ObjectId().toString(),
          userId,
          type: 'support',
          title: 'Support Request',
          message: 'A buddy needs your support.',
          read: true,
          time: new Date(Date.now() - 3600000) // 1 hour ago
        }
      ];
      
      // Set up the mock chain correctly
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockNotifications)
      });
      NotificationConstructor.find = jest.fn().mockReturnValue({ sort: sortMock });
      
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(NotificationConstructor.find).toHaveBeenCalledWith({ userId });
      expect(sortMock).toHaveBeenCalledWith({ time: -1 });
    });
    
    it('should handle errors when fetching notifications', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      NotificationConstructor.find = jest.fn().mockReturnValue({ sort: sortMock });
      
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch notifications');
    });
  });
  
  describe('POST /:id/read', () => {
    it('should mark a notification as read', async () => {
      const notificationId = new Types.ObjectId().toString();
      
      // Mock notification
      const mockNotification = {
        _id: notificationId,
        userId,
        read: false,
        save: mockSave
      };
      
      // Set up the findOne mock
      mockFindNotification.mockResolvedValue(mockNotification);
      
      const response = await request(app)
        .post(`/api/notifications/${notificationId}/read`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Notification marked as read');
      expect(mockNotification.read).toBe(true);
      expect(mockSave).toHaveBeenCalled();
      expect(mockFindNotification).toHaveBeenCalledWith({
        _id: notificationId,
        userId
      });
    });
    
    it('should return 404 if notification is not found', async () => {
      const notificationId = new Types.ObjectId().toString();
      
      // Mock Notification.findOne to return null
      mockFindNotification.mockResolvedValue(null);
      
      const response = await request(app)
        .post(`/api/notifications/${notificationId}/read`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Notification not found');
    });
    
    it('should return 500 if notification ID is invalid', async () => {
      const invalidId = 'invalid-id';
      
      // When the ID is invalid, the code should throw an error
      mockFindNotification.mockImplementation(() => {
        throw new Error('Invalid ID format');
      });
      
      const response = await request(app)
        .post(`/api/notifications/${invalidId}/read`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to mark notification as read');
    });
  });
  
  describe('POST /read-all', () => {
    it('should mark all notifications as read', async () => {
      // Set up updateMany mock
      mockUpdateMany.mockResolvedValue({ modifiedCount: 5 });
      
      const response = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'All notifications marked as read');
      expect(mockUpdateMany).toHaveBeenCalledWith(
        { userId, read: false },
        { $set: { read: true } }
      );
    });
    
    it('should handle errors when marking all as read', async () => {
      // Mock updateMany to throw error
      mockUpdateMany.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to mark notifications as read');
    });
  });
  
  describe('DELETE /:id', () => {
    it('should delete a notification', async () => {
      const notificationId = new Types.ObjectId().toString();
      
      // Mock notification
      const mockNotification = {
        _id: notificationId,
        userId,
        deleteOne: mockDeleteOne
      };
      
      // Set up the findOne mock
      mockFindNotification.mockResolvedValue(mockNotification);
      
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Notification deleted');
      expect(mockDeleteOne).toHaveBeenCalled();
      expect(mockFindNotification).toHaveBeenCalledWith({
        _id: notificationId,
        userId
      });
    });
    
    it('should return 404 if notification is not found', async () => {
      const notificationId = new Types.ObjectId().toString();
      
      // Mock Notification.findOne to return null
      mockFindNotification.mockResolvedValue(null);
      
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Notification not found');
    });
  });
  
  describe('POST /test-notification', () => {
    it('should create a test notification', async () => {
      // Mock test notification
      const mockNotification = {
        _id: new Types.ObjectId(),
        userId,
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification',
        read: false,
        time: new Date()
      };
      
      // Mock pushNotificationService
      mockCreateTestNotification.mockResolvedValue(mockNotification);
      
      const response = await request(app)
        .post('/api/notifications/test-notification')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Test notification created');
      expect(response.body).toHaveProperty('notification');
      expect(mockCreateTestNotification).toHaveBeenCalledWith(userId);
    });
    
    it('should handle errors when creating test notification', async () => {
      // Mock createTestNotification to throw error
      mockCreateTestNotification.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .post('/api/notifications/test-notification')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to create test notification');
    });
  });
  
  describe('GET /status', () => {
    it('should return canCheckIn=true when no check-in exists', async () => {
      // Mock CheckIn.findOne to return null
      mockFindOneCheckIn.mockReturnValue(null);
      
      const response = await request(app)
        .get('/api/notifications/status')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('canCheckIn', true);
    });
    
    it('should handle errors when getting check-in status', async () => {
      // Mock CheckIn.findOne to throw error
      mockFindOneCheckIn.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .get('/api/notifications/status')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to get check-in status');
    });
  });
});