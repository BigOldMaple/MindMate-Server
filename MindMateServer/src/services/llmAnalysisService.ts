// services/llmAnalysisService.ts
import axios from 'axios';
import { Types } from 'mongoose';
import { HealthData } from '../Database/HealthDataSchema';
import { CheckIn } from '../Database/CheckInSchema';
import { User } from '../Database/Schema';
import { MentalHealthState, IMentalHealthState } from '../Database/MentalHealthStateSchema';
import { peerSupportService } from './peerSupportService';
import { MentalHealthBaseline, IMentalHealthBaseline } from '../Database/MentalHealthBaselineSchema';


// Define the analysis type
export type AnalysisType = 'baseline' | 'recent' | 'standard';

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

// Define types for health data and check-ins
interface HealthDataRecord {
    date: Date;
    sleep?: {
        durationInSeconds: number;
        quality?: 'poor' | 'fair' | 'good';
    };
    summary?: {
        totalSteps: number;
        totalExerciseSeconds: number;
    };
    exercises?: Array<any>;
    [key: string]: any;
}

interface CheckInRecord {
    timestamp: Date;
    mood: {
        score: number;
        label: string;
    };
    notes?: string;
    [key: string]: any;
}

// Interface for baseline assessment data
interface BaselineAssessment {
    timestamp: Date;
    mentalHealthStatus: 'stable' | 'declining' | 'critical';
    confidenceScore: number;
    reasoningData: {
        sleepHours?: number;
        sleepQuality?: 'poor' | 'fair' | 'good';
        activityLevel?: 'low' | 'moderate' | 'high';
        checkInMood?: number;
        stepsPerDay?: number;
        recentExerciseMinutes?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

class LLMAnalysisService {
    private ollamaEndpoint: string;
    private modelName: string;

    constructor() {
        // Configure the Ollama endpoint and model
        this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434/api/generate';
        this.modelName = process.env.LLM_MODEL || 'gemma3:1b';
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
                    temperature: 0.15, // Lower temperature for more deterministic outputs
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
     * Convert mood string values to numeric values if needed
     */
    private convertMoodToNumber(mood: any): number | undefined {
        if (mood === undefined || mood === null) {
            return undefined;
        }

        // If it's already a number, return it
        if (typeof mood === 'number') {
            return mood;
        }

        // If it's a string, try to convert it
        if (typeof mood === 'string') {
            // Try parsing as a number first
            const parsedNumber = parseFloat(mood);
            if (!isNaN(parsedNumber)) {
                return parsedNumber;
            }

            // If not a number, map mood strings to numbers
            const moodMap: Record<string, number> = {
                'very poor': 1,
                'poor': 1.5,
                'below average': 2,
                'low': 2,
                'fair': 3,
                'neutral': 3,
                'medium': 3,
                'average': 3,
                'good': 4,
                'above average': 4,
                'very good': 5,
                'excellent': 5
            };

            // Convert to lowercase and remove any leading/trailing spaces
            const normalizedMood = mood.toLowerCase().trim();

            // Check if it's in our map
            return moodMap[normalizedMood] || 3; // Default to 3 (neutral) if not found
        }

        // For any other type, return undefined
        return undefined;
    }

    /**
     * Calculate average sleep hours from health data
     */
    private calculateAverageSleepHours(healthData: HealthDataRecord[]): number | undefined {
        const sleepEntries = healthData.filter(day => day.sleep && day.sleep.durationInSeconds);

        if (sleepEntries.length === 0) {
            return undefined;
        }

        const totalSleepSeconds = sleepEntries.reduce(
            (total, day) => total + day.sleep!.durationInSeconds, 0
        );

        return +(totalSleepSeconds / 3600 / sleepEntries.length).toFixed(1);
    }

    /**
     * Calculate sleep quality based on sleep data
     */
    private determineSleepQuality(healthData: HealthDataRecord[]): 'poor' | 'fair' | 'good' | undefined {
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
            if (day.sleep?.quality) {
                qualityCounts[day.sleep.quality as 'poor' | 'fair' | 'good']++;
            }
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
    private determineActivityLevel(healthData: HealthDataRecord[]): 'low' | 'moderate' | 'high' | undefined {
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
    private calculateAverageMood(checkIns: CheckInRecord[]): number | undefined {
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
    private getLatestCheckInNotes(checkIns: CheckInRecord[]): string | undefined {
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
    private calculateRecentExerciseMinutes(healthData: HealthDataRecord[]): number | undefined {
        const exerciseDays = healthData.filter(
            day => day.exercises && day.exercises.length > 0
        );

        if (exerciseDays.length === 0) {
            return undefined;
        }

        const totalExerciseSeconds = exerciseDays.reduce(
            (total, day) => total + (day.summary?.totalExerciseSeconds || 0), 0
        );

        return Math.round(totalExerciseSeconds / 60);
    }

    /**
     * Calculate average steps per day
     */
    private calculateAverageSteps(healthData: HealthDataRecord[]): number | undefined {
        const stepDays = healthData.filter(
            day => day.summary && day.summary.totalSteps > 0
        );

        if (stepDays.length === 0) {
            return undefined;
        }

        const totalSteps = stepDays.reduce(
            (total, day) => total + day.summary!.totalSteps, 0
        );

        return Math.round(totalSteps / stepDays.length);
    }

    /**
     * Detect significant changes in metrics
     */
    private detectSignificantChanges(healthData: HealthDataRecord[], checkIns: CheckInRecord[]): string[] {
        const changes: string[] = [];

        // Check for sleep pattern changes
        if (healthData.length >= 7) {
            const recentSleep = healthData.slice(0, 3).filter(day => day.sleep);
            const previousSleep = healthData.slice(3, 7).filter(day => day.sleep);

            if (recentSleep.length > 0 && previousSleep.length > 0) {
                const recentAvgSleep = recentSleep.reduce(
                    (total, day) => total + day.sleep!.durationInSeconds, 0
                ) / recentSleep.length / 3600;

                const previousAvgSleep = previousSleep.reduce(
                    (total, day) => total + day.sleep!.durationInSeconds, 0
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
                    (total, day) => total + day.summary!.totalSteps, 0
                ) / recentActivity.length;

                const previousAvgSteps = previousActivity.reduce(
                    (total, day) => total + day.summary!.totalSteps, 0
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
     * @param userId The user ID
     * @param days Number of days to collect data for (0 means all history)
     * @param analysisType Type of analysis being performed
     */
    private async collectHealthData(
        userId: Types.ObjectId, 
        days: number = 14,
        analysisType: AnalysisType = 'standard'
    ): Promise<any> {
        try {
            // Get the date range for the query
            const endDate = new Date();
            const startDate = days > 0 ? new Date(endDate) : new Date(0); // 0 days means all history
            
            if (days > 0) {
                startDate.setDate(startDate.getDate() - days);
            }

            console.log(`[LLM] Collecting health data for ${analysisType} analysis from ${startDate.toISOString()} to ${endDate.toISOString()}`);

            // Fetch health data
            const healthData = await HealthData.find({
                userId,
                date: { $gte: startDate, $lte: endDate }
            }).sort({ date: 1 }).lean() as unknown as HealthDataRecord[];

            // Fetch check-ins
            const checkIns = await CheckIn.find({
                userId,
                timestamp: { $gte: startDate, $lte: endDate }
            }).sort({ timestamp: 1 }).lean() as unknown as CheckInRecord[];

            console.log(`[LLM] Collected ${healthData.length} health records and ${checkIns.length} check-ins`);

            return {
                userId,
                healthData,
                checkIns,
                days,
                startDate,
                endDate,
                analysisType
            };
        } catch (error) {
            console.error('[LLM] Error collecting health data:', error);
            throw error;
        }
    }

    /**
     * Get most recent baseline assessment for a user
     */
    private async getBaselineAssessment(userId: Types.ObjectId): Promise<BaselineAssessment | null> {
        try {
            // Find the most recent baseline from the new table
            const baselineDoc = await MentalHealthBaseline.findOne({
                userId: userId
            }).sort({ establishedAt: -1 }).lean();
            
            if (!baselineDoc) {
                return null;
            }
            
            // Properly type the baseline document
            const baselineAssessment = baselineDoc as unknown as IMentalHealthBaseline;
            
            // Map the baseline format to match what the analysis expects
            return {
                timestamp: baselineAssessment.establishedAt,
                mentalHealthStatus: baselineAssessment.rawAssessmentData?.mentalHealthStatus || 'stable',
                confidenceScore: baselineAssessment.confidenceScore,
                reasoningData: {
                    sleepHours: baselineAssessment.baselineMetrics?.sleepHours,
                    sleepQuality: baselineAssessment.baselineMetrics?.sleepQuality,
                    activityLevel: baselineAssessment.baselineMetrics?.activityLevel,
                    checkInMood: baselineAssessment.baselineMetrics?.averageMoodScore,
                    stepsPerDay: baselineAssessment.baselineMetrics?.averageStepsPerDay,
                    recentExerciseMinutes: baselineAssessment.baselineMetrics?.exerciseMinutesPerWeek ? 
                        baselineAssessment.baselineMetrics.exerciseMinutesPerWeek * 3 / 7 : undefined // Convert to 3-day estimate
                }
            };
        } catch (error) {
            console.error('[LLM] Error fetching baseline assessment:', error);
            return null;
        }
    }

    /**
     * Format health data for LLM analysis
     */
    private async formatDataForLLM(data: any): Promise<string> {
        const { userId, healthData, checkIns, startDate, endDate, analysisType } = data;
        const dayCount = healthData.length > 0 ? 
            Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        let prompt = '';

        // Create a prompt based on analysis type
        if (analysisType === 'baseline') {
            prompt = this.createBaselinePrompt(healthData, checkIns, dayCount, startDate, endDate);
        } else if (analysisType === 'recent') {
            prompt = await this.createRecentAnalysisPrompt(userId, healthData, checkIns, dayCount, startDate, endDate);
        } else {
            prompt = this.createStandardPrompt(healthData, checkIns, dayCount, startDate, endDate);
        }

        // Add assessment instructions (common for all analysis types)
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
    "checkInMood": X.X, // IMPORTANT: This must be a number from 1-5, NOT a string
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

For checkInMood:
- Use a numeric scale from 1-5 where 1=Very Poor, 3=Neutral, 5=Very Good
- Do NOT use string labels like "good" or "poor" for this field

Only include fields in reasoningData if you have sufficient information to make a determination.
`;

        return prompt;
    }

    /**
     * Create a prompt for baseline analysis
     */
    private createBaselinePrompt(
        healthData: HealthDataRecord[], 
        checkIns: CheckInRecord[], 
        dayCount: number, 
        startDate: Date, 
        endDate: Date
    ): string {
        return `
You are a mental health assessment AI specialized in establishing mental health baselines. You have been provided with ${healthData.length} health records and ${checkIns.length} mood check-ins from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (spanning ${dayCount} days).

TASK: ESTABLISH BASELINE ANALYSIS
This is a BASELINE ANALYSIS which means you are analyzing the user's entire health history to establish their normal patterns. This will be used as a reference point for future analyses.

IMPORTANT NOTE ABOUT BASELINE ANALYSIS:
- This analysis should focus on establishing patterns rather than identifying acute changes
- Identify what is "normal" for this user across all health metrics
- More data points should lead to higher confidence in your baseline assessment
- Focus on long-term trends rather than recent fluctuations

Health metrics summary:
${this.formatHealthDataSummary(healthData, checkIns)}
`;
    }

    /**
     * Create a prompt for recent analysis with recency weighting
     * This version compares against the baseline if available
     */
    private async createRecentAnalysisPrompt(
        userId: Types.ObjectId,
        healthData: HealthDataRecord[], 
        checkIns: CheckInRecord[], 
        dayCount: number, 
        startDate: Date, 
        endDate: Date
    ): Promise<string> {
        // For recent analysis, we'll focus on the last 3 days with recency weighting
        // Filter to get only the last 3 days of data
        const threeDay = new Date(endDate);
        threeDay.setDate(threeDay.getDate() - 3);
        
        const recentHealthData = healthData.filter(day => new Date(day.date) >= threeDay);
        const recentCheckIns = checkIns.filter(checkIn => new Date(checkIn.timestamp) >= threeDay);
        
        // Try to find the most recent baseline assessment for comparison
        const baselineAssessment = await this.getBaselineAssessment(userId);
        
        let baselineInfo = 'No baseline assessment is available for comparison.';
        
        if (baselineAssessment) {
            // Format baseline data for the prompt
            baselineInfo = `
BASELINE COMPARISON DATA:
The user has a baseline assessment from ${new Date(baselineAssessment.timestamp).toISOString().split('T')[0]}.

Baseline metrics:
- Sleep Quality: ${baselineAssessment.reasoningData.sleepQuality || 'Not available'}
- Sleep Hours: ${baselineAssessment.reasoningData.sleepHours || 'Not available'}
- Activity Level: ${baselineAssessment.reasoningData.activityLevel || 'Not available'}
- Average Steps: ${baselineAssessment.reasoningData.stepsPerDay || 'Not available'} steps per day
- Average Mood: ${baselineAssessment.reasoningData.checkInMood || 'Not available'} (on 1-5 scale)
- Exercise Minutes: ${baselineAssessment.reasoningData.recentExerciseMinutes || 'Not available'} minutes

Overall baseline mental health status: ${baselineAssessment.mentalHealthStatus}
Baseline confidence: ${(baselineAssessment.confidenceScore * 100).toFixed(1)}%
`;
        }
        
        return `
You are a mental health assessment AI specialized in detecting recent changes. You have been provided with the most recent 3 days of health data from ${threeDay.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}.

TASK: RECENT WEIGHTED ANALYSIS WITH BASELINE COMPARISON
This is a RECENT ANALYSIS which means you should focus on the most recent 3 days of data with RECENCY WEIGHTING, and COMPARE against the user's baseline (if available).

IMPORTANT NOTE ABOUT RECENCY WEIGHTING:
- Data from today should be weighted approximately 3x more heavily than data from 3 days ago
- Data from yesterday should be weighted approximately 2x more heavily than data from 3 days ago
- Recent changes should be considered more significant than historical patterns
- This analysis is specifically looking for ACUTE changes that might indicate a mental health concern

IMPORTANT NOTE ABOUT BASELINE COMPARISON:
- Compare recent metrics against the user's baseline whenever possible
- Highlight significant deviations from baseline
- Focus on whether the user is trending better or worse than their personal baseline
- Include baseline deviation in your reasoning

Recent health metrics summary (last 3 days, most recent first):
${this.formatHealthDataSummary(recentHealthData, recentCheckIns, true)}

${baselineInfo}

Historical context (if available):
${healthData.length > recentHealthData.length ? 'User has additional historical data available beyond these 3 days' : 'No additional historical data available'}
`;
    }

    /**
     * Create a prompt for standard analysis
     */
    private createStandardPrompt(
        healthData: HealthDataRecord[], 
        checkIns: CheckInRecord[], 
        dayCount: number, 
        startDate: Date, 
        endDate: Date
    ): string {
        return `
You are a mental health assessment AI specialized in analyzing health data metrics. You have been provided with ${dayCount} days of health and mood data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}.

IMPORTANT NOTE ABOUT MISSING DATA:
- Missing data points should NOT be interpreted as negative health indicators
- Missing sleep, activity, or mood data is common and often means the user didn't record data (not that they didn't sleep, exercise, or had a bad day)
- Only make assessments based on available data points
- Lower your confidence score when data is sparse
- If less than 50% of days have data for a particular metric, do not draw strong conclusions about that metric

Health metrics summary:
${this.formatHealthDataSummary(healthData, checkIns)}
`;
    }

    /**
     * Format health data and check-ins into a readable summary
     * @param healthData Health data records
     * @param checkIns Check-in records
     * @param recentFirst Whether to show most recent records first (for recency analysis)
     */
    private formatHealthDataSummary(
        healthData: HealthDataRecord[], 
        checkIns: CheckInRecord[],
        recentFirst: boolean = false
    ): string {
        let summary = '';

        // Clone and sort arrays if needed
        const sortedHealthData = [...healthData];
        const sortedCheckIns = [...checkIns];
        
        if (recentFirst) {
            // Sort by date descending for recency analysis
            sortedHealthData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            sortedCheckIns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        // Format sleep data
        summary += "\nSleep data:\n";
        const sleepData = sortedHealthData.filter((day: HealthDataRecord) => day.sleep);
        if (sleepData.length > 0) {
            sleepData.forEach((day: HealthDataRecord) => {
                const date = new Date(day.date).toISOString().split('T')[0];
                const hours = (day.sleep!.durationInSeconds / 3600).toFixed(1);
                summary += `- ${date}: ${hours} hours, quality: ${day.sleep!.quality || 'not recorded'}\n`;
            });
        } else {
            summary += "No sleep data available.\n";
        }

        // Format activity data
        summary += "\nActivity data:\n";
        const activityData = sortedHealthData.filter((day: HealthDataRecord) => day.summary && day.summary.totalSteps > 0);
        if (activityData.length > 0) {
            activityData.forEach((day: HealthDataRecord) => {
                const date = new Date(day.date).toISOString().split('T')[0];
                const steps = day.summary!.totalSteps;
                summary += `- ${date}: ${steps} steps`;
                if (day.exercises && day.exercises.length > 0) {
                    summary += `, ${day.exercises.length} exercise sessions`;
                    if (day.summary!.totalExerciseSeconds) {
                        summary += ` (${Math.round(day.summary!.totalExerciseSeconds / 60)} minutes)`;
                    }
                }
                summary += '\n';
            });
        } else {
            summary += "No activity data available.\n";
        }

        // Format mood check-ins
        summary += "\nMood check-ins:\n";
        if (sortedCheckIns.length > 0) {
            sortedCheckIns.forEach((checkIn: CheckInRecord) => {
                const date = new Date(checkIn.timestamp).toISOString().split('T')[0];
                summary += `- ${date}: Mood score: ${checkIn.mood.score}/5 (${checkIn.mood.label})`;
                if (checkIn.notes) {
                    summary += `, Notes: "${checkIn.notes}"`;
                }
                summary += '\n';
            });
        } else {
            summary += "No mood check-ins available.\n";
        }

        return summary;
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
     * Analyze a user's mental health state (standard 14-day analysis)
     */
    public async analyzeMentalHealth(userId: string): Promise<LLMResponse> {
        try {
            console.log(`[LLM] Analyzing mental health for user ${userId}`);

            // Collect health data
            const userData = await this.collectHealthData(
                new Types.ObjectId(userId),
                14, // Default 14 days
                'standard'
            );

            // Pre-process data to get initial metrics
            const preprocessedData = this.preprocessData(userData);

            // Format the data for LLM
            const prompt = await this.formatDataForLLM(userData);

            // Query the LLM
            const llmResponse = await this.queryLLM(prompt);

            // Parse the response
            const parsedResponse = this.parseLLMResponse(llmResponse);

            // Merge with pre-processed data to ensure completeness
            const finalResponse = this.mergeResponses(parsedResponse, preprocessedData);

            // Save the results to the database
            await this.saveMentalHealthState(userId, finalResponse, 'standard');

            console.log(`[LLM] Analysis completed for user ${userId}: ${finalResponse.mentalHealthStatus}`);

            return finalResponse;
        } catch (error) {
            console.error('[LLM] Error analyzing mental health:', error);
            throw error;
        }
    }

    /**
     * Analyze recent health data (past 3 days) with recency weighting
     * Compares against baseline if available
     */
    public async analyzeRecentHealth(userId: string): Promise<LLMResponse> {
        try {
            console.log(`[LLM] Analyzing recent health (3 days) for user ${userId}`);

            // Collect health data for the past 3 days
            const userData = await this.collectHealthData(
                new Types.ObjectId(userId),
                3, // Only 3 days
                'recent'
            );
            
            // Add userId to userData for baseline comparison
            userData.userId = new Types.ObjectId(userId);

            // Pre-process data to get initial metrics
            const preprocessedData = this.preprocessData(userData);

            // Format the data for LLM with recency weighting instructions and baseline comparison
            const prompt = await this.formatDataForLLM(userData);

            // Query the LLM
            const llmResponse = await this.queryLLM(prompt);

            // Parse the response
            const parsedResponse = this.parseLLMResponse(llmResponse);

            // Merge with pre-processed data to ensure completeness
            const finalResponse = this.mergeResponses(parsedResponse, preprocessedData);
            
            // Add baseline comparison flag
            if (!finalResponse.reasoningData.additionalFactors) {
                finalResponse.reasoningData.additionalFactors = {};
            }
            finalResponse.reasoningData.additionalFactors.comparedToBaseline = true;

            // Save the results to the database with analysis type
            await this.saveMentalHealthState(userId, finalResponse, 'recent');

            console.log(`[LLM] Recent analysis completed for user ${userId}: ${finalResponse.mentalHealthStatus}`);

            return finalResponse;
        } catch (error) {
            console.error('[LLM] Error analyzing recent health:', error);
            throw error;
        }
    }

    /**
     * Establish a baseline for a user (analyzing all historical data)
     */
    public async establishBaseline(userId: string): Promise<LLMResponse> {
        try {
            console.log(`[LLM] Establishing baseline for user ${userId}`);
    
            // Collect all historical health data
            const userData = await this.collectHealthData(
                new Types.ObjectId(userId),
                0, // 0 means all history
                'baseline'
            );
    
            // Pre-process data to get initial metrics
            const preprocessedData = this.preprocessData(userData);
    
            // Format the data for LLM with baseline instructions
            const prompt = await this.formatDataForLLM(userData);
    
            // Query the LLM
            const llmResponse = await this.queryLLM(prompt);
    
            // Parse the response
            const parsedResponse = this.parseLLMResponse(llmResponse);
    
            // Merge with pre-processed data to ensure completeness
            const finalResponse = this.mergeResponses(parsedResponse, preprocessedData);
    
            // Instead of saving to MentalHealthState, save to the new baseline schema
            const baseline = new MentalHealthBaseline({
                userId: new Types.ObjectId(userId),
                establishedAt: new Date(),
                baselineMetrics: {
                    sleepHours: finalResponse.reasoningData.sleepHours,
                    sleepQuality: finalResponse.reasoningData.sleepQuality,
                    activityLevel: finalResponse.reasoningData.activityLevel,
                    averageMoodScore: finalResponse.reasoningData.checkInMood,
                    averageStepsPerDay: finalResponse.reasoningData.stepsPerDay,
                    exerciseMinutesPerWeek: finalResponse.reasoningData.recentExerciseMinutes ? 
                        finalResponse.reasoningData.recentExerciseMinutes * 7 / 3 : undefined, // Convert to weekly
                    significantPatterns: finalResponse.reasoningData.significantChanges
                },
                confidenceScore: finalResponse.confidenceScore,
                dataPoints: {
                    totalDays: userData.healthData.length,
                    daysWithSleepData: userData.healthData.filter((day: HealthDataRecord) => day.sleep).length,
                    daysWithActivityData: userData.healthData.filter((day: HealthDataRecord) => day.summary && day.summary.totalSteps > 0).length,
                    checkInsCount: userData.checkIns.length
                },
                rawAssessmentData: {
                    mentalHealthStatus: finalResponse.mentalHealthStatus,
                    reasoningData: finalResponse.reasoningData
                }
            });
    
            await baseline.save();
    
            console.log(`[LLM] Baseline established for user ${userId}`);
    
            return finalResponse;
        } catch (error) {
            console.error('[LLM] Error establishing baseline:', error);
            throw error;
        }
    }
    /**
     * Merge the LLM response with pre-processed data to ensure all fields are present
     */
    private mergeResponses(llmResponse: LLMResponse, preprocessedData: LLMResponse): LLMResponse {
        // Convert mood value if it's a string
        const checkInMood = this.convertMoodToNumber(llmResponse.reasoningData.checkInMood) ||
            preprocessedData.reasoningData.checkInMood;

        return {
            mentalHealthStatus: llmResponse.mentalHealthStatus,
            confidenceScore: llmResponse.confidenceScore,
            reasoningData: {
                sleepHours: llmResponse.reasoningData.sleepHours || preprocessedData.reasoningData.sleepHours,
                sleepQuality: llmResponse.reasoningData.sleepQuality || preprocessedData.reasoningData.sleepQuality,
                activityLevel: llmResponse.reasoningData.activityLevel || preprocessedData.reasoningData.activityLevel,
                checkInMood: checkInMood, // Use the converted value
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
    private async saveMentalHealthState(
        userId: string, 
        analysis: LLMResponse, 
        analysisType: AnalysisType = 'standard'
    ): Promise<IMentalHealthState> {
        try {
            // Add metadata about the analysis type
            if (!analysis.reasoningData.additionalFactors) {
                analysis.reasoningData.additionalFactors = {};
            }
            analysis.reasoningData.additionalFactors.analysisType = analysisType;
    
            const mentalHealthState = new MentalHealthState({
                userId: new Types.ObjectId(userId),
                timestamp: new Date(),
                mentalHealthStatus: analysis.mentalHealthStatus,
                confidenceScore: analysis.confidenceScore,
                reasoningData: analysis.reasoningData,
                needsSupport: analysisType === 'baseline' ? false : analysis.needsSupport, // Don't trigger support for baselines
                supportRequestStatus: (analysisType === 'baseline' || !analysis.needsSupport) ? undefined : 'none',
                metadata: {
                    analysisType: analysisType
                }
            });
    
            await mentalHealthState.save();
    
            // Only initiate support requests for non-baseline analyses
            if (analysis.needsSupport && analysisType !== 'baseline') {
                await peerSupportService.initiateSupportRequest(userId, mentalHealthState._id);
            }
    
            return mentalHealthState;
        } catch (error) {
            console.error('[LLM] Error saving mental health state:', error);
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