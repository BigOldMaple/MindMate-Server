// src/services/__tests__/healthTestingService.test.ts
import { Types } from 'mongoose';
import { healthTestingService } from '../healthTestingService';
import { HealthData } from '../../Database/HealthDataSchema';

// Mock dependencies
jest.mock('../../Database/HealthDataSchema');

describe('Health Testing Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test generateTestData method
  describe('generateTestData', () => {
    it('should generate test data with "good" pattern for 7 days', async () => {
      // Mock HealthData.deleteMany
      (HealthData.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 3 });
      
      // Mock save method for HealthData instances
      const mockSave = jest.fn().mockResolvedValue(true);
      
      // Mock HealthData constructor to return proper object structure
      (HealthData as jest.MockedClass<typeof HealthData>).mockImplementation(() => ({
        save: mockSave,
        date: new Date(),
        userId: new Types.ObjectId(),
        weekNumber: 1,
        month: 1,
        year: 2023,
        steps: undefined,
        distance: undefined,
        sleep: undefined,
        exercises: [],
        summary: {
          totalSteps: 0,
          totalDistanceMeters: 0,
          totalSleepSeconds: 0,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        lastSyncedAt: new Date()
      } as any));
      
      // Use past date (yesterday) to avoid validation error for future dates
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startDate = yesterday.toISOString().split('T')[0]; // Yesterday's date in YYYY-MM-DD format
      
      const userId = new Types.ObjectId().toString();
      const days = 7;
      const pattern = 'good';
      
      // Call the method being tested
      const result = await healthTestingService.generateTestData({
        pattern,
        startDate,
        days,
        userId
      });
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully generated good test data');
      
      // Verify HealthData.deleteMany was called with correct parameters
      expect(HealthData.deleteMany).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        date: expect.objectContaining({
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        })
      });
      
      // Verify HealthData constructor was called for each day
      expect(HealthData).toHaveBeenCalledTimes(days);
      
      // Verify save method was called for each day
      expect(mockSave).toHaveBeenCalledTimes(days);
      
      // Verify metrics in the response
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.daysGenerated).toBe(days);
      expect(result.metrics?.recordsDeleted).toBe(3);
    });

    it('should generate test data with "declining" pattern for 7 days', async () => {
      // Mock HealthData.deleteMany
      (HealthData.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });
      
      // Mock save method
      const mockSave = jest.fn().mockResolvedValue(true);
      
      // Mock HealthData constructor
      (HealthData as jest.MockedClass<typeof HealthData>).mockImplementation(() => ({
        save: mockSave,
        date: new Date(),
        userId: new Types.ObjectId(),
        weekNumber: 1,
        month: 1,
        year: 2023,
        steps: undefined,
        distance: undefined,
        sleep: undefined,
        exercises: [],
        summary: {
          totalSteps: 0,
          totalDistanceMeters: 0,
          totalSleepSeconds: 0,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        lastSyncedAt: new Date()
      } as any));
      
      // Use past date (yesterday) to avoid validation error for future dates
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startDate = yesterday.toISOString().split('T')[0]; // Yesterday's date in YYYY-MM-DD format
      
      const userId = new Types.ObjectId().toString();
      const days = 7;
      const pattern = 'declining';
      
      // Call the method being tested
      const result = await healthTestingService.generateTestData({
        pattern,
        startDate,
        days,
        userId
      });
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully generated declining test data');
      
      // Verify HealthData.deleteMany was called
      expect(HealthData.deleteMany).toHaveBeenCalled();
      
      // Verify HealthData constructor was called for each day
      expect(HealthData).toHaveBeenCalledTimes(days);
      
      // Verify save method was called for each day
      expect(mockSave).toHaveBeenCalledTimes(days);
      
      // Verify metrics in the response
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.daysGenerated).toBe(days);
      expect(result.metrics?.recordsDeleted).toBe(0);
    });

    it('should fail when start date is in the future', async () => {
      // Mock HealthData.deleteMany
      (HealthData.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });
      
      // Create a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0]; // Tomorrow's date in YYYY-MM-DD format
      
      const userId = new Types.ObjectId().toString();
      const days = 7;
      const pattern = 'good';
      
      // Call the method being tested
      const result = await healthTestingService.generateTestData({
        pattern,
        startDate,
        days,
        userId
      });
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('Start date cannot be in the future');
      
      // Verify HealthData.deleteMany was not called
      expect(HealthData.deleteMany).not.toHaveBeenCalled();
    });
  });

  // Test clearTestData method
  describe('clearTestData', () => {
    it('should delete all health data in the specified date range', async () => {
      // Mock HealthData.deleteMany
      (HealthData.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 7 });
      
      // Test parameters - use past dates
      const userId = new Types.ObjectId().toString();
      const startDate = '2023-01-01';
      const endDate = '2023-01-07';
      
      // Call the method being tested
      const result = await healthTestingService.clearTestData(userId, startDate, endDate);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cleared 7 test data records');
      expect(result.count).toBe(7);
      
      // Verify HealthData.deleteMany was called with correct parameters
      expect(HealthData.deleteMany).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });
    });
  });
});