// server/Database/DeviceTokenSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  lastActive: Date;
  metadata: {
    checkInCooldown?: boolean;
    lastCheckIn?: Date;
    lastNotification?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  deviceId: {
    type: String
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  metadata: {
    checkInCooldown: {
      type: Boolean,
      default: false
    },
    lastCheckIn: Date,
    lastNotification: Date
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
deviceTokenSchema.index({ userId: 1, platform: 1 });
deviceTokenSchema.index({ token: 1 }, { unique: true });

export const DeviceToken = mongoose.models.DeviceToken || 
                          mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);