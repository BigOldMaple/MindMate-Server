// services/__tests__/chatApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { 
    chatApi, 
    ChatMessage, 
    ChatPreview, 
    ChatParticipant, 
    SendMessageInput 
  } from '../chatApi';
  
  // Create mock for global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  describe('Chat API Service', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
      
      // Set up a token for auth
      SecureStore.setItemAsync('userToken', 'test-token');
      
      // Reset fetch mock to a default implementation
      (global.fetch as jest.Mock).mockReset().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
    });
  
    describe('getConversations', () => {
      it('returns array of conversation previews', async () => {
        // Arrange
        const mockConversations: ChatPreview[] = [
          {
            id: 'conv1',
            type: 'direct',
            participant: {
              id: 'user1',
              username: 'testuser1',
              name: 'Test User 1',
              isVerifiedProfessional: false
            },
            unreadCount: 2,
            lastMessage: {
              content: 'Hello there!',
              timestamp: new Date('2025-04-01T12:00:00.000Z'),
              senderId: 'user1',
              senderUsername: 'testuser1'
            },
            updatedAt: new Date('2025-04-01T12:00:00.000Z')
          },
          {
            id: 'conv2',
            type: 'direct',
            participant: {
              id: 'user2',
              username: 'testuser2',
              name: 'Test User 2',
              isVerifiedProfessional: true
            },
            unreadCount: 0,
            lastMessage: {
              content: 'How are you doing?',
              timestamp: new Date('2025-03-30T15:30:00.000Z'),
              senderId: 'user2',
              senderUsername: 'testuser2'
            },
            updatedAt: new Date('2025-03-30T15:30:00.000Z')
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockConversations)
          })
        );
  
        // Act
        const result = await chatApi.getConversations();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/chat/conversations',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockConversations);
      });
  
      it('handles errors when fetching conversations', async () => {
        // Arrange
        const errorMessage = 'Server error';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message in the API
        await expect(chatApi.getConversations()).rejects.toThrow(errorMessage);
      });
    });
  
    describe('getMessages', () => {
      it('returns array of messages for conversation', async () => {
        // Arrange
        const conversationId = 'conv1';
        const mockMessages: ChatMessage[] = [
          {
            _id: 'msg1',
            conversationId,
            senderId: {
              _id: 'user1',
              username: 'testuser1',
              profile: {
                name: 'Test User 1'
              }
            },
            content: 'Hello there!',
            contentType: 'text',
            readBy: [
              {
                userId: 'user1',
                readAt: new Date('2025-04-01T12:01:00.000Z')
              }
            ],
            createdAt: new Date('2025-04-01T12:00:00.000Z'),
            updatedAt: new Date('2025-04-01T12:00:00.000Z')
          },
          {
            _id: 'msg2',
            conversationId,
            senderId: {
              _id: 'user2',
              username: 'testuser2',
              profile: {
                name: 'Test User 2'
              }
            },
            content: 'Hi! How are you?',
            contentType: 'text',
            readBy: [],
            createdAt: new Date('2025-04-01T12:05:00.000Z'),
            updatedAt: new Date('2025-04-01T12:05:00.000Z')
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMessages)
          })
        );
  
        // Act
        const result = await chatApi.getMessages(conversationId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/chat/conversations/${conversationId}/messages`,
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockMessages);
      });
  
      it('accepts and applies query parameters', async () => {
        // Arrange
        const conversationId = 'conv1';
        const params = { before: 'msg10', limit: 20 };
        const mockMessages: ChatMessage[] = [];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMessages)
          })
        );
  
        // Act
        const result = await chatApi.getMessages(conversationId, params);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/chat/conversations/${conversationId}/messages?before=msg10&limit=20`,
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockMessages);
      });
  
      it('handles errors when fetching messages', async () => {
        // Arrange
        const conversationId = 'conv1';
        const errorMessage = 'Conversation not found';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message
        await expect(chatApi.getMessages(conversationId)).rejects.toThrow(errorMessage);
      });
    });
  
    describe('createConversation', () => {
      it('creates a new conversation with a participant', async () => {
        // Arrange
        const participantId = 'user3';
        const mockResponse = { _id: 'new-conv-123' };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await chatApi.createConversation(participantId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/chat/conversations',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId })
          }
        );
        expect(result).toEqual(mockResponse._id);
      });
  
      it('handles errors when creating conversation', async () => {
        // Arrange
        const participantId = 'invalid-user';
        const errorMessage = 'User not found';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message
        await expect(chatApi.createConversation(participantId)).rejects.toThrow(errorMessage);
      });
    });
  
    describe('sendMessage', () => {
      it('POSTs message and returns created message object', async () => {
        // Arrange
        const conversationId = 'conv1';
        const message: SendMessageInput = {
          content: 'Hello, this is a test message',
          contentType: 'text',
        };
        
        const mockResponse: ChatMessage = {
          _id: 'new-msg-123',
          conversationId,
          senderId: {
            _id: 'current-user',
            username: 'currentuser',
            profile: {
              name: 'Current User'
            }
          },
          content: message.content,
          contentType: 'text',
          readBy: [{
            userId: 'current-user',
            readAt: new Date('2025-04-02T10:00:00.000Z')
          }],
          createdAt: new Date('2025-04-02T10:00:00.000Z'),
          updatedAt: new Date('2025-04-02T10:00:00.000Z')
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await chatApi.sendMessage(conversationId, message);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/chat/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
          }
        );
        expect(result).toEqual(mockResponse);
      });
  
      it('handles errors when sending message', async () => {
        // Arrange
        const conversationId = 'conv1';
        const message: SendMessageInput = { content: 'Test message' };
        const errorMessage = 'Invalid message content';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message
        await expect(chatApi.sendMessage(conversationId, message)).rejects.toThrow(errorMessage);
      });
    });
  
    describe('markAsRead', () => {
      it('updates read status on server', async () => {
        // Arrange
        const conversationId = 'conv1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await chatApi.markAsRead(conversationId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/chat/conversations/${conversationId}/read`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when marking as read', async () => {
        // Arrange
        const conversationId = 'invalid-conv';
        const errorMessage = 'Conversation not found';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message
        await expect(chatApi.markAsRead(conversationId)).rejects.toThrow(errorMessage);
      });
    });
  
    describe('deleteMessage', () => {
      it('deletes a specific message', async () => {
        // Arrange
        const messageId = 'msg1';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await chatApi.deleteMessage(messageId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/chat/messages/${messageId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when deleting message', async () => {
        // Arrange
        const messageId = 'invalid-msg';
        const errorMessage = 'Message not found';
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert - Match the actual error message
        await expect(chatApi.deleteMessage(messageId)).rejects.toThrow(errorMessage);
      });
    });
  });