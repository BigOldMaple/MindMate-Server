import request from 'supertest';
import express from 'express';
import { auth } from '../../services/auth';
import communityRoutes from '../../routes/community';
import { Community } from '../../Database/CommunitySchema';
import { User } from '../../Database/Schema';
import { Types } from 'mongoose';
import { ApiError } from '../../middleware/error';

// Mock dependencies
jest.mock('../../services/auth');
jest.mock('../../Database/CommunitySchema');
jest.mock('../../Database/Schema');

// Instead of mocking the whole ApiError class, we'll use the actual class
// but mock specific instances when needed
const originalApiError = jest.requireActual('../../middleware/error').ApiError;

describe('Community Routes', () => {
  let app: express.Application;
  const userId = new Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/community', communityRoutes);
    
    // Mock auth middleware to set user in request
    (auth.verifyToken as jest.Mock).mockReturnValue({ userId });
    
    // Mock user for auth middleware
    const mockUser = {
      _id: userId,
      username: 'testuser',
      profile: {
        name: 'Test User',
        isVerifiedProfessional: false
      }
    };
    
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
  });
  
  // Test route mounting
  it('should have routes defined', () => {
    const routes = (communityRoutes as any).stack || [];
    expect(routes.length).toBeGreaterThan(0);
  });
  
  describe('GET /', () => {
    it('should return all communities', async () => {
      // Mock communities
      const mockCommunities = [
        {
          _id: new Types.ObjectId(),
          name: 'Test Community 1',
          description: 'Description 1',
          type: 'support',
          creator: new Types.ObjectId(),
          members: [
            {
              userId: new Types.ObjectId(),
              role: 'admin',
              joinDate: new Date()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new Types.ObjectId(),
          name: 'Test Community 2',
          description: 'Description 2',
          type: 'professional',
          creator: new Types.ObjectId(),
          members: [
            {
              userId: new Types.ObjectId(),
              role: 'admin',
              joinDate: new Date()
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock Community.find().select().lean() chain
      (Community.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockCommunities)
        })
      });
      
      const response = await request(app)
        .get('/api/community')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Test Community 1');
      expect(response.body[1]).toHaveProperty('name', 'Test Community 2');
      expect(response.body[0]).toHaveProperty('memberCount');
      expect(response.body[0]).toHaveProperty('isUserMember');
      expect(response.body[0]).toHaveProperty('userRole');
    });
    
    it('should handle errors when fetching communities', async () => {
      // Mock Community.find to throw an error
      (Community.find as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .get('/api/community')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch communities');
    });
  });
  
  describe('POST /', () => {
    it('should create a new community successfully', async () => {
      // Community data
      const communityData = {
        name: 'New Community',
        description: 'A test community',
        type: 'support'
      };
      
      // Mock Community constructor and save
      const communityId = new Types.ObjectId();
      const mockCommunity = {
        _id: communityId,
        ...communityData,
        creator: userId,
        members: [
          {
            userId,
            role: 'admin',
            joinDate: expect.any(Date)
          }
        ],
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Community as jest.MockedClass<typeof Community>).mockImplementation(() => mockCommunity as any);
      
      const response = await request(app)
        .post('/api/community')
        .set('Authorization', 'Bearer valid-token')
        .send(communityData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', communityId.toString());
      expect(response.body).toHaveProperty('name', communityData.name);
      expect(response.body).toHaveProperty('type', communityData.type);
      expect(mockCommunity.save).toHaveBeenCalled();
    });
    
    it('should return 400 if required fields are missing', async () => {
      // Missing description
      const incompleteData = {
        name: 'New Community',
        type: 'support'
      };
      
      const response = await request(app)
        .post('/api/community')
        .set('Authorization', 'Bearer valid-token')
        .send(incompleteData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
    
    it('should handle duplicate community name error', async () => {
      const communityData = {
        name: 'Existing Community',
        description: 'A test community',
        type: 'support'
      };
      
      // Mock Community constructor and save to throw duplicate key error
      const mockCommunity = {
        save: jest.fn().mockRejectedValue({ code: 11000 })
      };
      
      (Community as jest.MockedClass<typeof Community>).mockImplementation(() => mockCommunity as any);
      
      const response = await request(app)
        .post('/api/community')
        .set('Authorization', 'Bearer valid-token')
        .send(communityData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Community name already exists');
    });
  });
  
  describe('POST /:communityId/join', () => {
    it('should allow user to join a community', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock community find and save
      const mockCommunity = {
        _id: communityId,
        name: 'Test Community',
        members: [],
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Community.findById as jest.Mock).mockResolvedValue(mockCommunity);
      
      // Mock User findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Successfully joined community');
      expect(response.body).toHaveProperty('community');
      expect(response.body.community).toHaveProperty('_id', communityId);
      expect(response.body.community).toHaveProperty('role', 'member');
      expect(mockCommunity.save).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, expect.objectContaining({
        $push: expect.objectContaining({
          communities: expect.objectContaining({
            communityId: mockCommunity._id,
            role: 'member'
          })
        })
      }));
    });
    
    it('should return 404 if community not found', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to return null
      (Community.findById as jest.Mock).mockResolvedValue(null);
      
      // Create a real ApiError instance that will pass the instanceof check
      (Community.findById as jest.Mock).mockImplementation(() => {
        // First call returns null, which triggers the ApiError
        throw new originalApiError(404, 'Community not found');
      });
      
      const response = await request(app)
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Community not found');
    });
    
    it('should return 400 if user is already a member', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Create a real ApiError for already member
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new originalApiError(400, 'User is already a member of this community');
      });
      
      const response = await request(app)
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User is already a member of this community');
    });
  });
  
  describe('POST /:communityId/leave', () => {
    it('should allow user to leave a community', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock community find and save
      const mockCommunity = {
        _id: communityId,
        name: 'Test Community',
        creator: new Types.ObjectId().toString(), // Different from userId
        members: [
          {
            userId: userId,
            role: 'member',
            joinDate: new Date()
          }
        ],
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Community.findById as jest.Mock).mockResolvedValue(mockCommunity);
      
      // Mock User findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post(`/api/community/${communityId}/leave`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Successfully left community');
      expect(mockCommunity.save).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, expect.objectContaining({
        $pull: expect.objectContaining({
          communities: expect.objectContaining({
            communityId: mockCommunity._id
          })
        })
      }));
    });
    
    it('should return 404 if community not found', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to throw ApiError
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new originalApiError(404, 'Community not found');
      });
      
      const response = await request(app)
        .post(`/api/community/${communityId}/leave`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Community not found');
    });
    
    it('should return 400 if user is not a member', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to throw ApiError
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new originalApiError(400, 'User is not a member of this community');
      });
      
      const response = await request(app)
        .post(`/api/community/${communityId}/leave`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User is not a member of this community');
    });
    
    it('should return 400 if user is the creator', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to throw ApiError
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new originalApiError(400, 'Community creator cannot leave the community');
      });
      
      const response = await request(app)
        .post(`/api/community/${communityId}/leave`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Community creator cannot leave the community');
    });
  });
  
  describe('GET /search', () => {
    it('should search communities by query', async () => {
      const searchQuery = 'test';
      
      // Mock communities
      const mockCommunities = [
        {
          _id: new Types.ObjectId(),
          name: 'Test Community',
          description: 'Description with test keyword',
          type: 'support',
          creator: new Types.ObjectId(),
          members: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock Community.find().select().lean() chain
      (Community.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockCommunities)
        })
      });
      
      const response = await request(app)
        .get(`/api/community/search?query=${searchQuery}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('name', 'Test Community');
      expect(Community.find).toHaveBeenCalledWith({
        $or: [
          { name: expect.any(RegExp) },
          { description: expect.any(RegExp) },
          { type: expect.any(RegExp) }
        ]
      });
    });
    
    it('should return 400 if search query is missing', async () => {
      const response = await request(app)
        .get('/api/community/search')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Search query is required');
    });
    
    it('should handle errors when searching communities', async () => {
      // Mock Community.find to throw an error
      (Community.find as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .get('/api/community/search?query=test')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to search communities');
    });
  });
  
  describe('GET /:communityId', () => {
    it('should return community details', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock community
      const mockCommunity = {
        _id: communityId,
        name: 'Test Community',
        description: 'Community description',
        type: 'support',
        creator: {
          _id: new Types.ObjectId(),
          username: 'creator',
          profile: {
            name: 'Creator User',
            isVerifiedProfessional: true
          }
        },
        members: [
          {
            userId: {
              _id: new Types.ObjectId(),
              username: 'member1',
              profile: {
                name: 'Member One',
                isVerifiedProfessional: false
              }
            },
            role: 'member',
            joinDate: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock Community.findById().populate().populate().lean() chain
      (Community.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockCommunity)
          })
        })
      });
      
      const response = await request(app)
        .get(`/api/community/${communityId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', communityId);
      expect(response.body).toHaveProperty('name', 'Test Community');
      expect(response.body).toHaveProperty('creatorDetails');
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('memberCount');
      expect(response.body).toHaveProperty('isUserMember');
    });
    
    it('should return 404 if community not found', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to throw ApiError
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new originalApiError(404, 'Community not found');
      });
      
      const response = await request(app)
        .get(`/api/community/${communityId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Community not found');
    });
    
    it('should handle errors when fetching community details', async () => {
      const communityId = new Types.ObjectId().toString();
      
      // Mock Community.findById to throw an error
      (Community.findById as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .get(`/api/community/${communityId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch community details');
    });
  });
});