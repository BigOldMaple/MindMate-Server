// server/Database/ChatSchema.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

// Interfaces for type safety
interface IParticipant {
  userId: Types.ObjectId;
  unreadCount: number;
  lastReadMessageId?: Types.ObjectId;
  joinedAt: Date;
}

interface ReadReceipt {
  userId: Types.ObjectId;
  readAt: Date;
}

interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  contentType: 'text' | 'image' | 'file';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
  readBy: ReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  replyTo?: Types.ObjectId;
}

interface IConversation extends Document {
  type: 'direct' | 'group';
  participants: IParticipant[];
  lastMessage?: {
    messageId: Types.ObjectId;
    content: string;
    senderId: Types.ObjectId;
    timestamp: Date;
  };
  metadata?: {
    groupName?: string;
    groupAvatar?: string;
    description?: string;
  };
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Message Schema
const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  metadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    dimensions: {
      width: Number,
      height: Number
    }
  },
  readBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Conversation Schema
const conversationSchema = new Schema<IConversation>({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    lastReadMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    content: String,
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date
  },
  metadata: {
    groupName: String,
    groupAvatar: String,
    description: String
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ 'readBy.userId': 1 });

conversationSchema.index({ 'participants.userId': 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });
conversationSchema.index({ type: 1 });

// Methods for the Message schema
messageSchema.methods.markAsRead = async function(userId: Types.ObjectId) {
  if (!this.readBy.some((read: ReadReceipt) => read.userId.equals(userId))) {
    this.readBy.push({ userId, readAt: new Date() });
    await this.save();
  }
};

// Methods for the Conversation schema
conversationSchema.methods.addParticipant = async function(userId: Types.ObjectId) {
  if (!this.participants.some((p: IParticipant) => p.userId.equals(userId))) {
    this.participants.push({
      userId,
      unreadCount: 0,
      joinedAt: new Date()
    });
    await this.save();
  }
};

conversationSchema.methods.removeParticipant = async function(userId: Types.ObjectId) {
  this.participants = this.participants.filter((p: IParticipant) => !p.userId.equals(userId));
  await this.save();
};

conversationSchema.methods.incrementUnreadCount = async function(exceptUserId: Types.ObjectId) {
  this.participants.forEach((participant: IParticipant) => {
    if (!participant.userId.equals(exceptUserId)) {
      participant.unreadCount += 1;
    }
  });
  await this.save();
};

conversationSchema.methods.resetUnreadCount = async function(userId: Types.ObjectId) {
  const participant = this.participants.find((p: IParticipant) => p.userId.equals(userId));
  if (participant) {
    participant.unreadCount = 0;
    await this.save();
  }
};

// Middleware
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Update conversation's last message
    await mongoose.model('Conversation').findByIdAndUpdate(
      this.conversationId,
      {
        lastMessage: {
          messageId: this._id,
          content: this.content,
          senderId: this.senderId,
          timestamp: this.createdAt
        }
      }
    );
  }
  next();
});

// Export models
export const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', messageSchema);
export const Conversation = mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', conversationSchema);

// Export interfaces
export type { IMessage, IConversation, IParticipant };