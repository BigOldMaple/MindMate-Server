// server/Database/HealthDataSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

// Interfaces for health data types
export interface IStepsData {
  count: number;
  startTime: Date;
  endTime: Date;
  dataSource?: string;
}

export interface IDistanceData {
  distance: {
    inMeters: number;
    inKilometers: number;
  };
  startTime: Date;
  endTime: Date;
  dataSource?: string;
}

export interface ISleepData {
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
}

export interface IExerciseData {
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
}

// Main HealthData interface
export interface IHealthData extends Document {
  userId: Types.ObjectId;
  dataType: 'steps' | 'distance' | 'sleep' | 'exercise';
  date: Date; // The day this data applies to (for easier querying by day)
  weekNumber: number; // ISO week number (for easier weekly aggregation)
  month: number; // Month number 0-11 (for easier monthly aggregation)
  year: number; // Year (for easier yearly aggregation)
  stepsData?: IStepsData;
  distanceData?: IDistanceData;
  sleepData?: ISleepData;
  exerciseData?: IExerciseData;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  originalId?: string; // ID from Health Connect for deduplication
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
    dataType: {
      type: String,
      enum: ['steps', 'distance', 'sleep', 'exercise'],
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
    stepsData: {
      count: Number,
      startTime: Date,
      endTime: Date,
      dataSource: String,
    },
    distanceData: {
      distance: {
        inMeters: Number,
        inKilometers: Number,
      },
      startTime: Date,
      endTime: Date,
      dataSource: String,
    },
    sleepData: {
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
    exerciseData: {
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
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    originalId: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient querying
healthDataSchema.index({ userId: 1, dataType: 1, date: 1 });
healthDataSchema.index({ userId: 1, date: 1 });
healthDataSchema.index({ userId: 1, weekNumber: 1, year: 1 });
healthDataSchema.index({ userId: 1, month: 1, year: 1 });
healthDataSchema.index({ userId: 1, year: 1 });

// Helper method to get ISO week number
healthDataSchema.pre('save', function (next) {
  const date = this.date;
  // Calculate ISO week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  this.weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  this.month = date.getMonth();
  this.year = date.getFullYear();
  next();
});

// Create model
export const HealthData = mongoose.models.HealthData || mongoose.model<IHealthData>('HealthData', healthDataSchema);