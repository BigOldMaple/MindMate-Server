// server/routes/chat.ts
import express from 'express';
import { Types } from 'mongoose';
import { Message, Conversation, IMessage, IConversation } from '../Database/ChatSchema';
import { User } from '../Database/Schema';
import { auth } from '../services/auth';
import { ApiError } from '../middleware/error';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = auth.verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Get all conversations for current user
router.get('/conversations', authenticateToken, async (req: any, res) => {
    try {
        const conversations = await Conversation.find({
            'participants.userId': req.user._id,
            deletedAt: null
        })
        .populate('participants.userId', 'username profile.name profile.isVerifiedProfessional')
        .populate('lastMessage.senderId', 'username')
        .sort({ 'lastMessage.timestamp': -1 })
        .lean();

        // Transform conversations to include only necessary data
        const transformedConversations = conversations.map(conv => {
            const otherParticipant = conv.participants.find(
                (p: { userId: { _id: Types.ObjectId; username: string; profile: { name: string; isVerifiedProfessional: boolean } } }) => 
                    !p.userId._id.equals(req.user._id)
            );
            
            const userParticipant = conv.participants.find(
                (p: { userId: { _id: Types.ObjectId }, unreadCount: number }) => 
                    p.userId._id.equals(req.user._id)
            );

            return {
                id: conv._id,
                type: conv.type,
                participant: otherParticipant ? {
                    id: otherParticipant.userId._id,
                    username: otherParticipant.userId.username,
                    name: otherParticipant.userId.profile.name,
                    isVerifiedProfessional: otherParticipant.userId.profile.isVerifiedProfessional
                } : null,
                unreadCount: userParticipant?.unreadCount || 0,
                lastMessage: conv.lastMessage ? {
                    content: conv.lastMessage.content,
                    timestamp: conv.lastMessage.timestamp,
                    senderId: conv.lastMessage.senderId._id,
                    senderUsername: conv.lastMessage.senderId.username
                } : null,
                updatedAt: conv.updatedAt
            };
        });

        res.json(transformedConversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req: any, res) => {
    try {
        const { conversationId } = req.params;
        const { before, limit = 50 } = req.query;

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': req.user._id,
            deletedAt: null
        });

        if (!conversation) {
            throw new ApiError(404, 'Conversation not found');
        }

        // Build query
        const query: any = {
            conversationId,
            deletedAt: null
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .populate('senderId', 'username profile.name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit as string))
            .lean();

        // Mark messages as read
        await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $set: {
                    'participants.$[elem].unreadCount': 0
                }
            },
            {
                arrayFilters: [{ 'elem.userId': req.user._id }]
            }
        );

        res.json(messages);
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    }
});

// Create a new direct conversation or get existing one
router.post('/conversations', authenticateToken, async (req: any, res) => {
    try {
        const { participantId } = req.body;

        if (!participantId) {
            return res.status(400).json({ error: 'Participant ID is required' });
        }

        // Check if participant exists
        const participant = await User.findById(participantId);
        if (!participant) {
            throw new ApiError(404, 'User not found');
        }

        // Check if conversation already exists
        const existingConversation = await Conversation.findOne({
            type: 'direct',
            participants: {
                $all: [
                    { $elemMatch: { userId: req.user._id } },
                    { $elemMatch: { userId: participantId } }
                ]
            },
            deletedAt: null
        });

        if (existingConversation) {
            return res.json(existingConversation);
        }

        // Create new conversation
        const newConversation = new Conversation({
            type: 'direct',
            participants: [
                { userId: req.user._id, unreadCount: 0 },
                { userId: participantId, unreadCount: 0 }
            ]
        });

        await newConversation.save();
        res.status(201).json(newConversation);
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to create conversation' });
        }
    }
});

// Send a message in a conversation
router.post('/conversations/:conversationId/messages', authenticateToken, async (req: any, res) => {
    try {
        const { conversationId } = req.params;
        const { content, contentType = 'text', replyTo, metadata } = req.body;

        // Validate input
        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': req.user._id,
            deletedAt: null
        });

        if (!conversation) {
            throw new ApiError(404, 'Conversation not found');
        }

        // Create message
        const message = new Message({
            conversationId,
            senderId: req.user._id,
            content,
            contentType,
            metadata,
            replyTo,
            readBy: [{ userId: req.user._id, readAt: new Date() }]
        });

        await message.save();

        // Update conversation participants' unread counts
        await conversation.incrementUnreadCount(req.user._id);

        // Populate sender details before sending response
        await message.populate('senderId', 'username profile.name');

        res.status(201).json(message);
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
});

// Mark messages as read
router.post('/conversations/:conversationId/read', authenticateToken, async (req: any, res) => {
    try {
        const { conversationId } = req.params;

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            'participants.userId': req.user._id,
            deletedAt: null
        });

        if (!conversation) {
            throw new ApiError(404, 'Conversation not found');
        }

        // Reset unread count for user
        await conversation.resetUnreadCount(req.user._id);

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to mark messages as read' });
        }
    }
});

// Delete a message
router.delete('/messages/:messageId', authenticateToken, async (req: any, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findOne({
            _id: messageId,
            senderId: req.user._id,
            deletedAt: null
        });

        if (!message) {
            throw new ApiError(404, 'Message not found or unauthorized');
        }

        message.deletedAt = new Date();
        await message.save();

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to delete message' });
        }
    }
});

export default router;