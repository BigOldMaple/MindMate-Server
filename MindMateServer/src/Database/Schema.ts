import mongoose, { Document, Schema, Types, model } from 'mongoose';

// Base interfaces
interface BaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User interfaces
interface SensorSettings {
  gps: boolean;
  accelerometer: boolean;
  microphone: boolean;
}

interface UserPrivacy {
  isAnonymous: boolean;
  sensorDataCollectionEnabled: SensorSettings;
}

interface Notification {
  type: 'buddy_request' | 'community_invite' | 'system';
  senderId: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

interface UserProfile {
  name: string;
  avatar?: string;
  isVerifiedProfessional: boolean;
  organizationAffiliation?: string;
  verificationDocuments: string[];
  joinDate: Date;
}

interface BuddyPeer {
  userId: Types.ObjectId;
  relationship: string;
  dateAdded: Date;
}

interface CommunityMembership {
  communityId: Types.ObjectId;
  role: 'member' | 'moderator' | 'admin';
  joinDate: Date;
}

interface UserRatings {
  averageRating: number;
  totalRatings: number;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface IUser extends BaseDocument {
  username: string;
  email: string;
  passwordHash: string;
  phone?: string;
  profile: UserProfile;
  privacy: UserPrivacy;
  buddyPeers: BuddyPeer[];
  communities: CommunityMembership[];
  ratings: UserRatings;
  emergencyContact?: EmergencyContact;
  notifications: Notification[]; // Add this line
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Username must be at least 2 characters long']
  },
  phone: {
    type: String,
    sparse: true,
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  notifications: [{
    type: {
      type: String,
      enum: ['buddy_request', 'community_invite', 'system'],
      required: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  profile: {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    avatar: String,
    isVerifiedProfessional: {
      type: Boolean,
      default: false
    },
    organizationAffiliation: String,
    verificationDocuments: [String],
    joinDate: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  privacy: {
    isAnonymous: {
      type: Boolean,
      default: false,
      required: true
    },
    sensorDataCollectionEnabled: {
      gps: { type: Boolean, default: true, required: true },
      accelerometer: { type: Boolean, default: true, required: true },
      microphone: { type: Boolean, default: true, required: true }
    }
  },
  buddyPeers: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    relationship: {
      type: String,
      required: true
    },
    dateAdded: {
      type: Date,
      default: Date.now,
      required: true
    }
  }],
  communities: [{
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'Community',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member',
      required: true
    },
    joinDate: {
      type: Date,
      default: Date.now,
      required: true
    }
  }],
  ratings: {
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Single compound index for username and email
userSchema.index({ username: 1, email: 1 });

// Index for verified professionals
userSchema.index({ 'profile.isVerifiedProfessional': 1 });

// Add pre-save middleware for debugging
userSchema.pre('save', function (next) {
  console.log('Pre-save middleware running for user:', this.email);
  next();
});

// Add error handling middleware
userSchema.post('save', function (error: any, _doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    // Extract the duplicate key field from the error message
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// Safe model registration
export const User = mongoose.models.User || model<IUser>('User', userSchema);