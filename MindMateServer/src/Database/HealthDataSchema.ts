// Updated HealthDataSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

// Main DailyHealthData interface - day-centric approach
export interface IHealthData extends Document {
  userId: Types.ObjectId;
  date: Date;  // The day this data applies to (midnight of the day)
  weekNumber: number;
  month: number;
  year: number;
  
  // Health metrics - all optional since a day might have any combination
  steps?: {
    count: number;
    startTime: Date;
    endTime: Date;
    dataSource?: string;
  };
  
  distance?: {
    inMeters: number;
    inKilometers: number;
    startTime: Date;
    endTime: Date;
    dataSource?: string;
  };
  
  sleep?: {
    startTime: Date;
    endTime: Date;
    durationInSeconds: number;
    quality?: 'poor' | 'fair' | 'good';
    stages?: Array<{
      stageType: string;
      startTime: Date;
      endTime: Date;
      durationInSeconds: number;
    }>;
    dataSource?: string;
  };
  
  exercises: Array<{
    type: string;
    startTime: Date;
    endTime: Date;
    durationInSeconds: number;
    calories?: number;
    distance?: {
      inMeters: number;
      inKilometers: number;
    };
    dataSource?: string;
  }>;
  
  // Summary statistics for quick access
  summary: {
    totalSteps?: number;
    totalDistanceMeters?: number;
    totalSleepSeconds?: number;
    totalExerciseSeconds?: number;
    exerciseCount?: number;
  };
  
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema
const healthDataSchema = new Schema<IHealthData>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    weekNumber: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    steps: {
      count: Number,
      startTime: Date,
      endTime: Date,
      dataSource: String,
    },
    distance: {
      inMeters: Number,
      inKilometers: Number,
      startTime: Date,
      endTime: Date,
      dataSource: String,
    },
    sleep: {
      startTime: Date,
      endTime: Date,
      durationInSeconds: Number,
      quality: {
        type: String,
        enum: ['poor', 'fair', 'good'],
      },
      stages: [
        {
          stageType: String,
          startTime: Date,
          endTime: Date,
          durationInSeconds: Number,
        },
      ],
      dataSource: String,
    },
    exercises: [{
      type: String,
      startTime: Date,
      endTime: Date,
      durationInSeconds: Number,
      calories: Number,
      distance: {
        inMeters: Number,
        inKilometers: Number,
      },
      dataSource: String,
    }],
    summary: {
      totalSteps: Number,
      totalDistanceMeters: Number,
      totalSleepSeconds: Number,
      totalExerciseSeconds: Number,
      exerciseCount: Number,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create optimized indexes
healthDataSchema.index({ userId: 1, date: 1 }, { unique: true });
healthDataSchema.index({ userId: 1, weekNumber: 1, year: 1 });
healthDataSchema.index({ userId: 1, month: 1, year: 1 });
healthDataSchema.index({ userId: 1, year: 1 });
healthDataSchema.index({ userId: 1, 'exercises.type': 1 });

// Create model (keeping the same name)
export const HealthData = mongoose.models.HealthData || 
                          mongoose.model<IHealthData>('HealthData', healthDataSchema);