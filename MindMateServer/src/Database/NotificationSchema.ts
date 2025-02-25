// server/Database/NotificationSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
    userId: Types.ObjectId;
    type: 'support' | 'wellness' | 'community' | 'alert' | 'buddy';
    title: string;
    message: string;
    read: boolean;
    time: Date;
    actionable?: boolean;
    actionRoute?: string;
    actionParams?: Record<string, string>;
    relatedId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['support', 'wellness', 'community', 'alert', 'buddy'],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    time: {
        type: Date,
        default: Date.now,
        required: true
    },
    actionable: {
        type: Boolean,
        default: false
    },
    actionRoute: String,
    actionParams: {
        type: Schema.Types.Mixed,
        default: {}
    },
    relatedId: {
        type: Schema.Types.ObjectId,
        refPath: 'type',
        index: true
    }
}, {
    timestamps: true
});

// Create indexes for efficient querying
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, time: -1 });
notificationSchema.index({ userId: 1, type: 1 });

export const Notification = mongoose.models.Notification ||
    mongoose.model<INotification>('Notification', notificationSchema);