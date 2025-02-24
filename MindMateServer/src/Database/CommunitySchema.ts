// server/Database/CommunitySchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

interface CommunityMember {
  userId: Types.ObjectId;
  role: 'member' | 'moderator' | 'admin';
  joinDate: Date;
}

interface CommunitySettings {
  isPrivate: boolean;
  requiresApproval: boolean;
  allowAnonymousPosts: boolean;
}

export interface ICommunity extends Document {
  name: string;
  description: string;
  type: 'support' | 'professional';
  creator: Types.ObjectId;
  members: CommunityMember[];
  settings: CommunitySettings;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const communitySchema = new Schema<ICommunity>({
  name: {
    type: String,
    required: [true, 'Community name is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Community name must be at least 3 characters long']
  },
  description: {
    type: String,
    required: [true, 'Community description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters long']
  },
  type: {
    type: String,
    enum: ['support', 'professional'],
    required: [true, 'Community type is required']
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    },
    joinDate: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    isPrivate: {
      type: Boolean,
      default: false
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    allowAnonymousPosts: {
      type: Boolean,
      default: true
    }
  },
  tags: [String],
}, {
  timestamps: true,
  collection: 'communities'
});

// Indexes
communitySchema.index({ name: 1 }, { unique: true });
communitySchema.index({ type: 1 });
communitySchema.index({ tags: 1 });

export const Community = mongoose.models.Community || mongoose.model<ICommunity>('Community', communitySchema);