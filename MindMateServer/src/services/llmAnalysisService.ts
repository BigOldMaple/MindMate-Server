// services/llmAnalysisService.ts
import axios from 'axios';
import { Types } from 'mongoose';
import { HealthData } from '../Database/HealthDataSchema';
import { CheckIn } from '../Database/CheckInSchema';
import { User } from '../Database/Schema';
import { MentalHealthState, IMentalHealthState } from '../Database/MentalHealthStateSchema';

interface LLMResponse {
  mentalHealthStatus: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  reasoningData: {
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    checkInMood?: number;
    checkInNotes?: string;
    recentExerciseMinutes?: number;
    stepsPerDay?: number;
    significantChanges?: string[];
    additionalFactors?: Record<string, any>;
  };
  needsSupport: boolean;
}

class LLMAnalysisService {
  private ollamaEndpoint: string;
  private modelName: string;

  constructor() {
    // Configure the Ollama endpoint and model
    this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate';
    this.modelName = process.env.LLM_MODEL || 'gemma:3-1b';
  }

  /**
   * Send a prompt to the LLM model
   */
  private async queryLLM(prompt: string): Promise<string> {
    try {
      console.log('[LLM] Sending prompt to Ollama');
      
      const response = await axios.post(this.ollamaEndpoint, {
        model: this.modelName,
        prompt,
        stream: false,
        options: {
          temperature: 0.2, // Lower temperature for more deterministic outputs
          top_p: 0.9
        }
      });

      if (response.data && response.data.response) {
        return response.data.response;
      }
      
      throw new Error('Invalid response from LLM');
    } catch (error) {
      console.error('[LLM] Error querying Ollama:', error);
      throw error;
    }
  }

  /**
   * Calculate average sleep hours from health data
   */
  private calculateAverageSleepHours(healthData: any[]): number | undefined {
    const sleepEntries = healthData.filter(day => day.sleep && day.sleep.durationInSeconds);
    
    if (sleepEntries.length === 0) {
      return undefined;
    }
    
    const totalSleepSeconds = sleepEntries.reduce(
      (total, day) => total + day.sleep.durationInSeconds, 0
    );
    
    return +(totalSleepSeconds / 3600 / sleepEntries.length).toFixed(1);
  }

  /**
   * Calculate sleep quality based on sleep data
   */
  private determineSleepQuality(healthData: any[]): 'poor' | 'fair' | 'good' | undefined {
    const sleepEntries = healthData.filter(day => day.sleep && day.sleep.quality);
    
    if (sleepEntries.length === 0) {
      return undefined;
    }
    
    // Count occurrences of each quality
    const qualityCounts = {
      poor: 0,
      fair: 0,
      good: 0
    };
    
    sleepEntries.forEach(day => {
      qualityCounts[day.sleep.quality as 'poor' | 'fair' | 'good']++;
    });
    
    // Determine the most common quality
    let mostCommonQuality: 'poor' | 'fair' | 'good' = 'fair';
    let highestCount = 0;
    
    for (const [quality, count] of Object.entries(qualityCounts)) {
      if (count > highestCount) {
        highestCount = count;
        mostCommonQuality = quality as 'poor' | 'fair' | 'good';
      }
    }
    
    return mostCommonQuality;
  }

