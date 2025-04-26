// server/Database/MentalHealthBaselineSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMentalHealthBaseline extends Document {
  userId: Types.ObjectId;
  establishedAt: Date;
  baselineMetrics: {
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    averageMoodScore?: number;
    averageStepsPerDay?: number;
    exerciseMinutesPerWeek?: number;
    significantPatterns?: string[];
  };
  confidenceScore: number;
  dataPoints: {
    totalDays: number;
    daysWithSleepData: number;
    daysWithActivityData: number;
    checkInsCount: number;
  };
  rawAssessmentData?: {
    mentalHealthStatus: 'stable' | 'declining' | 'critical';
    reasoningData: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const mentalHealthBaselineSchema = new Schema<IMentalHealthBaseline>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  establishedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  baselineMetrics: {
    sleepHours: Number,
    sleepQuality: {
      type: String,
      enum: ['poor', 'fair', 'good']
    },
    activityLevel: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    averageMoodScore: Number,
    averageStepsPerDay: Number,
    exerciseMinutesPerWeek: Number,
    significantPatterns: [String]
  },
  confidenceScore: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  dataPoints: {
    totalDays: Number,
    daysWithSleepData: Number,
    daysWithActivityData: Number,
    checkInsCount: Number
  },
  rawAssessmentData: {
    mentalHealthStatus: {
      type: String,
      enum: ['stable', 'declining', 'critical']
    },
    reasoningData: Schema.Types.Mixed
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for efficient querying
mentalHealthBaselineSchema.index({ userId: 1, establishedAt: -1 });

export const MentalHealthBaseline = mongoose.models.MentalHealthBaseline || 
                               mongoose.model<IMentalHealthBaseline>('MentalHealthBaseline', mentalHealthBaselineSchema);