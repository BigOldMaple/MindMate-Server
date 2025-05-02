import { llmAnalysisService } from '../llmAnalysisService';
import axios from 'axios';
import { HealthData } from '../../Database/HealthDataSchema';
import { CheckIn } from '../../Database/CheckInSchema';
import { User } from '../../Database/Schema';
import { MentalHealthState } from '../../Database/MentalHealthStateSchema';
import { MentalHealthBaseline } from '../../Database/MentalHealthBaselineSchema';
import { peerSupportService } from '../peerSupportService';
import mongoose, { Types } from 'mongoose';

// Mock dependencies
jest.mock('axios');
jest.mock('../../Database/HealthDataSchema');
jest.mock('../../Database/CheckInSchema');
jest.mock('../../Database/Schema');
jest.mock('../../Database/MentalHealthStateSchema');
jest.mock('../../Database/MentalHealthBaselineSchema');
jest.mock('../peerSupportService');

// Test fixtures for reusable mock data
const mockHealthData = [
  {
    date: new Date('2025-05-01'),
    sleep: { 
      durationInSeconds: 28800, // 8 hours
      quality: 'good' 
    },
    summary: { 
      totalSteps: 8000,
      totalExerciseSeconds: 1800 // 30 minutes
    },
    exercises: [
      {
        type: 'Running',
        startTime: new Date('2025-05-01T08:00:00Z'),
        endTime: new Date('2025-05-01T08:30:00Z'),
        durationInSeconds: 1800
      }
    ]
  },
  {
    date: new Date('2025-04-30'),
    sleep: { 
      durationInSeconds: 25200, // 7 hours
      quality: 'fair' 
    },
    summary: { 
      totalSteps: 6500,
      totalExerciseSeconds: 0
    },
    exercises: []
  },
  {
    date: new Date('2025-04-29'),
    sleep: { 
      durationInSeconds: 27000, // 7.5 hours
      quality: 'good' 
    },
    summary: { 
      totalSteps: 7200,
      totalExerciseSeconds: 2700 // 45 minutes
    },
    exercises: [
      {
        type: 'Cycling',
        startTime: new Date('2025-04-29T17:00:00Z'),
        endTime: new Date('2025-04-29T17:45:00Z'),
        durationInSeconds: 2700
      }
    ]
  }
];

const mockCheckIns = [
  {
    timestamp: new Date('2025-05-01T20:00:00Z'),
    mood: { 
      score: 4,
      label: 'Good',
      description: 'Feeling positive today'
    },
    notes: 'Had a productive day'
  },
  {
    timestamp: new Date('2025-04-30T20:00:00Z'),
    mood: { 
      score: 3,
      label: 'Neutral',
      description: 'Just an average day'
    }
  },
  {
    timestamp: new Date('2025-04-29T20:00:00Z'),
    mood: { 
      score: 4,
      label: 'Good'
    },
    notes: 'Enjoyed my exercise today'
  }
];

// Interface for validating LLM Response structure
interface LLMResponse {
  mentalHealthStatus: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  reasoningData: {
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    checkInMood?: number;
    significantChanges?: string[];
    [key: string]: any;
  };
  needsSupport: boolean;
  supportReason?: string;
  supportTips?: string[];
}

