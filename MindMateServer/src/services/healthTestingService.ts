// services/healthTestingService.ts
import { Types } from 'mongoose';
import { HealthData } from '../Database/HealthDataSchema';

// Define health data pattern types
type HealthPattern = 'good' | 'declining' | 'critical' | 'improving' | 'fluctuating';

// Interface for test data generation request
interface TestDataGenerationRequest {
  pattern: HealthPattern;
  startDate: string;
  days: number;
  userId: string | Types.ObjectId;
}

// Interface for test data generation response
interface TestDataGenerationResponse {
  success: boolean;
  message: string;
  metrics?: {
    daysGenerated: number;
    sleepRecords: number;
    activityRecords: number;
    exerciseRecords: number;
    recordsDeleted: number;
  };
}

// Interface for test data clear response
interface ClearTestDataResponse {
  success: boolean;
  message: string;
  count?: number;
}

// Helper function to calculate ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

class HealthTestingService {
  /**
   * Generate test data based on specified pattern
   */
  public async generateTestData(request: TestDataGenerationRequest): Promise<TestDataGenerationResponse> {
    try {
      console.log(`[HealthTesting] Generating ${request.pattern} pattern for ${request.days} days starting from ${request.startDate}`);
      
      // Validate the start date is not in the future
      const startDate = new Date(request.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate > today) {
        return {
          success: false,
          message: 'Start date cannot be in the future'
        };
      }
      
      // Calculate the end date
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + request.days - 1);
      
      // FIRST STEP: Delete existing data for the date range
      const deleteResult = await HealthData.deleteMany({
        userId: new Types.ObjectId(request.userId),
        date: {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      console.log(`[HealthTesting] Deleted ${deleteResult.deletedCount} existing records`);
      
      // Track metrics
      let daysGenerated = 0;
      let sleepRecords = 0;
      let activityRecords = 0;
      let exerciseRecords = 0;
      
      // Generate data for each day
      for (let i = 0; i < request.days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // Generate pattern-specific data
        const {
          steps,
          sleepHours,
          sleepQuality,
          hasExercise
        } = this.generatePatternData(request.pattern, i, request.days);
        
        // Create a new health record
        const healthRecord = new HealthData({
          userId: new Types.ObjectId(request.userId),
          date: currentDate,
          weekNumber: getWeekNumber(currentDate),
          month: currentDate.getMonth(),
          year: currentDate.getFullYear(),
          exercises: [], // Initialize with empty array
          summary: {
            totalSteps: 0,
            totalDistanceMeters: 0,
            totalSleepSeconds: 0,
            totalExerciseSeconds: 0,
            exerciseCount: 0
          }
        });
        
        // Add steps data
        if (steps > 0) {
          const stepsStartTime = new Date(currentDate);
          stepsStartTime.setHours(8, 0, 0, 0);
          
          const stepsEndTime = new Date(currentDate);
          stepsEndTime.setHours(22, 0, 0, 0);
          
          healthRecord.steps = {
            count: steps,
            startTime: stepsStartTime,
            endTime: stepsEndTime,
            dataSource: 'test-data-generator'
          };
          
          // Add distance data based on steps
          const distanceInMeters = steps * 0.75;
          healthRecord.distance = {
            inMeters: distanceInMeters,
            inKilometers: distanceInMeters / 1000,
            startTime: stepsStartTime,
            endTime: stepsEndTime,
            dataSource: 'test-data-generator'
          };
          
          activityRecords++;
        }
        
        // Add sleep data
        if (sleepHours > 0) {
          const sleepStartTime = new Date(currentDate);
          sleepStartTime.setDate(sleepStartTime.getDate() - 1);
          sleepStartTime.setHours(23, 0, 0, 0);
          
          const sleepDurationSeconds = sleepHours * 3600;
          const sleepEndTime = new Date(sleepStartTime.getTime() + sleepDurationSeconds * 1000);
          
          healthRecord.sleep = {
            startTime: sleepStartTime,
            endTime: sleepEndTime,
            durationInSeconds: sleepDurationSeconds,
            quality: sleepQuality,
            dataSource: 'test-data-generator'
          };
          
          sleepRecords++;
        }
        
        // Update summary
        healthRecord.summary = {
          totalSteps: steps,
          totalDistanceMeters: steps * 0.75,
          totalSleepSeconds: sleepHours * 3600,
          totalExerciseSeconds: hasExercise ? 1800 : 0, // 30 minutes if has exercise
          exerciseCount: hasExercise ? 1 : 0
        };
        
        // Set last synced time
        healthRecord.lastSyncedAt = new Date();
        
        // Save the record
        await healthRecord.save();
        daysGenerated++;
      }
      
      return {
        success: true,
        message: `Successfully generated ${request.pattern} test data for ${request.days} days`,
        metrics: {
          daysGenerated,
          sleepRecords,
          activityRecords,
          exerciseRecords,
          recordsDeleted: deleteResult.deletedCount || 0
        }
      };
    } catch (error) {
      console.error('[HealthTesting] Error generating test data:', error);
      return {
        success: false,
        message: `Failed to generate test data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clear test data for a specific date range
   */
  public async clearTestData(
    userId: string | Types.ObjectId,
    startDate: string,
    endDate: string
  ): Promise<ClearTestDataResponse> {
    try {
      console.log(`[HealthTesting] Clearing test data from ${startDate} to ${endDate}`);
      
      // Delete all health data records in the specified date range
      const result = await HealthData.deleteMany({
        userId: new Types.ObjectId(userId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });
      
      return {
        success: true,
        message: `Successfully cleared ${result.deletedCount} test data records`,
        count: result.deletedCount
      };
    } catch (error) {
      console.error('[HealthTesting] Error clearing test data:', error);
      return {
        success: false,
        message: `Failed to clear test data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate pattern-specific data values
   */
  private generatePatternData(
    pattern: HealthPattern, 
    dayIndex: number, 
    totalDays: number
  ): {
    steps: number;
    sleepHours: number;
    sleepQuality: 'poor' | 'fair' | 'good';
    hasExercise: boolean;
  } {
    // Create randomization with progression based on pattern and day index
    const progress = dayIndex / totalDays; // 0 to 1 as days progress
    
    // Initialize default values
    let steps = 0;
    let sleepHours = 0;
    let hasExercise = false;
    
    // Base randomization function
    const randomize = (base: number, variance: number) => {
      return base + (Math.random() * 2 - 1) * variance;
    };
    
    // Generate values based on pattern
    switch (pattern) {
      case 'good':
        // Good pattern: Consistent good habits
        steps = Math.round(randomize(9000, 1500));
        sleepHours = Math.min(10, Math.max(7, randomize(8, 0.5)));
        hasExercise = Math.random() > 0.2; // 80% chance of exercise
        break;
        
      case 'declining':
        // Declining pattern: Gradual worsening
        steps = Math.round(randomize(8000, 1000) * (1 - progress * 0.5));
        sleepHours = Math.min(9, Math.max(4, randomize(7, 1) * (1 - progress * 0.3)));
        hasExercise = Math.random() > (0.2 + progress * 0.6); // Decreasing chance of exercise
        break;
        
      case 'critical':
        // Critical pattern: Consistently poor
        steps = Math.round(randomize(3000, 1000));
        sleepHours = Math.min(6, Math.max(3, randomize(4.5, 1)));
        hasExercise = Math.random() > 0.8; // 20% chance of exercise
        break;
        
      case 'improving':
        // Improving pattern: Gradual improvement
        steps = Math.round(randomize(4000, 1000) * (1 + progress * 1.5));
        sleepHours = Math.min(9, Math.max(4, randomize(5.5, 1) * (1 + progress * 0.4)));
        hasExercise = Math.random() > (0.8 - progress * 0.6); // Increasing chance of exercise
        break;
        
      case 'fluctuating':
        // Fluctuating pattern: Up and down with sine wave
        const sinFactor = Math.sin(dayIndex * Math.PI / 3); // Creates a nice wave pattern
        steps = Math.round(randomize(6000, 1000) * (1 + sinFactor * 0.5));
        sleepHours = Math.min(9, Math.max(4, randomize(6.5, 1) * (1 + sinFactor * 0.3)));
        hasExercise = Math.random() > (0.5 - sinFactor * 0.3); // Fluctuating chance of exercise
        break;
    }
    
    // Determine sleep quality
    let sleepQuality: 'poor' | 'fair' | 'good';
    if (sleepHours < 6) {
      sleepQuality = 'poor';
    } else if (sleepHours >= 7.5) {
      sleepQuality = 'good';
    } else {
      sleepQuality = 'fair';
    }
    
    return {
      steps,
      sleepHours,
      sleepQuality,
      hasExercise
    };
  }
}

export const healthTestingService = new HealthTestingService();