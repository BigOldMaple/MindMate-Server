import request from 'supertest';
import express from 'express';
import { auth } from '../../services/auth';
import profileRoutes from '../../routes/profile';
import { User } from '../../Database/Schema';
import { Types } from 'mongoose';

// Mock dependencies
jest.mock('../../services/auth');
jest.mock('../../Database/Schema');

describe('Profile Routes', () => {
  let app: express.Application;
  const userId = new Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/profile', profileRoutes);
    
    // Mock auth middleware
    (auth.verifyToken as jest.Mock).mockReturnValue({ userId });
    
    // Mock user for auth middleware
    const mockUser = {
      _id: userId,
      username: 'testuser',
      email: 'test@example.com',
      profile: {
        name: 'Test User',
        isVerifiedProfessional: false
      },
      phone: '1234567890',
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Family',
        phone: '0987654321'
      }
    };
    
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
  });
  
  // Test route mounting
  it('should have routes defined', () => {
    const routes = (profileRoutes as any).stack || [];
    expect(routes.length).toBeGreaterThan(0);
  });
  
  describe('GET /', () => {
    it('should return user profile', async () => {
      // Mock User.findById().select().lean() chain
      const mockUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          isVerifiedProfessional: false
        },
        phone: '1234567890',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '0987654321'
        }
      };
      
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        })
      });
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith(userId);
    });
    
    it('should handle errors when fetching profile', async () => {
      // Mock User.findById to throw an error
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to fetch profile');
    });
  });
  
  describe('PATCH /', () => {
    it('should update user profile successfully', async () => {
      // Update data
      const updateData = {
        username: 'updateduser',
        phone: '5555555555',
        emergencyContact: {
          name: 'New Emergency Contact',
          relationship: 'Friend',
          phone: '6666666666'
        }
      };
      
      // Mock user for username check
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // Mock updated user
      const updatedUser = {
        _id: userId,
        username: updateData.username,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          isVerifiedProfessional: false
        },
        phone: updateData.phone,
        emergencyContact: updateData.emergencyContact
      };
      
      // Create a chainable mock to handle the method chaining pattern
      const mockChain = {
        select: jest.fn().mockResolvedValue(updatedUser)
      };
      
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue(mockChain);
      
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedUser);
      
      // Check that username uniqueness was checked
      expect(User.findOne).toHaveBeenCalledWith({ username: updateData.username });
      
      // Check update call
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $set: {
            username: updateData.username,
            phone: updateData.phone,
            emergencyContact: updateData.emergencyContact
          }
        },
        { new: true }
      );
      
      // Check that select was called
      expect(mockChain.select).toHaveBeenCalled();
    });
    
    it('should return 400 if username is already taken', async () => {
      // Update data with username that's already taken
      const updateData = {
        username: 'existinguser'
      };
      
      // Mock existing user with same username
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(), // Different from userId
        username: updateData.username
      });
      
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Username already taken');
      
      // Ensure update wasn't called
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    
    it('should maintain existing values if fields are not provided', async () => {
      // Update with only phone
      const updateData = {
        phone: '5555555555'
      };
      
      // Mock updated user
      const updatedUser = {
        _id: userId,
        username: 'testuser', // Original username
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          isVerifiedProfessional: false
        },
        phone: updateData.phone,
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '0987654321'
        }
      };
      
      // Create a chainable mock
      const mockChain = {
        select: jest.fn().mockResolvedValue(updatedUser)
      };
      
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue(mockChain);
      
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedUser);
      
      // Check that select was called
      expect(mockChain.select).toHaveBeenCalled();
    });
    
    it('should handle errors during update', async () => {
      const updateData = {
        username: 'updateduser'
      };
      
      // Mock username check
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // Create a chainable mock that will throw an error
      const mockChain = {
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue(mockChain);
      
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to update profile');
      
      // Check that select was called
      expect(mockChain.select).toHaveBeenCalled();
    });
  });
});