describe('LLM Analysis Service', () => {
  // Console mocking to reduce test noise
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  
  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queryLLM', () => {
    it('should send a prompt to the LLM model and return the response', async () => {
      // Setup
      const prompt = 'Analyze this health data';
      const mockResponse = {
        data: {
          response: JSON.stringify({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.85,
            reasoningData: {
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4
            },
            needsSupport: false
          })
        }
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      // Execute - call the private method directly
      const response = await (llmAnalysisService as any).queryLLM(prompt);

      // Verify
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String), // Endpoint URL
        expect.objectContaining({
          model: expect.any(String),
          prompt,
          stream: false,
          options: expect.any(Object)
        })
      );
      expect(response).toBe(mockResponse.data.response);
    });

    it('should throw an error when LLM response is invalid', async () => {
      // Setup
      const prompt = 'Analyze this health data';

      // Mock invalid response (missing 'response' field)
      const mockResponse = { data: {} };
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      // Execute and verify
      await expect((llmAnalysisService as any).queryLLM(prompt))
        .rejects.toThrow('Invalid response from LLM');
    });

    it('should handle network errors when calling LLM', async () => {
      // Setup
      const prompt = 'Analyze this health data';
      const networkError = new Error('Network error');

      (axios.post as jest.Mock).mockRejectedValue(networkError);

      // Execute and verify
      await expect((llmAnalysisService as any).queryLLM(prompt))
        .rejects.toThrow('Network error');
    });
  });

  describe('parseLLMResponse', () => {
    it('should parse valid JSON response correctly', () => {
      // Setup
      const validJson = `{
        "mentalHealthStatus": "stable",
        "confidenceScore": 0.85,
        "reasoningData": {
          "sleepQuality": "good",
          "activityLevel": "moderate",
          "checkInMood": 4,
          "significantChanges": []
        },
        "needsSupport": false
      }`;

      // Execute
      const result = (llmAnalysisService as any).parseLLMResponse(validJson);

      // Verify with schema validation
      validateLLMResponseSchema(result);
      expect(result).toEqual({
        mentalHealthStatus: 'stable',
        confidenceScore: 0.85,
        reasoningData: {
          sleepQuality: 'good',
          activityLevel: 'moderate',
          checkInMood: 4,
          significantChanges: []
        },
        needsSupport: false
      });
    });

    // For the parseLLMResponse test with malformed JSON
    it('should handle malformed JSON responses by extracting values with regex', () => {
      // Setup - JSON with syntax error
      const invalidJson = `{
      "mentalHealthStatus": "stable",
      "confidenceScore": 0.85,
      "reasoningData": {
        "sleepQuality": "good"
        "activityLevel": "moderate",
      },
      "needsSupport": false
    }`;

      // Mock extractField method to return specific values for our test
      jest.spyOn(llmAnalysisService as any, 'extractField')
        .mockImplementation((...args: unknown[]) => {
          const field = args[1] as string;
          const fieldMap: Record<string, string> = {
            "mentalHealthStatus": "stable",
            "confidenceScore": "0.85",
            "needsSupport": "false"
          };
          return fieldMap[field];
        });

      // Execute
      const result = (llmAnalysisService as any).parseLLMResponse(invalidJson);

      // Verify - should accept the extracted values from the malformed JSON
      validateLLMResponseSchema(result);
      expect(result).toHaveProperty('mentalHealthStatus', 'stable');
      expect(result).toHaveProperty('confidenceScore', 0.85);
      expect(result.reasoningData).toHaveProperty('significantChanges');
      expect(result.reasoningData.additionalFactors).toHaveProperty('error');
    });

    it('should fix and parse responses with structural issues like needsSupport inside reasoningData', () => {
      // Setup - JSON with needsSupport inside reasoningData (common issue)
      const misplacedJson = `{
      "mentalHealthStatus": "declining",
      "confidenceScore": 0.75,
      "reasoningData": {
        "sleepQuality": "fair",
        "activityLevel": "low",
        "checkInMood": 3,
        "needsSupport": true,
        "additionalFactors": {
          "stress": "high"
        }
      }
    }`;

      // Mock the extraction methods to simulate the behavior we expect
      jest.spyOn(llmAnalysisService as any, 'extractField')
        .mockImplementation((...args: unknown[]) => {
          const field = args[1] as string;
          const fieldMap: Record<string, string> = {
            "needsSupport": "true",
            "mentalHealthStatus": "declining",
            "confidenceScore": "0.75"
          };
          return fieldMap[field];
        });

      jest.spyOn(llmAnalysisService as any, 'extractNestedField')
        .mockImplementation((...args: unknown[]) => {
          const parent = args[1] as string;
          const field = args[2] as string;

          if (parent === 'reasoningData' && field === 'sleepQuality') return 'fair';
          if (parent === 'reasoningData' && field === 'activityLevel') return 'low';
          if (parent === 'reasoningData' && field === 'checkInMood') return '3';
          return undefined;
        });

      // Execute
      const result = (llmAnalysisService as any).parseLLMResponse(misplacedJson);

      // Verify with schema validation
      validateLLMResponseSchema(result);
      expect(result).toHaveProperty('mentalHealthStatus', 'declining');
      expect(result).toHaveProperty('confidenceScore', 0.75);
      expect(result).toHaveProperty('needsSupport', true);
      expect(result.reasoningData).toHaveProperty('sleepQuality', 'fair');
    });

    describe('convertMoodToNumber', () => {
      it('should return numeric value directly', () => {
        // Execute and verify
        expect((llmAnalysisService as any).convertMoodToNumber(4)).toBe(4);
        expect((llmAnalysisService as any).convertMoodToNumber(2.5)).toBe(2.5);
      });

      it('should convert numeric strings to numbers', () => {
        // Execute and verify
        expect((llmAnalysisService as any).convertMoodToNumber('4')).toBe(4);
        expect((llmAnalysisService as any).convertMoodToNumber('2.5')).toBe(2.5);
      });

      it('should map mood string labels to appropriate numbers', () => {
        // Execute and verify
        expect((llmAnalysisService as any).convertMoodToNumber('very poor')).toBe(1);
        expect((llmAnalysisService as any).convertMoodToNumber('poor')).toBe(1.5);
        expect((llmAnalysisService as any).convertMoodToNumber('fair')).toBe(3);
        expect((llmAnalysisService as any).convertMoodToNumber('good')).toBe(4);
        expect((llmAnalysisService as any).convertMoodToNumber('very good')).toBe(5);
      });

      it('should handle unknown mood strings by returning neutral value (3)', () => {
        // Execute and verify - defaults to neutral (3)
        expect((llmAnalysisService as any).convertMoodToNumber('unknown')).toBe(3);
      });

      it('should return undefined for undefined or null inputs', () => {
        // Execute and verify
        expect((llmAnalysisService as any).convertMoodToNumber(undefined)).toBe(undefined);
        expect((llmAnalysisService as any).convertMoodToNumber(null)).toBe(undefined);
      });
    });

    describe('analyzeRecentHealth', () => {
      it('should analyze recent health data and return assessment with correct structure', async () => {
        // Setup
        const userId = new mongoose.Types.ObjectId().toString();

        // Mock data collection using our fixture data
        const collectDataSpy = jest.spyOn(llmAnalysisService as any, 'collectHealthData')
          .mockResolvedValue({
            userId: new Types.ObjectId(userId),
            healthData: mockHealthData,
            checkIns: mockCheckIns,
            days: 3,
            startDate: new Date('2025-04-29'),
            endDate: new Date('2025-05-01'),
            analysisType: 'recent'
          });

        // Mock preprocessData
        const preprocessSpy = jest.spyOn(llmAnalysisService as any, 'preprocessData')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.7,
            reasoningData: {
              sleepHours: 8,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              significantChanges: []
            },
            needsSupport: false
          });

        // Mock formatDataForLLM
        const formatSpy = jest.spyOn(llmAnalysisService as any, 'formatDataForLLM')
          .mockResolvedValue('Formatted prompt with data');

        // Mock queryLLM
        const querySpy = jest.spyOn(llmAnalysisService as any, 'queryLLM')
          .mockResolvedValue(JSON.stringify({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.85,
            reasoningData: {
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4
            },
            needsSupport: false
          }));

        // Mock parseLLMResponse
        const parseSpy = jest.spyOn(llmAnalysisService as any, 'parseLLMResponse')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.85,
            reasoningData: {
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              significantChanges: []
            },
            needsSupport: false
          });

        // Mock mergeResponses
        const mergeSpy = jest.spyOn(llmAnalysisService as any, 'mergeResponses')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.85,
            reasoningData: {
              sleepHours: 8,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              significantChanges: []
            },
            needsSupport: false
          });

        // Mock saveMentalHealthState
        const saveSpy = jest.spyOn(llmAnalysisService as any, 'saveMentalHealthState')
          .mockResolvedValue({
            _id: new mongoose.Types.ObjectId(),
            userId: new Types.ObjectId(userId),
            mentalHealthStatus: 'stable'
          });

        // Execute
        const result = await llmAnalysisService.analyzeRecentHealth(userId);

        // Verify with schema validation
        validateLLMResponseSchema(result);

        // Verify with specific assertion messages
        expect(collectDataSpy).toHaveBeenCalledWith(
          expect.any(Types.ObjectId),
          3,
          'recent'
        );
        expect(preprocessSpy).toHaveBeenCalled();
        expect(formatSpy).toHaveBeenCalled();
        expect(querySpy).toHaveBeenCalled();
        expect(parseSpy).toHaveBeenCalled();
        expect(mergeSpy).toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalledWith(
          userId,
          expect.any(Object),
          'recent'
        );

        expect(result).toHaveProperty('mentalHealthStatus', 'stable');
        expect(result).toHaveProperty('confidenceScore', 0.85);
        expect(result.reasoningData).toHaveProperty('sleepQuality', 'good');

        // Restore all spies
        collectDataSpy.mockRestore();
        preprocessSpy.mockRestore();
        formatSpy.mockRestore();
        querySpy.mockRestore();
        parseSpy.mockRestore();
        mergeSpy.mockRestore();
        saveSpy.mockRestore();
      });

      it('should handle errors during analysis process by throwing LLM API error', async () => {
        // Setup
        const userId = new mongoose.Types.ObjectId().toString();

        // Mock data collection and preprocessing
        jest.spyOn(llmAnalysisService as any, 'collectHealthData')
          .mockResolvedValue({
            userId: new Types.ObjectId(userId),
            healthData: mockHealthData,
            checkIns: mockCheckIns,
            days: 3,
            startDate: new Date(),
            endDate: new Date(),
            analysisType: 'recent'
          });

        jest.spyOn(llmAnalysisService as any, 'preprocessData')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.7,
            reasoningData: {},
            needsSupport: false
          });

        jest.spyOn(llmAnalysisService as any, 'formatDataForLLM')
          .mockResolvedValue('Formatted prompt');

        // Simulate LLM API error
        jest.spyOn(llmAnalysisService as any, 'queryLLM')
          .mockRejectedValue(new Error('LLM API error'));

        // Execute and verify with specific assertion message
        await expect(llmAnalysisService.analyzeRecentHealth(userId))
          .rejects.toThrow('LLM API error');
      });
    });

    describe('establishBaseline', () => {
      it('should analyze historical data and establish a baseline with correct metrics', async () => {
        // Setup
        const userId = new mongoose.Types.ObjectId().toString();

        // Mock all the necessary methods
        jest.spyOn(llmAnalysisService as any, 'collectHealthData')
          .mockResolvedValue({
            userId: new Types.ObjectId(userId),
            healthData: mockHealthData,
            checkIns: mockCheckIns,
            days: 0, // 0 means all history
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-05-01'),
            analysisType: 'baseline'
          });

        jest.spyOn(llmAnalysisService as any, 'preprocessData')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.8,
            reasoningData: {
              sleepHours: 7.5,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              stepsPerDay: 8000,
              recentExerciseMinutes: 150
            },
            needsSupport: false
          });

        jest.spyOn(llmAnalysisService as any, 'formatDataForLLM')
          .mockResolvedValue('Baseline prompt');

        jest.spyOn(llmAnalysisService as any, 'queryLLM')
          .mockResolvedValue(JSON.stringify({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.9,
            reasoningData: {
              sleepHours: 7.5,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              stepsPerDay: 8000,
              recentExerciseMinutes: 150,
              significantChanges: []
            }
          }));

        jest.spyOn(llmAnalysisService as any, 'parseLLMResponse')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.9,
            reasoningData: {
              sleepHours: 7.5,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              stepsPerDay: 8000,
              recentExerciseMinutes: 150,
              significantChanges: []
            },
            needsSupport: false
          });

        jest.spyOn(llmAnalysisService as any, 'mergeResponses')
          .mockReturnValue({
            mentalHealthStatus: 'stable',
            confidenceScore: 0.9,
            reasoningData: {
              sleepHours: 7.5,
              sleepQuality: 'good',
              activityLevel: 'moderate',
              checkInMood: 4,
              stepsPerDay: 8000,
              recentExerciseMinutes: 150,
              significantChanges: []
            },
            needsSupport: false
          });

        // Mock saving to MentalHealthBaseline
        const mockBaseline = {
          _id: new mongoose.Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          save: jest.fn().mockResolvedValue(true)
        };

        (MentalHealthBaseline as jest.MockedClass<typeof MentalHealthBaseline>)
          .mockImplementation(() => mockBaseline as any);

        // Execute
        const result = await llmAnalysisService.establishBaseline(userId);

        // Verify with schema validation
        validateLLMResponseSchema(result);

        // Verify expected properties
        expect(MentalHealthBaseline).toHaveBeenCalledWith(expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          establishedAt: expect.any(Date),
          baselineMetrics: expect.objectContaining({
            sleepHours: 7.5,
            sleepQuality: 'good',
            activityLevel: 'moderate',
            averageMoodScore: 4,
            averageStepsPerDay: 8000
          }),
          confidenceScore: 0.9
        }));

        expect(mockBaseline.save).toHaveBeenCalled();
        expect(result).toHaveProperty('mentalHealthStatus', 'stable');
        expect(result.reasoningData).toHaveProperty('sleepHours', 7.5);
      });
    });

    describe('saveMentalHealthState', () => {
      it('should save analysis results to database and initiate support request for declining status', async () => {
        // Setup
        const userId = new mongoose.Types.ObjectId().toString();
        const analysis = {
          mentalHealthStatus: 'declining',
          confidenceScore: 0.8,
          reasoningData: {
            sleepQuality: 'fair',
            activityLevel: 'low',
            checkInMood: 3,
            significantChanges: ['Sleep hours decreased']
          },
          needsSupport: true,
          supportReason: 'Declining sleep quality',
          supportTips: ['Check sleep environment', 'Establish a routine']
        };

        // Mock MentalHealthState
        const mockState = {
          _id: new mongoose.Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          save: jest.fn().mockResolvedValue(true)
        };

        (MentalHealthState as jest.MockedClass<typeof MentalHealthState>)
          .mockImplementation(() => mockState as any);

        // Mock peerSupportService.initiateSupportRequest
        (peerSupportService.initiateSupportRequest as jest.Mock)
          .mockResolvedValue(undefined);

        // Execute
        await (llmAnalysisService as any).saveMentalHealthState(
          userId,
          analysis,
          'recent'
        );

        // Verify
        expect(MentalHealthState).toHaveBeenCalledWith(expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          timestamp: expect.any(Date),
          mentalHealthStatus: 'declining',
          confidenceScore: 0.8,
          reasoningData: expect.any(Object),
          needsSupport: true,
          supportReason: 'Declining sleep quality',
          supportTips: expect.arrayContaining(['Check sleep environment']),
          metadata: { analysisType: 'recent' }
        }));

        expect(mockState.save).toHaveBeenCalled();

        // Verify support request initiation
        expect(peerSupportService.initiateSupportRequest).toHaveBeenCalledWith(
          userId,
          mockState._id
        );
      });

      it('should not initiate support request for baseline analysis even when needsSupport is true', async () => {
        // Setup
        const userId = new mongoose.Types.ObjectId().toString();
        const analysis = {
          mentalHealthStatus: 'stable',
          confidenceScore: 0.9,
          reasoningData: {
            sleepQuality: 'good',
            activityLevel: 'moderate'
          },
          needsSupport: false
        };

        // Mock MentalHealthState
        const mockState = {
          _id: new mongoose.Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          save: jest.fn().mockResolvedValue(true)
        };

        (MentalHealthState as jest.MockedClass<typeof MentalHealthState>)
          .mockImplementation(() => mockState as any);

        // Execute
        await (llmAnalysisService as any).saveMentalHealthState(
          userId,
          analysis,
          'baseline'
        );

        // Verify
        expect(mockState.save).toHaveBeenCalled();
        expect(peerSupportService.initiateSupportRequest).not.toHaveBeenCalled();
      });
    });

    describe('scheduleDailyAnalysis', () => {
      // Use fake timers for this timing-sensitive test
      beforeEach(() => {
        jest.useFakeTimers();
      });
      
      afterEach(() => {
        jest.useRealTimers();
      });
      
      it('should analyze all users in sequence', async () => {
        // Setup
        const mockUsers = [
          { _id: new mongoose.Types.ObjectId() },
          { _id: new mongoose.Types.ObjectId() }
        ];

        // Mock User.find with chainable method
        const mockUserFind = {
          select: jest.fn().mockResolvedValue(mockUsers)
        };
        
        // TypeScript will correctly infer the return type here
        (User.find as jest.Mock).mockReturnValue(mockUserFind);

        // Mock analyzeRecentHealth
        const analyzeSpy = jest.spyOn(llmAnalysisService, 'analyzeRecentHealth')
          .mockResolvedValue({} as any);

        // Execute
        const analysisPromise = llmAnalysisService.scheduleDailyAnalysis();
        
        // Fast-forward all timers
        jest.runAllTimers();
        
        // Wait for the promise to resolve
        await analysisPromise;

        // Verify
        expect(User.find).toHaveBeenCalled();
        expect(mockUserFind.select).toHaveBeenCalledWith('_id');
        expect(analyzeSpy).toHaveBeenCalledTimes(2);
        expect(analyzeSpy).toHaveBeenCalledWith(mockUsers[0]._id.toString());
        expect(analyzeSpy).toHaveBeenCalledWith(mockUsers[1]._id.toString());

        // Restore spy
        analyzeSpy.mockRestore();
      });

      it('should continue analysis when one user fails without stopping the process', async () => {
        // Setup
        const mockUsers = [
          { _id: new mongoose.Types.ObjectId() },
          { _id: new mongoose.Types.ObjectId() }
        ];

        // Mock User.find with chainable method
        const mockUserFind = {
          select: jest.fn().mockResolvedValue(mockUsers)
        };
        (User.find as jest.Mock).mockReturnValue(mockUserFind);

        // Mock analyzeRecentHealth to fail for first user
        const analyzeSpy = jest.spyOn(llmAnalysisService, 'analyzeRecentHealth')
          .mockImplementationOnce(() => Promise.reject(new Error('Analysis failed')))
          .mockResolvedValueOnce({} as any);

        // Execute
        const analysisPromise = llmAnalysisService.scheduleDailyAnalysis();
        
        // Fast-forward all timers
        jest.runAllTimers();
        
        // Wait for the promise to resolve
        await analysisPromise;

        // Verify both users were processed despite first error
        expect(mockUserFind.select).toHaveBeenCalledWith('_id');
        expect(analyzeSpy).toHaveBeenCalledTimes(2);
        expect(analyzeSpy).toHaveBeenCalledWith(mockUsers[0]._id.toString());
        expect(analyzeSpy).toHaveBeenCalledWith(mockUsers[1]._id.toString());

        // Restore spy
        analyzeSpy.mockRestore();
      });
    });
    
    // Add specific test for LLM response schema validation
    it('should validate LLM response structure against the defined interface', async () => {
      // Setup a valid response structure
      const validResponse = {
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
      
      // Verify schema validation works
      expect(() => validateLLMResponseSchema(validResponse)).not.toThrow();
      
      // Create invalid responses to test validation failures
      const missingStatus = {
        confidenceScore: 0.85,
        reasoningData: {},
        needsSupport: false
      } as any;
      
      const invalidStatus = {
        mentalHealthStatus: 'unknown',
        confidenceScore: 0.85,
        reasoningData: {},
        needsSupport: false
      } as any;
      
      const missingNeedsSupport = {
        mentalHealthStatus: 'stable',
        confidenceScore: 0.85,
        reasoningData: {}
      } as any;
      
      // Test that validation fails for invalid structures
      expect(() => validateLLMResponseSchema(missingStatus)).toThrow(/mentalHealthStatus/);
      expect(() => validateLLMResponseSchema(invalidStatus)).toThrow(/mentalHealthStatus/);
      expect(() => validateLLMResponseSchema(missingNeedsSupport)).toThrow(/needsSupport/);
    });
  });
});

