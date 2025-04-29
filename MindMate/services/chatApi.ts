// server/services/chatApi.ts
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

// Types for chat functionality
export interface ChatMessage {
    _id: string;
    conversationId: string;
    senderId: {
        _id: string;
        username: string;
        profile: {
            name: string;
        };
    };
    content: string;
    contentType: 'text' | 'image' | 'file' | 'system';
    metadata?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        dimensions?: {
            width: number;
            height: number;
        };
    };
    readBy: Array<{
        userId: string;
        readAt: Date;
    }>;
    replyTo?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatParticipant {
    id: string;
    username: string;
    name: string;
    isVerifiedProfessional: boolean;
}

export interface ChatPreview {
    id: string;
    type: 'direct' | 'group';
    participant: ChatParticipant | null;
    unreadCount: number;
    lastMessage: {
        content: string;
        timestamp: Date;
        senderId: string;
        senderUsername: string;
    } | null;
    updatedAt: Date;
}

export interface SendMessageInput {
    content: string;
    contentType?: 'text' | 'image' | 'file' | 'system';
    replyTo?: string;
    metadata?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        dimensions?: {
            width: number;
            height: number;
        };
    };
}

class ChatApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatApiError';
    }
}

const handleApiResponse = async (response: Response) => {
    const data = await response.json();
    if (!response.ok) {
        throw new ChatApiError(data.error || 'API request failed');
    }
    return data;
};

const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
        throw new ChatApiError('Authentication required');
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

export const chatApi = {
    async getConversations(): Promise<ChatPreview[]> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/chat/conversations`, { headers });
            const data = await handleApiResponse(response);

            // Transform dates
            return data.map((conv: any) => ({
                ...conv,
                lastMessage: conv.lastMessage ? {
                    ...conv.lastMessage,
                    timestamp: new Date(conv.lastMessage.timestamp)
                } : null,
                updatedAt: new Date(conv.updatedAt)
            }));
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to fetch conversations'
            );
        }
    },

    async getMessages(conversationId: string, params?: { before?: string; limit?: number }): Promise<ChatMessage[]> {
        try {
            const headers = await getAuthHeaders();
            const queryParams = new URLSearchParams();
            if (params?.before) queryParams.append('before', params.before);
            if (params?.limit) queryParams.append('limit', params.limit.toString());

            const url = `${API_URL}/chat/conversations/${conversationId}/messages${
                queryParams.toString() ? `?${queryParams.toString()}` : ''
            }`;

            const response = await fetch(url, { headers });
            const data = await handleApiResponse(response);

            // Transform dates
            return data.map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
                updatedAt: new Date(msg.updatedAt),
                readBy: msg.readBy.map((read: any) => ({
                    ...read,
                    readAt: new Date(read.readAt)
                }))
            }));
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to fetch messages'
            );
        }
    },

    async createConversation(participantId: string): Promise<string> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/chat/conversations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ participantId })
            });
            const data = await handleApiResponse(response);
            return data._id;
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to create conversation'
            );
        }
    },

    async sendMessage(conversationId: string, message: SendMessageInput): Promise<ChatMessage> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `${API_URL}/chat/conversations/${conversationId}/messages`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(message)
                }
            );
            const data = await handleApiResponse(response);

            // Transform dates
            return {
                ...data,
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
                readBy: data.readBy.map((read: any) => ({
                    ...read,
                    readAt: new Date(read.readAt)
                }))
            };
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to send message'
            );
        }
    },

    async markAsRead(conversationId: string): Promise<void> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `${API_URL}/chat/conversations/${conversationId}/read`,
                {
                    method: 'POST',
                    headers
                }
            );
            await handleApiResponse(response);
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to mark messages as read'
            );
        }
    },

    async deleteMessage(messageId: string): Promise<void> {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/chat/messages/${messageId}`, {
                method: 'DELETE',
                headers
            });
            await handleApiResponse(response);
        } catch (error) {
            throw new ChatApiError(
                error instanceof Error ? error.message : 'Failed to delete message'
            );
        }
    }
};