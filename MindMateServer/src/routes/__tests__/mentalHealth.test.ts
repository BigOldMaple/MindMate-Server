import request from 'supertest';
import express from 'express';
import { auth } from '../../services/auth';
import { llmAnalysisService } from '../../services/llmAnalysisService';
import { peerSupportService } from '../../services/peerSupportService';
import mentalHealthRoutes from '../mentalHealth';
import { MentalHealthState } from '../../Database/MentalHealthStateSchema';
import { MentalHealthBaseline } from '../../Database/MentalHealthBaselineSchema';
import mongoose from 'mongoose';

// Mock the dependencies
jest.mock('../../services/auth');
jest.mock('../../services/llmAnalysisService');
jest.mock('../../services/peerSupportService');
jest.mock('../../Database/MentalHealthStateSchema');
jest.mock('../../Database/MentalHealthBaselineSchema');

describe('Mental Health Routes', () => {
  let app: express.Application;
  const userId = new mongoose.Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/mental-health', mentalHealthRoutes);
    
    // Mock auth middleware to set userId in request
    (auth.verifyToken as jest.Mock).mockReturnValue({ userId });
  });
  
  describe('GET /assessment', () => {
    it('should return the latest assessment', async () => {
      // Create a date and immediately convert to ISO string to match JSON serialization
      const mockDate = new Date().toISOString();
      const mockId = new mongoose.Types.ObjectId().toString();
      
      const mockAssessment = {
        _id: mockId,
        userId,
        timestamp: mockDate, // Use string format
        mentalHealthStatus: 'stable',
        confidenceScore: 0.85,
        reasoningData: {
          sleepHours: 7.5,
          sleepQuality: 'good',
          activityLevel: 'moderate',
          checkInMood: 4
        }
      };
      
      // Mock the findOne call and chain
      (MentalHealthState.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockAssessment)
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/assessment')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAssessment);
      expect(MentalHealthState.findOne).toHaveBeenCalledWith({
        userId: expect.any(Object)
      });
    });
    
    it('should return 404 when no assessment is found', async () => {
      (MentalHealthState.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(null)
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/assessment')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /baseline', () => {
    it('should return the latest baseline', async () => {
      // Create a date and immediately convert to ISO string
      const mockDate = new Date().toISOString();
      const mockId = new mongoose.Types.ObjectId().toString();
      
      const mockBaseline = {
        _id: mockId,
        userId,
        establishedAt: mockDate, // Use string format
        baselineMetrics: {
          sleepHours: 7.5,
          sleepQuality: 'good',
          activityLevel: 'moderate',
          averageMoodScore: 4
        },
        confidenceScore: 0.9
      };
      
      (MentalHealthBaseline.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockBaseline)
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/baseline')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBaseline);
    });
    
    it('should return 404 when no baseline is found', async () => {
      (MentalHealthBaseline.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(null)
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/baseline')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /assess', () => {
    it('should trigger analysis and return results', async () => {
      const mockAnalysisResult = {
        mentalHealthStatus: 'stable',
        confidenceScore: 0.85,
        reasoningData: {
          sleepQuality: 'good',
          activityLevel: 'moderate',
          checkInMood: 4,
          significantChanges: []
        },
        needsSupport: false
      };
      
      (llmAnalysisService.analyzeRecentHealth as jest.Mock).mockResolvedValue(mockAnalysisResult);
      
      const response = await request(app)
        .post('/api/mental-health/assess')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(llmAnalysisService.analyzeRecentHealth).toHaveBeenCalledWith(userId);
      expect(response.body).toMatchObject({
        message: expect.any(String),
        status: mockAnalysisResult.mentalHealthStatus,
        needsSupport: mockAnalysisResult.needsSupport
      });
    });
    
    it('should handle errors during analysis', async () => {
      (llmAnalysisService.analyzeRecentHealth as jest.Mock).mockRejectedValue(
        new Error('Analysis failed')
      );
      
      const response = await request(app)
        .post('/api/mental-health/assess')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /establish-baseline', () => {
    it('should trigger baseline analysis and return results', async () => {
      const mockBaselineResult = {
        mentalHealthStatus: 'stable',
        confidenceScore: 0.9,
        reasoningData: {
          sleepHours: 7.5,
          sleepQuality: 'good',
          activityLevel: 'moderate',
          checkInMood: 4,
          stepsPerDay: 8000,
          recentExerciseMinutes: 120,
          significantChanges: []
        }
      };
      
      (llmAnalysisService.establishBaseline as jest.Mock).mockResolvedValue(mockBaselineResult);
      
      // Mock for fetching the saved baseline
      (MentalHealthBaseline.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            dataPoints: {
              totalDays: 30,
              daysWithSleepData: 25,
              daysWithActivityData: 28,
              checkInsCount: 15
            }
          })
        })
      });
      
      const response = await request(app)
        .post('/api/mental-health/establish-baseline')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(llmAnalysisService.establishBaseline).toHaveBeenCalledWith(userId);
      expect(response.body).toHaveProperty('baselineMetrics');
      expect(response.body).toHaveProperty('confidenceScore');
    });
  });
  
  describe('GET /history', () => {
    it('should return assessment history with default limit', async () => {
      // Use string dates
      const currentDate = new Date().toISOString();
      const previousDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      
      const mockAssessments = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          timestamp: currentDate,
          mentalHealthStatus: 'stable',
          confidenceScore: 0.85
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          timestamp: previousDate,
          mentalHealthStatus: 'stable',
          confidenceScore: 0.8
        }
      ];
      
      (MentalHealthState.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockAssessments)
            })
          })
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/history')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAssessments);
      expect(MentalHealthState.find).toHaveBeenCalledWith(expect.any(Object));
    });
    
    it('should return assessment history with custom limit', async () => {
      // Use string date
      const currentDate = new Date().toISOString();
      
      const mockAssessments = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          timestamp: currentDate,
          mentalHealthStatus: 'stable',
          confidenceScore: 0.85
        }
      ];
      
      (MentalHealthState.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockAssessments)
            })
          })
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/history?limit=5')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAssessments);
      
      // Verify the limit was passed
      const findSelectSortLimitMock = (MentalHealthState.find as jest.Mock)()
        .select().sort().limit;
      expect(findSelectSortLimitMock).toHaveBeenCalledWith(5);
    });
  });
  
  describe('GET /stats', () => {
    it('should return assessment statistics for default days period', async () => {
      const mockAssessments = [
        {
          mentalHealthStatus: 'stable',
          confidenceScore: 0.85,
          timestamp: new Date().toISOString(),
          reasoningData: {
            sleepQuality: 'good',
            activityLevel: 'moderate',
            checkInMood: 4
          }
        }
      ];
      
      (MentalHealthState.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockAssessments)
      });
      
      (MentalHealthBaseline.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            establishedAt: new Date().toISOString(),
            baselineMetrics: {
              sleepQuality: 'good',
              activityLevel: 'moderate',
              averageMoodScore: 4
            },
            confidenceScore: 0.9
          })
        })
      });
      
      const response = await request(app)
        .get('/api/mental-health/stats')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalAssessments');
      expect(response.body).toHaveProperty('statusDistribution');
      expect(response.body).toHaveProperty('baseline');
    });
  });
  
  describe('POST /provide-support/:assessmentId', () => {
    it('should record support provided', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      
      (peerSupportService.recordSupportProvided as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post(`/api/mental-health/provide-support/${assessmentId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Support provided successfully');
      expect(peerSupportService.recordSupportProvided).toHaveBeenCalledWith(
        expect.any(Object),
        userId
      );
    });
    
    it('should return 404 when assessment not found', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      
      (peerSupportService.recordSupportProvided as jest.Mock).mockResolvedValue(false);
      
      const response = await request(app)
        .post(`/api/mental-health/provide-support/${assessmentId}`)
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /buddy-support-requests', () => {
    it('should return list of buddy support requests', async () => {
      const mockRequests = [
        {
          _id: new mongoose.Types.ObjectId().toString(), // Use string format
          userId: new mongoose.Types.ObjectId().toString(), // Use string format
          mentalHealthStatus: 'declining',
          needsSupport: true,
          supportRequestStatus: 'buddyRequested'
        }
      ];
      
      (peerSupportService.getActiveSupportRequests as jest.Mock).mockResolvedValue(mockRequests);
      
      const response = await request(app)
        .get('/api/mental-health/buddy-support-requests')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRequests);
      expect(peerSupportService.getActiveSupportRequests).toHaveBeenCalledWith('buddy', userId);
    });
  });
});