// src/services/__tests__/websocketServer.test.ts
import WebSocket from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import WebSocketServer from '../websocketServer';
import { User } from '../../Database/Schema';
import { Message, Conversation } from '../../Database/ChatSchema';
import { Types } from 'mongoose';

// Define types for mocks and test helpers
type MockFn = jest.Mock<any, any>;

// Interface for our mock socket
interface MockSocket extends EventEmitter {
  on: MockFn;
  send: MockFn;
  close: MockFn;
  userId?: string;
  username?: string;
  isAlive?: boolean;
  ping: MockFn;
  terminate: MockFn;
  readyState?: number;
}

// Mock dependencies
jest.mock('ws');
jest.mock('jsonwebtoken');
jest.mock('../../Database/Schema');
jest.mock('../../Database/ChatSchema');

describe('WebSocket Server', () => {
  let mockServer: http.Server;
  let wss: WebSocketServer;
  let mockSocket: MockSocket;
  let mockWebSocketServer: any;
  let connectionHandler: Function;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock HTTP server
    mockServer = new EventEmitter() as any;
    
    // Mock WebSocket.Server implementation
    mockWebSocketServer = {
      on: jest.fn((event: string, handler: Function) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      }),
      clients: new Set(),
      close: jest.fn(cb => cb && cb())
    };
    
    // Cast properly to avoid TS errors
    (WebSocket.Server as unknown as jest.MockedClass<typeof WebSocket.Server>)
      .mockImplementation(() => mockWebSocketServer);
    
    // Create WebSocket server instance to test
    wss = new WebSocketServer(mockServer as any);
    
    // Create a more sophisticated mock socket with event handling capabilities
    mockSocket = new EventEmitter() as MockSocket;
    mockSocket.on = jest.fn((event, handler) => {
      // Actually register the handler so we can trigger it later
      mockSocket.addListener(event, handler);
      return mockSocket;
    });
    mockSocket.send = jest.fn();
    mockSocket.close = jest.fn();
    mockSocket.ping = jest.fn();
    mockSocket.terminate = jest.fn();
    mockSocket.isAlive = true;
    mockSocket.readyState = WebSocket.OPEN;
  });
  
  describe('Connection with valid token', () => {
    it('should authenticate and add client with valid token', async () => {
      // Arrange
      const mockUserId = new Types.ObjectId().toString();
      const mockToken = 'valid-token';
      const mockRequest = {
        url: `ws://localhost/ws?token=${mockToken}`
      };
      const mockUser = {
        _id: mockUserId,
        username: 'testuser'
      };
      
      // Mock JWT verification and User.findById
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      
      // Act - Call the connection handler directly (it was stored when on('connection') was called)
      await connectionHandler(mockSocket, mockRequest);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockSocket.userId).toBe(mockUserId);
      expect(mockSocket.username).toBe('testuser');
      expect(mockSocket.isAlive).toBe(true);
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });
  });
  
  describe('Connection with invalid token', () => {
    it('should reject connection with invalid token', async () => {
      // Arrange
      const mockToken = 'invalid-token';
      const mockRequest = {
        url: `ws://localhost/ws?token=${mockToken}`
      };
      
      // Mock JWT verification to throw error
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Act
      await connectionHandler(mockSocket, mockRequest);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(mockSocket.close).toHaveBeenCalledWith(1008, 'Authentication failed');
      expect(User.findById).not.toHaveBeenCalled();
    });
    
    it('should reject connection with missing token', async () => {
      // Arrange
      const mockRequest = {
        url: `ws://localhost/ws` // No token
      };
      
      // Act
      await connectionHandler(mockSocket, mockRequest);
      
      // Assert
      expect(mockSocket.close).toHaveBeenCalledWith(1008, 'Token required');
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });
    
    it('should reject if user is not found', async () => {
      // Arrange
      const mockUserId = new Types.ObjectId().toString();
      const mockToken = 'valid-token';
      const mockRequest = {
        url: `ws://localhost/ws?token=${mockToken}`
      };
      
      // Mock JWT verification but user not found
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue(null);
      
      // Act
      await connectionHandler(mockSocket, mockRequest);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, expect.any(String));
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockSocket.close).toHaveBeenCalledWith(1008, 'User not found');
    });
  });
  
  describe('Handle chat message', () => {
    it('should process and broadcast chat messages', async () => {
      // Arrange
      const mockUserId = new Types.ObjectId().toString();
      const mockConversationId = new Types.ObjectId().toString();
      const mockMessageId = new Types.ObjectId().toString();
      const mockContent = 'Hello world';
      
      // Setup the authenticated connection first
      mockSocket.userId = mockUserId;
      mockSocket.username = 'testuser';
      
      // Mock message data
      const messageData = {
        type: 'message',
        payload: {
          conversationId: mockConversationId,
          content: mockContent
        }
      };
      
      // Mock conversation and message
      const mockConversation = {
        _id: mockConversationId,
        participants: [
          { userId: new Types.ObjectId(mockUserId) },
          { userId: new Types.ObjectId() }
        ]
      };
      
      const mockMessageObject = {
        _id: mockMessageId,
        conversationId: mockConversationId,
        senderId: mockUserId,
        content: mockContent,
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Create a chainable mock for populate
      const mockPopulatedMessage = {
        ...mockMessageObject,
        senderId: {
          _id: mockUserId,
          username: 'testuser'
        }
      };
      
      const populateMock = jest.fn().mockResolvedValue(mockPopulatedMessage);
      
      // Mock DB methods with proper chaining
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
      (Message as jest.MockedClass<typeof Message>).mockImplementation(() => mockMessageObject as any);
      
      // Set up the findById mock with chaining
      (Message.findById as jest.Mock).mockReturnValue({
        populate: populateMock
      });
      
      (Conversation.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // Connect the socket - this will set up the message handler
      const mockRequest = { url: `ws://localhost/ws?token=valid-token` };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue({ _id: mockUserId, username: 'testuser' });
      
      // First establish the connection
      await connectionHandler(mockSocket, mockRequest);
      
      // Here's the key: WebSocketServer expects raw message data, not JSON
      // Act - Simulate receiving a raw WebSocket message from client
      // In WebSocket protocol, messages are received as raw data in the message event
      await mockSocket.emit('message', JSON.stringify(messageData));
      
      // Give some time for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      expect(Conversation.findOne).toHaveBeenCalledWith({
        _id: mockConversationId,
        'participants.userId': mockUserId
      });
      
      expect(Message).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: mockConversationId,
        senderId: mockUserId,
        content: mockContent,
      }));
      
      expect(mockMessageObject.save).toHaveBeenCalled();
      
      expect(Conversation.updateOne).toHaveBeenCalledWith(
        { _id: mockConversationId },
        expect.objectContaining({
          $set: expect.objectContaining({
            lastMessage: expect.objectContaining({
              messageId: mockMessageId,
              content: mockContent
            })
          })
        }),
        expect.anything()
      );
      
      expect(Message.findById).toHaveBeenCalledWith(mockMessageId);
      expect(populateMock).toHaveBeenCalledWith('senderId', 'username profile.name');
    });
  });
  
  describe('Handle typing status', () => {
    it('should broadcast typing status to conversation participants', async () => {
      // Arrange
      const mockUserId = new Types.ObjectId().toString();
      const mockOtherUserId = new Types.ObjectId().toString();
      const mockConversationId = new Types.ObjectId().toString();
      
      // Setup the authenticated connection first
      mockSocket.userId = mockUserId;
      mockSocket.username = 'testuser';
      
      // Mock typing status data
      const typingData = {
        type: 'typing',
        payload: {
          conversationId: mockConversationId,
          isTyping: true
        }
      };
      
      // Mock conversation
      const mockConversation = {
        _id: mockConversationId,
        participants: [
          { userId: new Types.ObjectId(mockUserId) },
          { userId: new Types.ObjectId(mockOtherUserId) }
        ]
      };
      
      // Mock another connected client
      const otherUserSocket: Partial<MockSocket> = {
        userId: mockOtherUserId,
        send: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      // Add our socket and the other user's socket to the client map
      (wss as any).clients = new Map();
      (wss as any).clients.set(mockUserId, mockSocket);
      (wss as any).clients.set(mockOtherUserId, otherUserSocket);
      
      // Mock conversation find
      (Conversation.findOne as jest.Mock).mockResolvedValue(mockConversation);
      
      // Connect the socket - this will set up the message handler
      const mockRequest = { url: `ws://localhost/ws?token=valid-token` };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue({ _id: mockUserId, username: 'testuser' });
      
      await connectionHandler(mockSocket, mockRequest);
      
      // Act - Emit a typing event directly
      await mockSocket.emit('message', JSON.stringify(typingData));
      
      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      expect(Conversation.findOne).toHaveBeenCalledWith({
        _id: mockConversationId,
        'participants.userId': mockUserId
      });
      
      // Check that the typing status was broadcast to the other user
      expect(otherUserSocket.send).toHaveBeenCalledWith(expect.stringContaining('typing'));
      
      // Verify that the data sent contains the right information
      const sentData = JSON.parse((otherUserSocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentData.type).toBe('typing');
      expect(sentData.payload.conversationId).toBe(mockConversationId);
      expect(sentData.payload.userId).toBe(mockUserId);
      expect(sentData.payload.isTyping).toBe(true);
    });
  });
  
  describe('Handle message read', () => {
    it('should update message read status', async () => {
      // Arrange
      const mockUserId = new Types.ObjectId().toString();
      const mockOtherUserId = new Types.ObjectId().toString();
      const mockConversationId = new Types.ObjectId().toString();
      const mockMessageIds = [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString()
      ];
      
      // Setup the authenticated connection first
      mockSocket.userId = mockUserId;
      mockSocket.username = 'testuser';
      
      // Mock read status data
      const readData = {
        type: 'read',
        payload: {
          conversationId: mockConversationId,
          messageIds: mockMessageIds
        }
      };
      
      // Mock message find result
      const mockMessages = [
        { senderId: new Types.ObjectId(mockOtherUserId) },
        { senderId: new Types.ObjectId(mockOtherUserId) }
      ];
      
      // Mock another connected client (message sender)
      const otherUserSocket: Partial<MockSocket> = {
        userId: mockOtherUserId,
        send: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      // Add the sender's socket to the client map
      (wss as any).clients = new Map();
      (wss as any).clients.set(mockOtherUserId, otherUserSocket);
      
      // Mock DB methods
      (Message.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 2 });
      (Conversation.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      (Message.find as jest.Mock).mockResolvedValue(mockMessages);
      
      // Connect the socket - this will set up the message handler
      const mockRequest = { url: `ws://localhost/ws?token=valid-token` };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue({ _id: mockUserId, username: 'testuser' });
      
      await connectionHandler(mockSocket, mockRequest);
      
      // Act - Emit a read event directly
      await mockSocket.emit('message', JSON.stringify(readData));
      
      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      expect(Message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: { $in: mockMessageIds.map(id => expect.any(Object)) },
          conversationId: expect.any(Object),
          'readBy.userId': { $ne: mockUserId }
        }),
        expect.objectContaining({
          $push: expect.objectContaining({
            readBy: expect.objectContaining({
              userId: mockUserId,
              readAt: expect.any(Date)
            })
          })
        })
      );
      
      expect(Conversation.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(Object),
          'participants.userId': mockUserId
        }),
        expect.objectContaining({
          $set: { 'participants.$.unreadCount': 0 }
        })
      );
      
      expect(Message.find).toHaveBeenCalledWith({
        _id: { $in: mockMessageIds.map(id => expect.any(Object)) }
      });
      
      // Verify the read receipt was sent to the message sender
      expect(otherUserSocket.send).toHaveBeenCalledWith(expect.stringContaining('read'));
      
      // Verify the data in the read receipt notification
      const sentData = JSON.parse((otherUserSocket.send as jest.Mock).mock.calls[0][0]);
      expect(sentData.type).toBe('read');
      expect(sentData.payload.conversationId).toBe(mockConversationId);
      expect(sentData.payload.messageIds).toEqual(mockMessageIds);
      expect(sentData.payload.readBy).toBe(mockUserId);
      expect(sentData.payload.readAt).toBeDefined();
    });
  });
  
  describe('Client management', () => {
    it('should remove client on connection close', async () => {
      // Arrange
      const mockUserId = 'user123';
      mockSocket.userId = mockUserId;
      mockSocket.username = 'testuser';
      
      // Add our socket to the client map
      (wss as any).clients = new Map();
      (wss as any).clients.set(mockUserId, mockSocket);
      
      // Connect the socket - this will set up the close handler
      const mockRequest = { url: `ws://localhost/ws?token=valid-token` };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (User.findById as jest.Mock).mockResolvedValue({ _id: mockUserId, username: 'testuser' });
      
      await connectionHandler(mockSocket, mockRequest);
      
      // Verify client is in map
      expect((wss as any).clients.get(mockUserId)).toBe(mockSocket);
      
      // Act - Emit a close event directly
      mockSocket.emit('close');
      
      // Allow time for event to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      expect((wss as any).clients.has(mockUserId)).toBe(false);
    });
  });
  
  describe('Server shutdown', () => {
    it('should close all connections when server closes', () => {
      // Act
      wss.close();
      
      // Assert
      expect(mockWebSocketServer.close).toHaveBeenCalled();
    });
  });
  
  // Add a teardown to avoid lingering event listeners
  afterAll(() => {
    // Clean up any lingering event listeners
    if (mockSocket) {
      mockSocket.removeAllListeners();
    }
  });
});