// server/Database/CheckInSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMood {
  score: number;
  label: string;
  description?: string;
}

export interface IActivity {
  type: string;
  level: 'low' | 'moderate' | 'high';
}

export interface ICheckIn extends Document {
  userId: Types.ObjectId;
  timestamp: Date;
  mood: IMood;
  activities: IActivity[];
  notes?: string;
}

const checkInSchema = new Schema<ICheckIn>({
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
  mood: {
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    label: {
      type: String,
      required: true,
      enum: ['Very Low', 'Low', 'Neutral', 'Good', 'Very Good']
    },
    description: String
  },
  activities: [{
    type: {
      type: String,
      required: true,
      enum: ['Sleep', 'Exercise', 'Social', 'Work']
    },
    level: {
      type: String,
      required: true,
      enum: ['low', 'moderate', 'high']
    }
  }],
  notes: String
}, {
  timestamps: true
});

// Indexes for efficient queries
checkInSchema.index({ userId: 1, timestamp: -1 });
checkInSchema.index({ 'mood.score': 1 });

export const CheckIn = mongoose.models.CheckIn || mongoose.model<ICheckIn>('CheckIn', checkInSchema);