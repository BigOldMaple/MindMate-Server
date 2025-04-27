// MindMateServer/src/Database/SupportStatisticsSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISupportStatistics extends Document {
  userId: Types.ObjectId;
  
  // Support provided metrics
  supportProvided: {
    total: number;
    buddyTier: number;
    communityTier: number;
    globalTier: number;
    lastProvidedAt: Date | null;
  };
  
  // Support received metrics
  supportReceived: {
    total: number;
    buddyTier: number;
    communityTier: number;
    globalTier: number;
    lastReceivedAt: Date | null;
  };
  
  // History of support actions
  supportHistory: Array<{
    type: 'provided' | 'received';
    tier: 'buddy' | 'community' | 'global';
    timestamp: Date;
    userId: Types.ObjectId; // The other user involved
    assessmentId: Types.ObjectId; // The related mental health assessment
  }>;
  
  // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

const supportStatisticsSchema = new Schema<ISupportStatistics>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  supportProvided: {
    total: {
      type: Number,
      default: 0
    },
    buddyTier: {
      type: Number,
      default: 0
    },
    communityTier: {
      type: Number,
      default: 0
    },
    globalTier: {
      type: Number,
      default: 0
    },
    lastProvidedAt: {
      type: Date,
      default: null
    }
  },
  
  supportReceived: {
    total: {
      type: Number,
      default: 0
    },
    buddyTier: {
      type: Number,
      default: 0
    },
    communityTier: {
      type: Number,
      default: 0
    },
    globalTier: {
      type: Number,
      default: 0
    },
    lastReceivedAt: {
      type: Date,
      default: null
    }
  },
  
  supportHistory: [{
    type: {
      type: String,
      enum: ['provided', 'received'],
      required: true
    },
    tier: {
      type: String,
      enum: ['buddy', 'community', 'global'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'MentalHealthState',
      required: true
    }
  }]
}, {
  timestamps: true
});

// Create indexes for efficient querying
supportStatisticsSchema.index({ userId: 1 });
supportStatisticsSchema.index({ 'supportHistory.timestamp': 1 });

export const SupportStatistics = mongoose.models.SupportStatistics || 
                              mongoose.model<ISupportStatistics>('SupportStatistics', supportStatisticsSchema);