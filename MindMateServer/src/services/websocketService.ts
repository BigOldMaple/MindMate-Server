import { networkService } from './networkService';
import { getApiConfig } from './apiConfig';
import * as SecureStore from 'expo-secure-store';
import { EventEmitter } from '../utils/EventEmitter';
import WebSocket from 'ws';

type MessageHandler = (data: any) => void;

class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private isConnected = false;
  private isConnecting = false;
  private pingTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<MessageHandler>> = new Map();

  private constructor() {
    super();
    this.setupNetworkListeners();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private setupNetworkListeners() {
    networkService.on('connected', () => {
      console.log('Network connected - attempting WebSocket reconnection');
      this.reconnectAttempts = 0;
      this.connect();
    });

    networkService.on('disconnected', () => {
      console.log('Network disconnected - closing WebSocket');
      this.cleanupConnection();
    });
  }

  private handleConnectionError = async () => {
    this.isConnected = false;
    this.isConnecting = false;
    await this.attemptReconnect();
  };

  private handleConnectionClose = async () => {
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    await this.attemptReconnect();
  };

  private startHeartbeat = () => {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
        
        if (this.pingTimeout) {
          clearTimeout(this.pingTimeout);
        }
        
        this.pingTimeout = setTimeout(() => {
          console.log('Ping timeout - no pong received');
          this.handleConnectionError();
        }, 5000);
      }
    }, 30000) as unknown as number;
  };

  private stopHeartbeat = () => {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  };

  private handleMessage = (event: WebSocketMessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'pong':
          this.handlePong();
          break;
        case 'message':
          this.emit('newMessage', message.payload);
          break;
        case 'typing':
          this.emit('userTyping', message.payload);
          break;
        case 'read':
          this.emit('messageRead', message.payload);
          break;
        default:
          this.emit(message.type, message.payload);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  private handlePong = () => {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  };

  private async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.send(JSON.parse(message));
      }
    }
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.processMessageQueue();
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.handleConnectionClose();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleConnectionError();
    };

    this.ws.onmessage = this.handleMessage;
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }
  
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
  
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
  
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  
    this.reconnectTimeout = setTimeout(async () => {
      const isNetworkAvailable = await networkService.checkConnectivity();
      if (isNetworkAvailable) {
        this.reconnectAttempts++;
        await this.connect();
      } else {
        console.log('Network unavailable, waiting for network recovery');
      }
    }, delay);
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const { wsUrl } = getApiConfig();
      const url = `${wsUrl}?token=${token}`;

      this.ws = new WebSocket(url);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    }
  }

  async send(data: any): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(JSON.stringify(data));
      return;
    }

    try {
      this.ws?.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageQueue.push(JSON.stringify(data));
      await this.handleConnectionError();
    }
  }

  private async cleanupConnection() {
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.close(1000, 'Normal closure');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  // Added methods to fix TypeScript errors
  async sendMessage(conversationId: string, content: string): Promise<void> {
    const message = {
      type: 'message',
      payload: {
        conversationId,
        content,
      },
    };
    await this.send(message);
  }

  async sendTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
    const message = {
      type: 'typing',
      payload: {
        conversationId,
        isTyping,
      },
    };
    await this.send(message);
  }

  async markMessagesAsRead(conversationId: string, messageIds: string[]): Promise<void> {
    const message = {
      type: 'read',
      payload: {
        conversationId,
        messageIds,
      },
    };
    await this.send(message);
  }

  // Public event handling methods
  onNewMessage(handler: MessageHandler): void {
    this.addHandler('newMessage', handler);
  }

  onUserTyping(handler: MessageHandler): void {
    this.addHandler('userTyping', handler);
  }

  onMessageRead(handler: MessageHandler): void {
    this.addHandler('messageRead', handler);
  }

  onConnect(handler: MessageHandler): void {
    this.addHandler('connected', handler);
  }

  onDisconnect(handler: MessageHandler): void {
    this.addHandler('disconnected', handler);
  }

  onError(handler: MessageHandler): void {
    this.addHandler('error', handler);
  }

  private addHandler(event: string, handler: MessageHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  removeHandler(event: string, handler: MessageHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  override emit(event: string, data?: any): boolean {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
    return true;
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  cleanup() {
    this.cleanupConnection();
    networkService.cleanup();
    this.removeAllListeners();
  }
}

export const websocketService = WebSocketService.getInstance();