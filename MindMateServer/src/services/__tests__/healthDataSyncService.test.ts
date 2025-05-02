import { healthDataSyncService } from '../healthDataSyncService';
import { HealthData } from '../../Database/HealthDataSchema';
import { DeviceToken } from '../../Database/DeviceTokenSchema';
import mongoose, { Types } from 'mongoose';

// Mock dependencies
jest.mock('../../Database/HealthDataSchema');
jest.mock('../../Database/DeviceTokenSchema');

describe('Health Data Sync Service', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveHealthData', () => {
    it('should process and save health data successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const mockHealthData = {
        steps: {
          count: 8000,
          startTime: '2025-05-01T08:00:00Z',
          endTime: '2025-05-01T22:00:00Z',
          dataOrigins: ['HealthKit']
        },
        sleep: {
          startTime: '2025-04-30T23:00:00Z',
          endTime: '2025-05-01T07:00:00Z',
          durationInSeconds: 28800,
          quality: 'good',
          dataOrigins: ['HealthKit']
        }
      };

      // Mock process methods
      const processStepsSpy = jest.spyOn(healthDataSyncService as any, 'processStepsData')
        .mockResolvedValue(undefined);
      const processSleepSpy = jest.spyOn(healthDataSyncService as any, 'processSleepData')
        .mockResolvedValue(undefined);
      
      // Mock DeviceToken.updateMany
      (DeviceToken.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      // Execute
      const result = await healthDataSyncService.saveHealthData(userId, mockHealthData);

      // Verify
      expect(result.success).toBe(true);
      expect(result.message).toContain('steps');
      expect(result.message).toContain('sleep');
      expect(processStepsSpy).toHaveBeenCalledWith(userId, mockHealthData.steps);
      expect(processSleepSpy).toHaveBeenCalledWith(userId, mockHealthData.sleep);
      expect(DeviceToken.updateMany).toHaveBeenCalledWith(
        { userId: expect.any(Types.ObjectId) },
        { $set: { 'metadata.lastHealthSync': expect.any(Date) } }
      );

      // Restore mocks
      processStepsSpy.mockRestore();
      processSleepSpy.mockRestore();
    });

    it('should return failure when processing throws an error', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const mockHealthData = {
        steps: {
          count: 8000,
          startTime: '2025-05-01T08:00:00Z',
          endTime: '2025-05-01T22:00:00Z'
        }
      };

      // Mock process method to throw error
      const processStepsSpy = jest.spyOn(healthDataSyncService as any, 'processStepsData')
        .mockRejectedValue(new Error('Database error'));

      // Execute
      const result = await healthDataSyncService.saveHealthData(userId, mockHealthData);

      // Verify
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save health data');
      expect(processStepsSpy).toHaveBeenCalledWith(userId, mockHealthData.steps);
      expect(DeviceToken.updateMany).not.toHaveBeenCalled();

      // Restore mock
      processStepsSpy.mockRestore();
    });
  });

  describe('processStepsData', () => {
    it('should update existing document with steps data', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const stepsData = {
        count: 10000,
        startTime: '2025-05-01T08:00:00Z',
        endTime: '2025-05-01T22:00:00Z',
        dataOrigins: ['HealthKit']
      };
      
      // Expected date based on startTime (midnight of the day)
      const recordDate = new Date('2025-05-01T00:00:00Z');
      
      // Mock existing document
      const mockExistingDoc = {
        _id: new mongoose.Types.ObjectId(),
        summary: {
          totalDistanceMeters: 5000,
          totalSleepSeconds: 28800
        },
        exercises: [{ durationInSeconds: 1800 }],
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Mock HealthData.findOneAndUpdate to return existing document
      (HealthData.findOneAndUpdate as jest.Mock).mockResolvedValue(mockExistingDoc);
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processStepsData(userId, stepsData);
      
      // Verify
      expect(HealthData.findOneAndUpdate).toHaveBeenCalledWith(
        { 
          userId: expect.any(Types.ObjectId),
          date: expect.any(Date)
        },
        {
          $set: { 
            steps: expect.objectContaining({
              count: 10000,
              startTime: expect.any(Date),
              endTime: expect.any(Date)
            }),
            'summary.totalSteps': 10000,
            lastSyncedAt: expect.any(Date)
          }
        },
        { new: true }
      );
      expect(mockExistingDoc.save).not.toHaveBeenCalled(); // Since no changes needed to the summary
    });

    it('should create new document when none exists', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const stepsData = {
        count: 10000,
        startTime: '2025-05-01T08:00:00Z',
        endTime: '2025-05-01T22:00:00Z',
        dataOrigins: ['HealthKit']
      };
      
      // Mock HealthData.findOneAndUpdate to return null (no existing doc)
      (HealthData.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      
      // Mock HealthData.create
      (HealthData.create as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        userId,
        date: new Date('2025-05-01T00:00:00Z'),
        steps: {
          count: 10000,
          startTime: new Date(stepsData.startTime),
          endTime: new Date(stepsData.endTime)
        }
      });
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processStepsData(userId, stepsData);
      
      // Verify
      expect(HealthData.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        date: expect.any(Date),
        weekNumber: expect.any(Number),
        month: expect.any(Number),
        year: expect.any(Number),
        steps: expect.objectContaining({
          count: 10000
        }),
        exercises: [],
        summary: expect.objectContaining({
          totalSteps: 10000,
          totalDistanceMeters: 0,
          totalSleepSeconds: 0,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        })
      }));
    });
  });

  describe('processSleepData', () => {
    it('should update existing document with sleep data', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const sleepData = {
        startTime: '2025-04-30T23:00:00Z',
        endTime: '2025-05-01T07:00:00Z',
        durationInSeconds: 28800,
        quality: 'good',
        dataOrigins: ['HealthKit']
      };
      
      // Mock existing document
      const mockExistingDoc = {
        _id: new mongoose.Types.ObjectId(),
        summary: {
          totalSteps: 8000,
          totalDistanceMeters: 5000
        },
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Mock HealthData.findOneAndUpdate to return existing document
      (HealthData.findOneAndUpdate as jest.Mock).mockResolvedValue(mockExistingDoc);
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processSleepData(userId, sleepData);
      
      // Verify
      expect(HealthData.findOneAndUpdate).toHaveBeenCalledWith(
        { 
          userId: expect.any(Types.ObjectId),
          date: expect.any(Date)
        },
        {
          $set: { 
            sleep: expect.objectContaining({
              startTime: expect.any(Date),
              endTime: expect.any(Date),
              durationInSeconds: 28800,
              quality: 'good'
            }),
            'summary.totalSleepSeconds': 28800,
            lastSyncedAt: expect.any(Date)
          }
        },
        { new: true }
      );
    });

    it('should create new document when none exists', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const sleepData = {
        startTime: '2025-04-30T23:00:00Z',
        endTime: '2025-05-01T07:00:00Z',
        durationInSeconds: 28800,
        quality: 'good',
        dataOrigins: ['HealthKit']
      };
      
      // Mock HealthData.findOneAndUpdate to return null (no existing doc)
      (HealthData.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      
      // Mock HealthData.create
      (HealthData.create as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        userId,
        date: new Date('2025-05-01T00:00:00Z'),
        sleep: {
          startTime: new Date(sleepData.startTime),
          endTime: new Date(sleepData.endTime),
          durationInSeconds: 28800,
          quality: 'good'
        }
      });
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processSleepData(userId, sleepData);
      
      // Verify
      expect(HealthData.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        date: expect.any(Date),
        sleep: expect.objectContaining({
          durationInSeconds: 28800,
          quality: 'good'
        }),
        summary: expect.objectContaining({
          totalSleepSeconds: 28800
        })
      }));
    });
  });

  describe('processExerciseData', () => {
    it('should add exercise to existing document', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const exerciseData = {
        type: 'Running',
        startTime: '2025-05-01T16:00:00Z',
        endTime: '2025-05-01T17:00:00Z',
        durationInSeconds: 3600,
        calories: 350,
        dataOrigins: ['HealthKit']
      };
      
      // Mock existing document with exercises array
      const mockExistingDoc = {
        _id: new mongoose.Types.ObjectId(),
        exercises: [], // Start with empty array
        summary: {
          totalSteps: 8000,
          totalDistanceMeters: 5000,
          totalSleepSeconds: 28800,
          totalExerciseSeconds: 0,
          exerciseCount: 0
        },
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Mock HealthData.findOne to return existing document
      (HealthData.findOne as jest.Mock).mockResolvedValue(mockExistingDoc);
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processExerciseData(userId, exerciseData);
      
      // Verify - check the state changes rather than the method call
      expect(HealthData.findOne).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        date: expect.any(Date)
      });
      
      // Verify the exercise was added to the array
      expect(mockExistingDoc.exercises.length).toBe(1);
      expect(mockExistingDoc.exercises[0]).toEqual(expect.objectContaining({
        type: 'Running',
        durationInSeconds: 3600,
        calories: 350
      }));
      
      // Verify summary was updated
      expect(mockExistingDoc.summary.totalExerciseSeconds).toBe(3600);
      expect(mockExistingDoc.summary.exerciseCount).toBe(1);
      expect(mockExistingDoc.save).toHaveBeenCalled();
    });

    it('should create new document when none exists', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const exerciseData = {
        type: 'Running',
        startTime: '2025-05-01T16:00:00Z',
        endTime: '2025-05-01T17:00:00Z',
        durationInSeconds: 3600,
        calories: 350,
        dataOrigins: ['HealthKit']
      };
      
      // Mock HealthData.findOne to return null (no existing doc)
      (HealthData.findOne as jest.Mock).mockResolvedValue(null);
      
      // Mock HealthData.create
      (HealthData.create as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        userId,
        date: new Date('2025-05-01T00:00:00Z'),
        exercises: [{
          type: 'Running',
          startTime: new Date(exerciseData.startTime),
          endTime: new Date(exerciseData.endTime),
          durationInSeconds: 3600,
          calories: 350
        }]
      });
      
      // Execute - call the private method directly
      await (healthDataSyncService as any).processExerciseData(userId, exerciseData);
      
      // Verify
      expect(HealthData.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        date: expect.any(Date),
        exercises: [expect.objectContaining({
          type: 'Running',
          durationInSeconds: 3600
        })],
        summary: expect.objectContaining({
          totalExerciseSeconds: 3600,
          exerciseCount: 1
        })
      }));
    });
  });

  describe('getAggregatedHealthData', () => {
    it('should return aggregated data by day', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const startDate = new Date('2025-05-01');
      const endDate = new Date('2025-05-07');
      
      // Mock aggregation result
      const mockAggregationResult = [
        {
          _id: { year: 2025, month: 5, day: 1 },
          totalSteps: 8000,
          totalDistanceMeters: 6000,
          totalSleepSeconds: 28800,
          totalExerciseSeconds: 3600,
          totalExerciseCount: 1,
          days: 1,
          firstDate: new Date('2025-05-01'),
          lastDate: new Date('2025-05-01')
        },
        {
          _id: { year: 2025, month: 5, day: 2 },
          totalSteps: 10000,
          totalDistanceMeters: 7500,
          totalSleepSeconds: 27000,
          totalExerciseSeconds: 4500,
          totalExerciseCount: 2,
          days: 1,
          firstDate: new Date('2025-05-02'),
          lastDate: new Date('2025-05-02')
        }
      ];
      
      // Mock HealthData.aggregate
      (HealthData.aggregate as jest.Mock).mockResolvedValue(mockAggregationResult);
      
      // Execute
      const result = await healthDataSyncService.getAggregatedHealthData(
        userId,
        startDate,
        endDate,
        'daily'
      );
      
      // Verify
      expect(HealthData.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $match: expect.any(Object) },
        { $group: expect.any(Object) },
        { $sort: expect.any(Object) }
      ]));
      expect(result.aggregateBy).toBe('daily');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('totalSteps', 8000);
      expect(result.data[0]).toHaveProperty('totalDistanceKm', 6);
      expect(result.data[0]).toHaveProperty('totalSleepHours', 8);
      expect(result.data[0]).toHaveProperty('totalExerciseMinutes', 60);
    });

    it('should return aggregated data by week', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const startDate = new Date('2025-05-01');
      const endDate = new Date('2025-05-14');
      
      // Mock aggregation result
      const mockAggregationResult = [
        {
          _id: { year: 2025, week: 18 },
          totalSteps: 50000,
          totalDistanceMeters: 37500,
          totalSleepSeconds: 151200,
          totalExerciseSeconds: 10800,
          totalExerciseCount: 5,
          days: 5,
          firstDate: new Date('2025-05-01'),
          lastDate: new Date('2025-05-05')
        },
        {
          _id: { year: 2025, week: 19 },
          totalSteps: 45000,
          totalDistanceMeters: 33750,
          totalSleepSeconds: 144000,
          totalExerciseSeconds: 9000,
          totalExerciseCount: 4,
          days: 5,
          firstDate: new Date('2025-05-06'),
          lastDate: new Date('2025-05-10')
        }
      ];
      
      // Mock HealthData.aggregate
      (HealthData.aggregate as jest.Mock).mockResolvedValue(mockAggregationResult);
      
      // Execute
      const result = await healthDataSyncService.getAggregatedHealthData(
        userId,
        startDate,
        endDate,
        'weekly'
      );
      
      // Verify
      expect(HealthData.aggregate).toHaveBeenCalled();
      expect(result.aggregateBy).toBe('weekly');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('period', '2025-W18');
      expect(result.data[0]).toHaveProperty('totalSteps', 50000);
      expect(result.data[0]).toHaveProperty('totalDistanceKm', 37.5);
      expect(result.data[0]).toHaveProperty('totalSleepHours', 42);
      expect(result.data[0]).toHaveProperty('totalExerciseMinutes', 180);
    });
  });

  describe('getLastSyncTime', () => {
    it('should return the timestamp of the last sync', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const mockLastSyncTime = new Date('2025-05-01T23:00:00Z');
      
      // Mock HealthData.findOne
      (HealthData.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            lastSyncedAt: mockLastSyncTime
          })
        })
      });
      
      // Execute
      const result = await healthDataSyncService.getLastSyncTime(userId);
      
      // Verify
      expect(HealthData.findOne).toHaveBeenCalledWith({ 
        userId: expect.any(Types.ObjectId) 
      });
      expect(result).toEqual(mockLastSyncTime);
    });

    it('should return null when no sync history exists', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Mock HealthData.findOne
      (HealthData.findOne as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(null)
        })
      });
      
      // Execute
      const result = await healthDataSyncService.getLastSyncTime(userId);
      
      // Verify
      expect(result).toBeNull();
    });
  });
});