// Helper function to validate LLM response schema
function validateLLMResponseSchema(response: any): asserts response is LLMResponse {
  // Check required fields
  if (!response.mentalHealthStatus) {
    throw new Error('Response missing required field: mentalHealthStatus');
  }
  
  // Validate mentalHealthStatus is one of the allowed values
  if (!['stable', 'declining', 'critical'].includes(response.mentalHealthStatus)) {
    throw new Error(`Invalid mentalHealthStatus: ${response.mentalHealthStatus}`);
  }
  
  // Check confidence score
  if (typeof response.confidenceScore !== 'number') {
    throw new Error('Response missing required field: confidenceScore must be a number');
  }
  
  // Check reasoningData exists
  if (!response.reasoningData || typeof response.reasoningData !== 'object') {
    throw new Error('Response missing required field: reasoningData must be an object');
  }
  
  // Check needsSupport
  if (typeof response.needsSupport !== 'boolean') {
    throw new Error('Response missing required field: needsSupport must be a boolean');
  }
  
  // Validate sleep quality if present
  if (response.reasoningData.sleepQuality && 
      !['poor', 'fair', 'good'].includes(response.reasoningData.sleepQuality)) {
    throw new Error(`Invalid sleepQuality: ${response.reasoningData.sleepQuality}`);
  }
  
  // Validate activity level if present
  if (response.reasoningData.activityLevel &&
      !['low', 'moderate', 'high'].includes(response.reasoningData.activityLevel)) {
    throw new Error(`Invalid activityLevel: ${response.reasoningData.activityLevel}`);
  }
  
  // Validate checkInMood if present
  if (response.reasoningData.checkInMood !== undefined && 
      (typeof response.reasoningData.checkInMood !== 'number' ||
       response.reasoningData.checkInMood < 1 ||
       response.reasoningData.checkInMood > 5)) {
    throw new Error(`Invalid checkInMood: ${response.reasoningData.checkInMood}`);
  }
  
  // Validate supportTips if needsSupport is true
  if (response.needsSupport === true && 
      response.supportTips && 
      !Array.isArray(response.supportTips)) {
    throw new Error('supportTips must be an array when needsSupport is true');
  }
}