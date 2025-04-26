// services/llmAnalysisService.ts
import axios from 'axios';
import { Types } from 'mongoose';
import { HealthData } from '../Database/HealthDataSchema';
import { CheckIn } from '../Database/CheckInSchema';
import { User } from '../Database/Schema';
import { MentalHealthState, IMentalHealthState } from '../Database/MentalHealthStateSchema';
import { peerSupportService } from './peerSupportService';

interface ActivityRating {
    level: 'low' | 'moderate' | 'high';
    trend: 'increasing' | 'stable' | 'decreasing';
    interpretation?: string;
}

interface ActivityRatings {
    sleep?: ActivityRating;
    exercise?: ActivityRating;
    social?: ActivityRating;
    work?: ActivityRating;
}

interface LLMResponse {
    mentalHealthStatus: 'stable' | 'declining' | 'critical';
    confidenceScore: number;
    reasoningData: {
        sleepHours?: number;
        sleepQuality?: 'poor' | 'fair' | 'good';
        activityLevel?: 'low' | 'moderate' | 'high';
        activityRatings?: ActivityRatings;
        lifeBalance?: string;
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
     * Analyze activity ratings from check-ins and provide context-aware interpretations
     */
    private analyzeActivityRatings(checkIns: any[]): ActivityRatings {
        const activityTypes = ['Sleep', 'Exercise', 'Social', 'Work'];
        const result: ActivityRatings = {};
        
        // Skip if no check-ins with activities
        if (!checkIns.length) return result;
        
        // For each activity type, calculate average and trend
        activityTypes.forEach(type => {
            // Get all ratings for this activity type
            const ratings = checkIns
                .filter(c => c.activities && c.activities.some((a: any) => a.type === type))
                .map(c => c.activities.find((a: any) => a.type === type).level);
            
            if (ratings.length === 0) return;
            
            // Convert ratings to numeric values for calculation
            const ratingValues = {
                'low': 1,
                'moderate': 2,
                'high': 3
            };
            
            // Convert to numbers
            const numericRatings = ratings.map(r => ratingValues[r as 'low' | 'moderate' | 'high']);
            
            // Calculate average
            const avg = numericRatings.reduce((sum, val) => sum + val, 0) / numericRatings.length;
            let level: 'low' | 'moderate' | 'high' = 'moderate';
            if (avg <= 1.33) level = 'low';
            else if (avg >= 2.33) level = 'high';
            
            // Detect trend (if we have enough data points)
            let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
            if (ratings.length >= 3) {
                const recent = numericRatings.slice(-2).reduce((sum, val) => sum + val, 0) / 2;
                const older = numericRatings.slice(0, -2).reduce((sum, val) => sum + val, 0) / numericRatings.slice(0, -2).length;
                
                if (recent - older > 0.5) trend = 'increasing';
                else if (older - recent > 0.5) trend = 'decreasing';
            }
            
            // Add context-aware interpretation based on activity type
            let interpretation = '';
            const key = type.toLowerCase() as 'sleep' | 'exercise' | 'social' | 'work';
            
            switch (key) {
                case 'sleep':
                    if (level === 'high') {
                        interpretation = 'Adequate sleep is a positive indicator for mental health';
                    } else if (level === 'low') {
                        interpretation = 'Low sleep may indicate insomnia or sleep deprivation, which can negatively impact mental health';
                    }
                    if (trend === 'decreasing') {
                        interpretation += '; decreasing trend may be concerning';
                    }
                    break;
                    
                case 'exercise':
                    if (level === 'high') {
                        interpretation = 'Regular exercise is beneficial for mental health';
                    } else if (level === 'low') {
                        interpretation = 'Low physical activity may contribute to decreased mood and energy levels';
                    }
                    if (trend === 'increasing') {
                        interpretation += '; increasing trend is encouraging';
                    }
                    break;
                    
                case 'social':
                    if (level === 'high') {
                        interpretation = 'Strong social connections are protective for mental health';
                    } else if (level === 'low') {
                        interpretation = 'Limited social interaction may indicate isolation or withdrawal';
                    }
                    if (trend === 'decreasing') {
                        interpretation += '; decreasing social activity may be a warning sign';
                    }
                    break;
                    
                case 'work':
                    if (level === 'high') {
                        interpretation = 'High work intensity may indicate stress or potential burnout risk';
                    } else if (level === 'moderate') {
                        interpretation = 'Moderate work engagement suggests a healthy balance';
                    } else if (level === 'low') {
                        interpretation = 'Low work activity could indicate either healthy boundaries or potential disengagement';
                    }
                    if (trend === 'increasing' && level === 'high') {
                        interpretation += '; increasing high workload is concerning for burnout';
                    }
                    break;
            }
            
            // Set the property using lowercase key
            result[key] = { level, trend, interpretation };
        });
        
        return result;
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

        // Check for changes in activity ratings from check-ins
        if (checkIns.length >= 4) {
            const activityTypes = ['Sleep', 'Exercise', 'Social', 'Work'];
            
            activityTypes.forEach(type => {
                const recentRatings = checkIns.slice(0, 2)
                    .filter(c => c.activities && c.activities.some((a: any) => a.type === type))
                    .map(c => c.activities.find((a: any) => a.type === type).level);
                
                const previousRatings = checkIns.slice(2, 4)
                    .filter(c => c.activities && c.activities.some((a: any) => a.type === type))
                    .map(c => c.activities.find((a: any) => a.type === type).level);
                
                if (recentRatings.length > 0 && previousRatings.length > 0) {
                    const ratingValues = {
                        'low': 1,
                        'moderate': 2,
                        'high': 3
                    };
                    
                    const recentAvg = recentRatings.reduce((sum, r) => sum + ratingValues[r as 'low' | 'moderate' | 'high'], 0) / recentRatings.length;
                    const previousAvg = previousRatings.reduce((sum, r) => sum + ratingValues[r as 'low' | 'moderate' | 'high'], 0) / previousRatings.length;
                    
                    if (Math.abs(recentAvg - previousAvg) >= 1) {
                        changes.push(`Self-reported ${type.toLowerCase()} level changed significantly`);
                    }
                }
            });
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

IMPORTANT NOTE ABOUT MISSING DATA:
- Missing data points should NOT be interpreted as negative health indicators
- Missing sleep, activity, or mood data is common and often means the user didn't record data (not that they didn't sleep, exercise, or had a bad day)
- Only make assessments based on available data points
- Lower your confidence score when data is sparse
- If less than 50% of days have data for a particular metric, do not draw strong conclusions about that metric

IMPORTANT NOTE ABOUT ACTIVITY RATINGS:
Different activity ratings have different implications for mental health:
- Sleep: High ratings are generally positive (adequate rest), while low ratings may indicate insomnia or sleep deprivation
- Exercise: High ratings are generally positive (active lifestyle), while low ratings may indicate sedentary behavior
- Social: High ratings are generally positive (good social connections), while low ratings may indicate isolation or withdrawal
- Work: High ratings may be concerning (overwork, burnout), while moderate ratings are typically optimal for wellbeing

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

        // Format mood check-ins with activity ratings
        prompt += "\nMood check-ins and activity ratings:\n";
        if (checkIns.length > 0) {
            checkIns.forEach((checkIn: any) => {
                const date = checkIn.timestamp.toISOString().split('T')[0];
                prompt += `- ${date}: Mood score: ${checkIn.mood.score}/5 (${checkIn.mood.label})`;
                
                // Add activity ratings
                if (checkIn.activities && checkIn.activities.length > 0) {
                    prompt += ", Activities: [";
                    prompt += checkIn.activities.map((activity: any) => 
                        `${activity.type}: ${activity.level}`
                    ).join(", ");
                    prompt += "]";
                }
                
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
1. Sleep hours and quality (both from health data and user's own ratings)
2. Exercise and physical activity level (from health data and user's ratings)
3. Social activity ratings from check-ins
4. Work activity ratings from check-ins (note that high work ratings may indicate overwork/burnout)
5. Mood from check-ins
6. Any significant changes in patterns
7. Any risk or protective factors evident in the data
8. Balance between different life activities (sleep, exercise, social, work)

Provide your assessment in the following JSON format (and only respond with this JSON):
{
  "mentalHealthStatus": "stable|declining|critical",
  "confidenceScore": 0.XX,
  "reasoningData": {
    "sleepHours": X.X,
    "sleepQuality": "poor|fair|good",
    "activityLevel": "low|moderate|high",
    "checkInMood": X.X, // IMPORTANT: This must be a number from 1-5, NOT a string
    "activityRatings": {
      "sleep": {"level": "low|moderate|high", "trend": "increasing|stable|decreasing", "interpretation": "string explaining mental health implications"},
      "exercise": {"level": "low|moderate|high", "trend": "increasing|stable|decreasing", "interpretation": "string explaining mental health implications"},
      "social": {"level": "low|moderate|high", "trend": "increasing|stable|decreasing", "interpretation": "string explaining mental health implications"},
      "work": {"level": "low|moderate|high", "trend": "increasing|stable|decreasing", "interpretation": "string explaining mental health implications"}
    },
    "lifeBalance": "assessment of overall balance between activities",
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
     * Analyze life balance across different activity domains
     */
    private analyzeLifeBalance(activityRatings: ActivityRatings): { assessment: string, details: string[] } {
        // Check if we have enough data
        if (!activityRatings || Object.keys(activityRatings).length < 2) {
            return {
                assessment: "Insufficient data to assess life balance",
                details: []
            };
        }
        
        // Convert ratings to numeric values
        const ratingValues = {
            'low': 1,
            'moderate': 2,
            'high': 3
        };
        
        // Define ideal ranges for different activities (simplified model)
        const idealRanges: Record<string, { min: number, max: number }> = {
            'sleep': { min: 2, max: 3 },     // moderate to high is ideal
            'exercise': { min: 2, max: 3 },  // moderate to high is ideal
            'social': { min: 2, max: 3 },    // moderate to high is ideal
            'work': { min: 1.5, max: 2.5 }   // moderate is ideal, not too high or low
        };
        
        // Analyze each activity
        const analysis: string[] = [];
        let imbalanceCount = 0;
        
        for (const [activity, rating] of Object.entries(activityRatings)) {
            if (!rating || !rating.level) continue;
            
            const numericRating = ratingValues[rating.level as 'low' | 'moderate' | 'high'];
            const ideal = idealRanges[activity];
            
            if (!ideal) continue;
            
            if (numericRating < ideal.min) {
                analysis.push(`${activity} is lower than optimal`);
                imbalanceCount++;
            } else if (numericRating > ideal.max) {
                analysis.push(`${activity} is higher than optimal`);
                imbalanceCount++;
                
                // Special case for work being too high
                if (activity === 'work' && numericRating > 2.5) {
                    analysis.push("High work levels may be displacing other life activities");
                }
            }
        }
        
        // Look for specific imbalance patterns
        if (activityRatings.work && activityRatings.sleep) {
            const workRating = ratingValues[activityRatings.work.level];
            const sleepRating = ratingValues[activityRatings.sleep.level];
            
            if (workRating > 2.5 && sleepRating < 2) {
                analysis.push("Work-sleep imbalance detected: high work correlates with insufficient sleep");
            }
        }
        
        // Generate overall assessment
        let overallAssessment = "";
        if (imbalanceCount === 0) {
            overallAssessment = "Good overall life balance across activities";
        } else if (imbalanceCount === 1) {
            overallAssessment = "Generally balanced with one area needing attention";
        } else if (imbalanceCount >= 2) {
            overallAssessment = "Multiple imbalances detected across life activities";
        }
        
        return {
            assessment: overallAssessment,
            details: analysis
        };
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
        const activityRatings = this.analyzeActivityRatings(checkIns);
        const checkInMood = this.calculateAverageMood(checkIns);
        const checkInNotes = this.getLatestCheckInNotes(checkIns);
        const recentExerciseMinutes = this.calculateRecentExerciseMinutes(healthData);
        const stepsPerDay = this.calculateAverageSteps(healthData);
        const significantChanges = this.detectSignificantChanges(healthData, checkIns);
        
        // Analyze life balance if we have activity ratings
        let lifeBalance: string | undefined = undefined;
        if (activityRatings && Object.keys(activityRatings).length > 0) {
            const balanceAnalysis = this.analyzeLifeBalance(activityRatings);
            lifeBalance = balanceAnalysis.assessment;
            
            // Add important imbalances to significant changes
            if (balanceAnalysis.details.length > 0) {
                significantChanges.push(...balanceAnalysis.details);
            }
        }

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
        
        // Check for work-life imbalance as a risk factor
        if (activityRatings?.work?.level === 'high' && 
            (activityRatings?.sleep?.level === 'low' || activityRatings?.social?.level === 'low')) {
            mentalHealthStatus = 'declining';
        }

        return {
            mentalHealthStatus,
            confidenceScore: 0.7,
            reasoningData: {
                sleepHours,
                sleepQuality,
                activityLevel,
                activityRatings,
                lifeBalance,
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
                activityRatings: llmResponse.reasoningData.activityRatings || preprocessedData.reasoningData.activityRatings,
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

            // If support is needed, use the dedicated peer support service
            if (analysis.needsSupport) {
                await peerSupportService.initiateSupportRequest(userId, mentalHealthState._id);
            }

            return mentalHealthState;
        } catch (error) {
            console.error('[LLM] Error saving mental health state:', error);
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