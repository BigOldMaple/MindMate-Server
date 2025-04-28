// server/Database/MentalHealthStateSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMentalHealthState extends Document {
  userId: Types.ObjectId;
  timestamp: Date;
  mentalHealthStatus: 'stable' | 'declining' | 'critical';
  confidenceScore: number; // 0.0 to 1.0
  reasoningData: {
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good';
    activityLevel?: 'low' | 'moderate' | 'high';
    checkInMood?: number; // 1-5 scale from user check-ins
    checkInNotes?: string;
    recentExerciseMinutes?: number;
    stepsPerDay?: number;
    significantChanges?: string[];
    additionalFactors?: Record<string, any>;
  };
  needsSupport: boolean;
  supportRequestStatus: 'none' | 'buddyRequested' | 'communityRequested' | 'globalRequested' | 'supportProvided';
  supportRequestTime?: Date;
  supportProvidedBy?: Types.ObjectId; // Reference to user who provided support
  supportProvidedTime?: Date;
  supportReason?: string;
  supportTips?: string[];

  metadata?: Record<string, any>;
}

const mentalHealthStateSchema = new Schema<IMentalHealthState>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  mentalHealthStatus: {
    type: String,
    enum: ['stable', 'declining', 'critical'],
    required: true,
    index: true
  },
  confidenceScore: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  reasoningData: {
    sleepHours: Number,
    sleepQuality: {
      type: String,
      enum: ['poor', 'fair', 'good']
    },
    activityLevel: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    checkInMood: {
      type: Number,
      min: 1,
      max: 5
    },
    checkInNotes: String,
    recentExerciseMinutes: Number,
    stepsPerDay: Number,
    significantChanges: [String],
    additionalFactors: Schema.Types.Mixed
  },
  needsSupport: {
    type: Boolean,
    default: false,
    index: true
  },
  supportRequestStatus: {
    type: String,
    enum: ['none', 'buddyRequested', 'communityRequested', 'globalRequested', 'supportProvided'],
    default: 'none',
    index: true
  },
  supportRequestTime: Date,
  supportProvidedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  supportProvidedTime: Date,
  supportReason: {
    type: String,
    default: null
  },
  supportTips: {
    type: [String],
    default: []
  },
  metadata: Schema.Types.Mixed
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Create compound indexes for efficient querying
mentalHealthStateSchema.index({ userId: 1, timestamp: -1 }); // Latest entries for a user
mentalHealthStateSchema.index({ mentalHealthStatus: 1, needsSupport: 1 }); // Find users needing support
mentalHealthStateSchema.index({ supportRequestStatus: 1, supportRequestTime: 1 }); // Find pending support requests

// Static methods for common queries
mentalHealthStateSchema.statics.findLatestForUser = function(userId: string | Types.ObjectId) {
  return this.findOne({ userId })
    .sort({ timestamp: -1 })
    .exec();
};

mentalHealthStateSchema.statics.findUsersNeedingSupport = function() {
  return this.find({ 
    needsSupport: true,
    supportRequestStatus: { $ne: 'supportProvided' }
  })
    .sort({ supportRequestTime: 1 })
    .populate('userId', 'username profile.name')
    .exec();
};

// Export the model
export const MentalHealthState = mongoose.models.MentalHealthState || 
                               mongoose.model<IMentalHealthState>('MentalHealthState', mentalHealthStateSchema);