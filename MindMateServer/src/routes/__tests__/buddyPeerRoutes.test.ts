import request from 'supertest';
import express from 'express';
import { auth } from '../../services/auth';
import buddyPeerRoutes from '../../routes/buddyPeer';
import { User } from '../../Database/Schema';
import { Types } from 'mongoose';
import { ApiError } from '../../middleware/error';

// Mock dependencies
jest.mock('../../services/auth');
jest.mock('../../Database/Schema');

// Use actual ApiError class
const originalApiError = jest.requireActual('../../middleware/error').ApiError;

// Define interfaces for Mongoose document arrays
interface MongooseDocumentArray<T> extends Array<T> {
  id(id: string): T | null;
}

describe('Buddy Peer Routes', () => {
  let app: express.Application;
  const userId = new Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/buddy-peer', buddyPeerRoutes);
    
    // Mock auth middleware
    (auth.verifyToken as jest.Mock).mockReturnValue({ userId });
    
    // Mock user for auth middleware
    const mockUser = {
      _id: userId,
      username: 'testuser',
      profile: {
        name: 'Test User',
        isVerifiedProfessional: false
      },
      buddyPeers: [],
      notifications: []
    };
    
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
  });
  
  // Test route mounting
  it('should have routes defined', () => {
    const routes = (buddyPeerRoutes as any).stack || [];
    expect(routes.length).toBeGreaterThan(0);
  });
  
  describe('GET /', () => {
    it('should return buddy peers', async () => {
      // Mock buddy peers
      const mockBuddyPeers = [
        {
          userId: {
            _id: new Types.ObjectId(),
            username: 'buddy1',
            profile: {
              name: 'Buddy One',
              isVerifiedProfessional: false
            }
          },
          relationship: 'friend',
          dateAdded: new Date()
        },
        {
          userId: {
            _id: new Types.ObjectId(),
            username: 'buddy2',
            profile: {
              name: 'Buddy Two',
              isVerifiedProfessional: true
            }
          },
          relationship: 'colleague',
          dateAdded: new Date()
        }
      ];
      
      const userWithBuddies = {
        _id: userId,
        buddyPeers: mockBuddyPeers
      };
      
      // Mock User.findById().populate().select() chain
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(userWithBuddies)
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('username', 'buddy1');
      expect(response.body[1]).toHaveProperty('username', 'buddy2');
      
      // Verify database calls
      expect(User.findById).toHaveBeenCalledWith(userId);
      const mockPopulate = (User.findById as jest.Mock).mock.results[0].value.populate;
      expect(mockPopulate).toHaveBeenCalledWith('buddyPeers.userId', 'username profile.name');
    });
    
    it('should handle user not found', async () => {
      // Mock User.findById to return null
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
    
    it('should handle errors when fetching buddy peers', async () => {
      // Mock User.findById to throw error
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch buddy peers');
    });
  });
  
  describe('GET /requests', () => {
    it('should return pending buddy requests', async () => {
      // Mock pending requests
      const mockRequests = [
        {
          _id: new Types.ObjectId(),
          type: 'buddy_request',
          senderId: {
            _id: new Types.ObjectId(),
            username: 'requester1',
            profile: {
              name: 'Requester One'
            }
          },
          status: 'pending',
          createdAt: new Date()
        },
        {
          _id: new Types.ObjectId(),
          type: 'buddy_request',
          senderId: {
            _id: new Types.ObjectId(),
            username: 'requester2',
            profile: {
              name: 'Requester Two'
            }
          },
          status: 'pending',
          createdAt: new Date()
        }
      ];
      
      const userWithRequests = {
        _id: userId,
        notifications: mockRequests
      };
      
      // Mock User.findById().populate().select() chain
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(userWithRequests)
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer/requests')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('sender');
      expect(response.body[0].sender).toHaveProperty('username', 'requester1');
      
      // Verify database calls
      expect(User.findById).toHaveBeenCalledWith(userId);
      const mockPopulate = (User.findById as jest.Mock).mock.results[0].value.populate;
      expect(mockPopulate).toHaveBeenCalledWith('notifications.senderId', 'username profile.name');
    });
    
    it('should return empty array if no requests are found', async () => {
      // Mock User.findById to return user with no notifications
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            _id: userId,
            notifications: []
          })
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer/requests')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
    
    it('should handle errors when fetching buddy requests', async () => {
      // Mock User.findById to throw error
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer/requests')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch buddy requests');
    });
  });
  
  describe('GET /search', () => {
    it('should search users', async () => {
      const searchQuery = 'test';
      
      // Mock search results
      const mockUsers = [
        {
          _id: new Types.ObjectId(),
          username: 'testuser1',
          profile: {
            name: 'Test User One'
          }
        },
        {
          _id: new Types.ObjectId(),
          username: 'testuser2',
          profile: {
            name: 'Test User Two'
          }
        }
      ];
      
      // Mock User.find().select().limit() chain
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockUsers)
        })
      });
      
      const response = await request(app)
        .get(`/api/buddy-peer/search?query=${searchQuery}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('username', 'testuser1');
      expect(response.body[1]).toHaveProperty('username', 'testuser2');
      
      // Verify database calls
      expect(User.find).toHaveBeenCalledWith({
        username: expect.any(RegExp),
        _id: { $ne: userId }
      });
    });
    
    it('should return 400 if query is missing', async () => {
      const response = await request(app)
        .get('/api/buddy-peer/search')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Search query is required');
    });
    
    it('should handle errors when searching users', async () => {
      // Mock User.find to throw error
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });
      
      const response = await request(app)
        .get('/api/buddy-peer/search?query=test')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to search users');
    });
  });
  
  describe('POST /request', () => {
    it('should send buddy request successfully', async () => {
      const requestData = {
        username: 'recipient'
      };
      
      // Mock sender
      const sender = {
        _id: userId,
        buddyPeers: [],
        notifications: []
      };
      
      // Mock recipient
      const recipient = {
        _id: new Types.ObjectId(),
        username: 'recipient',
        notifications: []
      };
      
      // Mock User.findById for sender
      (User.findById as jest.Mock).mockResolvedValueOnce(sender);
      
      // Mock User.findOne for recipient
      (User.findOne as jest.Mock).mockResolvedValueOnce(recipient);
      
      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(true);
      
      const response = await request(app)
        .post('/api/buddy-peer/request')
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Buddy request sent successfully');
      
      // Verify database calls
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(User.findOne).toHaveBeenCalledWith({ username: requestData.username });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        recipient._id,
        {
          $push: {
            notifications: expect.objectContaining({
              type: 'buddy_request',
              senderId: userId,
              status: 'pending'
            })
          }
        }
      );
    });
    
    it('should return 404 if recipient not found', async () => {
      const requestData = {
        username: 'nonexistent'
      };
      
      // Mock sender
      const sender = {
        _id: userId,
        buddyPeers: [],
        notifications: []
      };
      
      // Mock User.findById for sender
      (User.findById as jest.Mock).mockResolvedValueOnce(sender);
      
      // Mock User.findOne to return null (recipient not found)
      (User.findOne as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/buddy-peer/request')
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
    
    it('should return 400 if already buddy peers', async () => {
      const requestData = {
        username: 'buddy'
      };
      
      const recipientId = new Types.ObjectId();
      
      // Mock sender with recipient already as buddy
      const sender = {
        _id: userId,
        buddyPeers: [
          {
            userId: recipientId,
            relationship: 'friend',
            dateAdded: new Date()
          }
        ],
        notifications: []
      };
      
      // Mock recipient
      const recipient = {
        _id: recipientId,
        username: 'buddy',
        notifications: []
      };
      
      // Mock User.findById for sender
      (User.findById as jest.Mock).mockResolvedValueOnce(sender);
      
      // Mock User.findOne for recipient
      (User.findOne as jest.Mock).mockResolvedValueOnce(recipient);
      
      const response = await request(app)
        .post('/api/buddy-peer/request')
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'You are already buddy peers with this user');
    });
    
    it('should return 400 if request already sent', async () => {
      const requestData = {
        username: 'recipient'
      };
      
      const recipientId = new Types.ObjectId();
      
      // Mock sender
      const sender = {
        _id: userId,
        buddyPeers: [],
        notifications: []
      };
      
      // Mock recipient with pending request from sender
      const recipient = {
        _id: recipientId,
        username: 'recipient',
        notifications: [
          {
            type: 'buddy_request',
            senderId: userId,
            status: 'pending',
            createdAt: new Date()
          }
        ]
      };
      
      // Mock User.findById for sender
      (User.findById as jest.Mock).mockResolvedValueOnce(sender);
      
      // Mock User.findOne for recipient
      (User.findOne as jest.Mock).mockResolvedValueOnce(recipient);
      
      const response = await request(app)
        .post('/api/buddy-peer/request')
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Buddy request already sent');
    });
  });
  
  describe('POST /request/:requestId', () => {
    it('should accept buddy request successfully', async () => {
      const requestId = new Types.ObjectId().toString();
      const senderId = new Types.ObjectId();
      
      const requestData = {
        accept: true
      };
      
      // Mock user with the request
      const mockNotification = {
        _id: requestId,
        type: 'buddy_request',
        senderId: senderId,
        status: 'pending',
        createdAt: new Date()
      };
      
      // Create notifications array and implement the id method correctly
      const notifications: MongooseDocumentArray<typeof mockNotification> = 
        [mockNotification] as unknown as MongooseDocumentArray<typeof mockNotification>;
      
      // Add the id method
      notifications.id = function(id: string) {
        return this.find(n => n._id.toString() === id) || null;
      };
      
      const user = {
        _id: userId,
        notifications,
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Mock User.findById
      (User.findById as jest.Mock).mockResolvedValue(user);
      
      // Mock User.findByIdAndUpdate for both user updates
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Buddy request accepted');
      
      // Verify database calls
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(user.save).toHaveBeenCalled();
    });
    
    it('should decline buddy request successfully', async () => {
      const requestId = new Types.ObjectId().toString();
      const senderId = new Types.ObjectId();
      
      const requestData = {
        accept: false
      };
      
      // Mock user with the request
      const mockNotification = {
        _id: requestId,
        type: 'buddy_request',
        senderId: senderId,
        status: 'pending',
        createdAt: new Date()
      };
      
      // Create notifications array with id method
      const notifications: MongooseDocumentArray<typeof mockNotification> = 
        [mockNotification] as unknown as MongooseDocumentArray<typeof mockNotification>;
      
      notifications.id = function(id: string) {
        return this.find(n => n._id.toString() === id) || null;
      };
      
      const user = {
        _id: userId,
        notifications,
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Mock User.findById
      (User.findById as jest.Mock).mockResolvedValue(user);
      
      const response = await request(app)
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(requestData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Buddy request declined');
      
      // Verify database calls - should not add to buddy peers
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
    });
    
    it('should return 404 if user not found', async () => {
      const requestId = new Types.ObjectId().toString();
      
      // Mock User.findById to return null
      (User.findById as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app)
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accept: true });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
    
    it('should return 404 if request not found', async () => {
      const requestId = new Types.ObjectId().toString();
      
      // Create empty notifications array with id method
      const notifications: MongooseDocumentArray<any> = [] as unknown as MongooseDocumentArray<any>;
      
      notifications.id = function(id: string) {
        return null; // Always return null to simulate request not found
      };
      
      // Mock user without the request
      const user = {
        _id: userId,
        notifications,
        save: jest.fn()
      };
      
      // Mock User.findById
      (User.findById as jest.Mock).mockResolvedValue(user);
      
      const response = await request(app)
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ accept: true });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Request not found');
    });
  });
  
  describe('DELETE /:userId', () => {
    it('should remove buddy peer successfully', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .delete(`/api/buddy-peer/${buddyId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Buddy peer removed successfully');
      
      // Verify database calls - should update both users
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $pull: { buddyPeers: { userId: buddyId } } }
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        buddyId,
        { $pull: { buddyPeers: { userId: userId } } }
      );
    });
    
    it('should handle errors when removing buddy peer', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock User.findByIdAndUpdate to throw error
      (User.findByIdAndUpdate as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .delete(`/api/buddy-peer/${buddyId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to remove buddy peer');
    });
  });
  
  describe('GET /:userId/profile', () => {
    it('should get buddy profile', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock buddy peer data
      const buddyPeer = {
        userId: {
          _id: buddyId,
          username: 'buddy',
          profile: {
            name: 'Buddy User',
            isVerifiedProfessional: true,
            joinDate: new Date(),
            organizationAffiliation: 'Test Org'
          }
        },
        relationship: 'friend',
        dateAdded: new Date()
      };
      
      // Mock user with buddy
      const user = {
        _id: userId,
        buddyPeers: [buddyPeer]
      };
      
      // Mock User.findById().populate() chain
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(user)
      });
      
      const response = await request(app)
        .get(`/api/buddy-peer/${buddyId}/profile`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', buddyId);
      expect(response.body).toHaveProperty('username', 'buddy');
      expect(response.body).toHaveProperty('relationship', 'friend');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('isVerifiedProfessional', true);
      
      // Verify database calls
      expect(User.findById).toHaveBeenCalledWith(userId);
      const mockPopulate = (User.findById as jest.Mock).mock.results[0].value.populate;
      expect(mockPopulate).toHaveBeenCalledWith(
        'buddyPeers.userId', 
        'username profile.name profile.isVerifiedProfessional profile.organizationAffiliation profile.joinDate'
      );
    });
    
    it('should return 404 if user not found', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock User.findById to return null
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });
      
      const response = await request(app)
        .get(`/api/buddy-peer/${buddyId}/profile`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
    
    it('should return 404 if buddy not found', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock user without the requested buddy
      const user = {
        _id: userId,
        buddyPeers: []
      };
      
      // Mock User.findById().populate() chain
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(user)
      });
      
      const response = await request(app)
        .get(`/api/buddy-peer/${buddyId}/profile`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Buddy not found');
    });
    
    it('should handle errors when fetching buddy profile', async () => {
      const buddyId = new Types.ObjectId().toString();
      
      // Mock User.findById to throw error
      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      
      const response = await request(app)
        .get(`/api/buddy-peer/${buddyId}/profile`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch buddy profile');
    });
  });
});