  /**
   * Calculate activity level based on steps and exercises
   */
  private determineActivityLevel(healthData: any[]): 'low' | 'moderate' | 'high' | undefined {
    // Filter out days with no activity data
    const activityDays = healthData.filter(
      day => (day.summary && day.summary.totalSteps > 0) || 
             (day.exercises && day.exercises.length > 0)
    );
    
    if (activityDays.length === 0) {
      return undefined;
    }
    
    // Calculate average steps per day
    const totalSteps = activityDays.reduce(
      (total, day) => total + (day.summary?.totalSteps || 0), 0
    );
    const avgSteps = totalSteps / activityDays.length;
    
    // Calculate total exercise minutes
    const totalExerciseSeconds = activityDays.reduce(
      (total, day) => total + (day.summary?.totalExerciseSeconds || 0), 0
    );
    const totalExerciseMinutes = totalExerciseSeconds / 60;
    
    // Determine activity level based on steps and exercise
    if (avgSteps > 10000 || totalExerciseMinutes > 150) {
      return 'high';
    } else if (avgSteps > 5000 || totalExerciseMinutes > 75) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate average mood from check-ins
   */
  private calculateAverageMood(checkIns: any[]): number | undefined {
    if (checkIns.length === 0) {
      return undefined;
    }
    
    const totalMood = checkIns.reduce(
      (total, checkIn) => total + checkIn.mood.score, 0
    );
    
    return +(totalMood / checkIns.length).toFixed(1);
  }

  /**
   * Extract the latest check-in notes
   */
  private getLatestCheckInNotes(checkIns: any[]): string | undefined {
    if (checkIns.length === 0) {
      return undefined;
    }
    
    // Sort by timestamp descending
    const sortedCheckIns = [...checkIns].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    // Get the latest check-in with notes
    const latestWithNotes = sortedCheckIns.find(checkIn => checkIn.notes && checkIn.notes.trim() !== '');
    
    return latestWithNotes?.notes;
  }

  /**
   * Calculate recent exercise minutes
   */
  private calculateRecentExerciseMinutes(healthData: any[]): number | undefined {
    const exerciseDays = healthData.filter(
      day => day.exercises && day.exercises.length > 0
    );
    
    if (exerciseDays.length === 0) {
      return undefined;
    }
    
    const totalExerciseSeconds = exerciseDays.reduce(
      (total, day) => total + day.summary.totalExerciseSeconds, 0
    );
    
    return Math.round(totalExerciseSeconds / 60);
  }

  /**
   * Calculate average steps per day
   */
  private calculateAverageSteps(healthData: any[]): number | undefined {
    const stepDays = healthData.filter(
      day => day.summary && day.summary.totalSteps > 0
    );
    
    if (stepDays.length === 0) {
      return undefined;
    }
    
    const totalSteps = stepDays.reduce(
      (total, day) => total + day.summary.totalSteps, 0
    );
    
    return Math.round(totalSteps / stepDays.length);
  }

  /**
   * Detect significant changes in metrics
   */
  private detectSignificantChanges(healthData: any[], checkIns: any[]): string[] {
    const changes: string[] = [];
    
    // Check for sleep pattern changes
    if (healthData.length >= 7) {
      const recentSleep = healthData.slice(0, 3).filter(day => day.sleep);
      const previousSleep = healthData.slice(3, 7).filter(day => day.sleep);
      
      if (recentSleep.length > 0 && previousSleep.length > 0) {
        const recentAvgSleep = recentSleep.reduce(
          (total, day) => total + day.sleep.durationInSeconds, 0
        ) / recentSleep.length / 3600;
        
        const previousAvgSleep = previousSleep.reduce(
          (total, day) => total + day.sleep.durationInSeconds, 0
        ) / previousSleep.length / 3600;
        
        if (Math.abs(recentAvgSleep - previousAvgSleep) > 1.5) {
          changes.push(`Sleep hours changed from ${previousAvgSleep.toFixed(1)} to ${recentAvgSleep.toFixed(1)}`);
        }
      }
    }
    
    // Check for activity changes
    if (healthData.length >= 7) {
      const recentActivity = healthData.slice(0, 3).filter(day => day.summary && day.summary.totalSteps > 0);
      const previousActivity = healthData.slice(3, 7).filter(day => day.summary && day.summary.totalSteps > 0);
      
      if (recentActivity.length > 0 && previousActivity.length > 0) {
        const recentAvgSteps = recentActivity.reduce(
          (total, day) => total + day.summary.totalSteps, 0
        ) / recentActivity.length;
        
        const previousAvgSteps = previousActivity.reduce(
          (total, day) => total + day.summary.totalSteps, 0
        ) / previousActivity.length;
        
        if (Math.abs(recentAvgSteps - previousAvgSteps) / previousAvgSteps > 0.3) {
          changes.push(`Step count changed by ${Math.round((recentAvgSteps - previousAvgSteps) / previousAvgSteps * 100)}%`);
        }
      }
    }
    
    // Check for mood changes
    if (checkIns.length >= 4) {
      const recentMoods = checkIns.slice(0, 2);
      const previousMoods = checkIns.slice(2, 4);
      
      const recentAvgMood = recentMoods.reduce(
        (total, checkIn) => total + checkIn.mood.score, 0
      ) / recentMoods.length;
      
      const previousAvgMood = previousMoods.reduce(
        (total, checkIn) => total + checkIn.mood.score, 0
      ) / previousMoods.length;
      
      if (Math.abs(recentAvgMood - previousAvgMood) >= 1) {
        changes.push(`Mood score changed from ${previousAvgMood.toFixed(1)} to ${recentAvgMood.toFixed(1)}`);
      }
    }
    
    return changes;
  }

  /**
   * Collect health metrics for a user
   */
  private async collectHealthData(userId: Types.ObjectId, days: number = 14): Promise<any> {
    try {
      // Get the date range for the query
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch health data
      const healthData = await HealthData.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });
      
      // Fetch check-ins
      const checkIns = await CheckIn.find({
        userId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
      
      return {
        healthData,
        checkIns,
        days,
        startDate,
        endDate
      };
    } catch (error) {
      console.error('[LLM] Error collecting health data:', error);
      throw error;
    }
  }

  /**
   * Format health data for LLM analysis
   */
  private formatDataForLLM(data: any): string {
    const { healthData, checkIns, days, startDate, endDate } = data;
    
    let prompt = `
You are a mental health assessment AI specialized in analyzing health data metrics. You have been provided with ${days} days of health and mood data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}.

Health metrics summary:
`;

    // Format sleep data
    prompt += "\nSleep data:\n";
    const sleepData = healthData.filter((day: any) => day.sleep);
    if (sleepData.length > 0) {
      sleepData.forEach((day: any) => {
        const date = day.date.toISOString().split('T')[0];
        const hours = (day.sleep.durationInSeconds / 3600).toFixed(1);
        prompt += `- ${date}: ${hours} hours, quality: ${day.sleep.quality || 'not recorded'}\n`;
      });
    } else {
      prompt += "No sleep data available.\n";
    }

    // Format activity data
    prompt += "\nActivity data:\n";
    const activityData = healthData.filter((day: any) => day.summary && day.summary.totalSteps > 0);
    if (activityData.length > 0) {
      activityData.forEach((day: any) => {
        const date = day.date.toISOString().split('T')[0];
        const steps = day.summary.totalSteps;
        prompt += `- ${date}: ${steps} steps`;
        if (day.exercises && day.exercises.length > 0) {
          prompt += `, ${day.exercises.length} exercise sessions`;
          if (day.summary.totalExerciseSeconds) {
            prompt += ` (${Math.round(day.summary.totalExerciseSeconds / 60)} minutes)`;
          }
        }
        prompt += '\n';
      });
    } else {
      prompt += "No activity data available.\n";
    }

    // Format mood check-ins
    prompt += "\nMood check-ins:\n";
    if (checkIns.length > 0) {
      checkIns.forEach((checkIn: any) => {
        const date = checkIn.timestamp.toISOString().split('T')[0];
        prompt += `- ${date}: Mood score: ${checkIn.mood.score}/5 (${checkIn.mood.label})`;
        if (checkIn.notes) {
          prompt += `, Notes: "${checkIn.notes}"`;
        }
        prompt += '\n';
      });
    } else {
      prompt += "No mood check-ins available.\n";
    }

    // Add assessment instructions
    prompt += `
Based on this data, please analyze the user's mental health state. Consider the following metrics:
1. Sleep hours and quality
2. Activity level (based on steps and exercise)
3. Mood from check-ins
4. Any significant changes in patterns
5. Any risk or protective factors evident in the data

Provide your assessment in the following JSON format (and only respond with this JSON):
{
  "mentalHealthStatus": "stable|declining|critical",
  "confidenceScore": 0.XX,
  "reasoningData": {
    "sleepHours": X.X,
    "sleepQuality": "poor|fair|good",
    "activityLevel": "low|moderate|high",
    "checkInMood": X.X,
    "checkInNotes": "summary of relevant notes",
    "recentExerciseMinutes": XXX,
    "stepsPerDay": XXXX,
    "significantChanges": ["list any significant changes you identified"],
    "additionalFactors": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "needsSupport": true|false
}

For mentalHealthStatus:
- "stable" means the user's metrics indicate good mental health with no major concerns
- "declining" means there are some concerning patterns that might indicate declining mental health
- "critical" means there are serious concerns that require immediate attention

Only include fields in reasoningData if you have sufficient information to make a determination.
`;

    return prompt;
  }

  /**
   * Parse the LLM response to extract structured data
   */
  private parseLLMResponse(response: string): LLMResponse {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found in LLM response');
      }
      
      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr) as LLMResponse;
    } catch (error) {
      console.error('[LLM] Error parsing LLM response:', error);
      // Return a default response for error handling
      return {
        mentalHealthStatus: 'stable',
        confidenceScore: 0.5,
        reasoningData: {
          significantChanges: ['LLM parsing error'],
          additionalFactors: {
            error: 'Unable to analyze data properly'
          }
        },
        needsSupport: false
      };
    }
  }

  /**
   * Pre-process the data to help guide the LLM
   */
  private preprocessData(userData: any): LLMResponse {
    const { healthData, checkIns } = userData;
    
    // Calculate pre-processed metrics to help guide the LLM
    const sleepHours = this.calculateAverageSleepHours(healthData);
    const sleepQuality = this.determineSleepQuality(healthData);
    const activityLevel = this.determineActivityLevel(healthData);
    const checkInMood = this.calculateAverageMood(checkIns);
    const checkInNotes = this.getLatestCheckInNotes(checkIns);
    const recentExerciseMinutes = this.calculateRecentExerciseMinutes(healthData);
    const stepsPerDay = this.calculateAverageSteps(healthData);
    const significantChanges = this.detectSignificantChanges(healthData, checkIns);
    
    // This is a simplified assessment to help guide the LLM
    // The actual assessment will be done by the LLM
    let mentalHealthStatus: 'stable' | 'declining' | 'critical' = 'stable';
    
    // Simple heuristics for demonstration
    if (checkInMood && checkInMood < 2) {
      mentalHealthStatus = 'critical';
    } else if (sleepHours && sleepHours < 5) {
      mentalHealthStatus = 'declining';
    } else if (significantChanges.length > 2) {
      mentalHealthStatus = 'declining';
    }
    
    return {
      mentalHealthStatus,
      confidenceScore: 0.7,
      reasoningData: {
        sleepHours,
        sleepQuality,
        activityLevel,
        checkInMood,
        checkInNotes,
        recentExerciseMinutes,
        stepsPerDay,
        significantChanges,
        additionalFactors: {
          dataCompleteness: (healthData.length / 14).toFixed(2)
        }
      },
      needsSupport: mentalHealthStatus !== 'stable'
    };
  }

  /**
   * Analyze a user's mental health state
   */
  public async analyzeMentalHealth(userId: string): Promise<LLMResponse> {
    try {
      console.log(`[LLM] Analyzing mental health for user ${userId}`);
      
      // Collect health data
      const userData = await this.collectHealthData(new Types.ObjectId(userId));
      
      // Pre-process data to get initial metrics
      const preprocessedData = this.preprocessData(userData);
      
      // Format the data for LLM
      const prompt = this.formatDataForLLM(userData);
      
      // Query the LLM
      const llmResponse = await this.queryLLM(prompt);
      
      // Parse the response
      const parsedResponse = this.parseLLMResponse(llmResponse);
      
      // Merge with pre-processed data to ensure completeness
      const finalResponse = this.mergeResponses(parsedResponse, preprocessedData);
      
      // Save the results to the database
      await this.saveMentalHealthState(userId, finalResponse);
      
      console.log(`[LLM] Analysis completed for user ${userId}: ${finalResponse.mentalHealthStatus}`);
      
      return finalResponse;
    } catch (error) {
      console.error('[LLM] Error analyzing mental health:', error);
      throw error;
    }
  }

  /**
   * Merge the LLM response with pre-processed data to ensure all fields are present
   */
  private mergeResponses(llmResponse: LLMResponse, preprocessedData: LLMResponse): LLMResponse {
    return {
      mentalHealthStatus: llmResponse.mentalHealthStatus,
      confidenceScore: llmResponse.confidenceScore,
      reasoningData: {
        sleepHours: llmResponse.reasoningData.sleepHours || preprocessedData.reasoningData.sleepHours,
        sleepQuality: llmResponse.reasoningData.sleepQuality || preprocessedData.reasoningData.sleepQuality,
        activityLevel: llmResponse.reasoningData.activityLevel || preprocessedData.reasoningData.activityLevel,
        checkInMood: llmResponse.reasoningData.checkInMood || preprocessedData.reasoningData.checkInMood,
        checkInNotes: llmResponse.reasoningData.checkInNotes || preprocessedData.reasoningData.checkInNotes,
        recentExerciseMinutes: llmResponse.reasoningData.recentExerciseMinutes || preprocessedData.reasoningData.recentExerciseMinutes,
        stepsPerDay: llmResponse.reasoningData.stepsPerDay || preprocessedData.reasoningData.stepsPerDay,
        significantChanges: llmResponse.reasoningData.significantChanges || preprocessedData.reasoningData.significantChanges,
        additionalFactors: {
          ...preprocessedData.reasoningData.additionalFactors,
          ...llmResponse.reasoningData.additionalFactors
        }
      },
      needsSupport: llmResponse.needsSupport
    };
  }

  /**
   * Save the mental health state assessment to the database
   */
  private async saveMentalHealthState(userId: string, analysis: LLMResponse): Promise<IMentalHealthState> {
    try {
      const mentalHealthState = new MentalHealthState({
        userId: new Types.ObjectId(userId),
        timestamp: new Date(),
        mentalHealthStatus: analysis.mentalHealthStatus,
        confidenceScore: analysis.confidenceScore,
        reasoningData: analysis.reasoningData,
        needsSupport: analysis.needsSupport,
        supportRequestStatus: analysis.needsSupport ? 'none' : undefined
      });
      
      await mentalHealthState.save();
      
      // If support is needed, initiate the support request system
      if (analysis.needsSupport) {
        await this.initiateSupportRequest(userId, mentalHealthState._id);
      }
      
      return mentalHealthState;
    } catch (error) {
      console.error('[LLM] Error saving mental health state:', error);
      throw error;
    }
  }

  /**
   * Initiate the tiered support request system
   */
  private async initiateSupportRequest(userId: string, assessmentId: Types.ObjectId): Promise<void> {
    try {
      // Get the user's buddy peers
      const user = await User.findById(userId)
        .select('buddyPeers')
        .populate('buddyPeers.userId');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.buddyPeers.length === 0) {
        // No buddy peers, update the support request status to reflect this
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'communityRequested',
            supportRequestTime: new Date()
          }
        });
        
        // Implement community support request
        // This would be implemented in the next phase
      } else {
        // User has buddy peers, request support from them
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'buddyRequested',
            supportRequestTime: new Date()
          }
        });
        
        // Actually send notifications to buddy peers
        // This would be implemented with your notification system
      }
    } catch (error) {
      console.error('[LLM] Error initiating support request:', error);
      throw error;
    }
  }

  /**
   * Establish a baseline for a new user
   */
  public async establishBaseline(userId: string): Promise<void> {
    try {
      console.log(`[LLM] Establishing baseline for user ${userId}`);
      
      // This would be implemented based on your baseline establishment process
      // It would involve collecting initial health data and creating a baseline
      // assessment using a different prompt structure
      
      // For now, just perform a regular assessment
      await this.analyzeMentalHealth(userId);
    } catch (error) {
      console.error('[LLM] Error establishing baseline:', error);
      throw error;
    }
  }

  /**
   * Schedule daily analysis for all users
   */
  public async scheduleDailyAnalysis(): Promise<void> {
    try {
      console.log('[LLM] Running scheduled daily analysis');
      
      // Get all users
      const users = await User.find().select('_id');
      
      // Analyze each user's mental health
      for (const user of users) {
        try {
          await this.analyzeMentalHealth(user._id.toString());
        } catch (error) {
          console.error(`[LLM] Error analyzing user ${user._id}:`, error);
          // Continue with next user
        }
      }
      
      console.log('[LLM] Scheduled analysis completed');
    } catch (error) {
      console.error('[LLM] Error in scheduled analysis:', error);
      throw error;
    }
  }
}

// Create and export the singleton instance
export const llmAnalysisService = new LLMAnalysisService();