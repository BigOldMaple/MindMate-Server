import { Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { User } from '../Database/Schema';
import { Message, Conversation, IParticipant } from '../Database/ChatSchema';
import { Types } from 'mongoose';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  username?: string;
}

interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'ping';
  payload?: any;
}

class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, request) => {
      try {
        const url = new URL(request.url || '', 'ws://localhost');
        const token = url.searchParams.get('token');

        if (!token) {
          ws.close(1008, 'Token required');
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };
        const user = await User.findById(decoded.userId);

        if (!user) {
          ws.close(1008, 'User not found');
          return;
        }

        ws.userId = decoded.userId;
        ws.username = user.username;
        ws.isAlive = true;

        this.clients.set(decoded.userId, ws);

        console.log(`Client connected: ${user.username} (${decoded.userId})`);

        ws.on('message', async (rawData) => {
          try {
            const data = JSON.parse(rawData.toString());
            await this.handleMessage(ws, data);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });
        
        ws.on('close', () => this.handleClose(ws));
        ws.on('pong', () => { ws.isAlive = true; });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1008, 'Authentication failed');
      }
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    try {
      if (!ws.userId) return;

      switch (message.type) {
        case 'message':
          await this.handleChatMessage(ws, message.payload);
          break;
        case 'typing':
          await this.handleTypingStatus(ws, message.payload);
          break;
        case 'read':
          await this.handleMessageRead(ws, message.payload);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Failed to process message' }
      }));
    }
  }

  private async handleChatMessage(ws: AuthenticatedWebSocket, payload: any): Promise<void> {
    try {
      if (!ws.userId) return;

      const { conversationId, content } = payload;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': ws.userId
      });

      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      const message = new Message({
        conversationId,
        senderId: ws.userId,
        content,
        contentType: payload.contentType || 'text', // Support different content types
        readBy: [{ userId: ws.userId, readAt: new Date() }]
      });

      await message.save();

      await Conversation.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage: {
              messageId: message._id,
              content,
              senderId: ws.userId,
              timestamp: message.createdAt
            }
          },
          $inc: {
            'participants.$[other].unreadCount': 1
          }
        },
        {
          arrayFilters: [{ 'other.userId': { $ne: ws.userId } }]
        }
      );

      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username profile.name');

      conversation.participants.forEach((participant: IParticipant) => {
        const recipientWs = this.clients.get(participant.userId.toString());
        if (recipientWs && recipientWs !== ws && recipientWs.readyState === WebSocket.OPEN) {
          recipientWs.send(JSON.stringify({
            type: 'message',
            payload: populatedMessage
          }));
        }
      });
    } catch (error) {
      console.error('Error handling chat message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Failed to send message' }
      }));
    }
  }

  private async handleTypingStatus(ws: AuthenticatedWebSocket, payload: any): Promise<void> {
    try {
      if (!ws.userId) return;

      const { conversationId, isTyping } = payload;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': ws.userId
      });

      if (!conversation) return;

      conversation.participants.forEach((participant: IParticipant) => {
        const recipientWs = this.clients.get(participant.userId.toString());
        if (recipientWs && recipientWs !== ws && recipientWs.readyState === WebSocket.OPEN) {
          recipientWs.send(JSON.stringify({
            type: 'typing',
            payload: {
              conversationId,
              userId: ws.userId, // Changed from ws.username
              isTyping
            }
          }));
        }
      });
    } catch (error) {
      console.error('Error handling typing status:', error);
    }
  }

  private async handleMessageRead(ws: AuthenticatedWebSocket, payload: any): Promise<void> {
    try {
      if (!ws.userId) return;

      const { conversationId, messageIds } = payload;

      await Message.updateMany(
        {
          _id: { $in: messageIds.map((id: string) => new Types.ObjectId(id)) },
          conversationId: new Types.ObjectId(conversationId),
          'readBy.userId': { $ne: ws.userId }
        },
        {
          $push: {
            readBy: {
              userId: ws.userId,
              readAt: new Date()
            }
          }
        }
      );

      await Conversation.updateOne(
        {
          _id: new Types.ObjectId(conversationId),
          'participants.userId': ws.userId
        },
        {
          $set: { 'participants.$.unreadCount': 0 }
        }
      );

      const messages = await Message.find({
        _id: { $in: messageIds.map((id: string) => new Types.ObjectId(id)) }
      });

      const uniqueSenderIds = [...new Set(messages.map(msg => msg.senderId.toString()))];

      uniqueSenderIds.forEach(senderId => {
        const senderWs = this.clients.get(senderId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
          senderWs.send(JSON.stringify({
            type: 'read',
            payload: {
              conversationId,
              messageIds,
              readBy: ws.userId,
              readAt: new Date().toISOString()
            }
          }));
        }
      });
    } catch (error) {
      console.error('Error handling message read status:', error);
    }
  }

  private handleClose(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      console.log(`Client disconnected: ${ws.username} (${ws.userId})`);
      this.clients.delete(ws.userId);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval first
    
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          if (ws.userId) {
            this.handleClose(ws);
          }
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    
    // Prevent the interval from keeping the Node.js process alive
    this.heartbeatInterval.unref();
    
    this.wss.on('close', () => {
      this.stopHeartbeat();
    });
  }
  
  // Add a method to stop the heartbeat
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public getClients(): Map<string, AuthenticatedWebSocket> {
    return this.clients;
  }

  // Enhance the close method to clean up resources
  public close(callback?: () => void): void {
    // Stop the heartbeat
    this.stopHeartbeat();
    
    // Terminate all client connections
    this.clients.forEach((ws) => {
      try {
        ws.terminate();
      } catch (e) {
        // Ignore errors during shutdown
      }
    });
    this.clients.clear();
    
    // Close the WebSocket server
    this.wss.close(callback);
  }
}

export default WebSocketServer;