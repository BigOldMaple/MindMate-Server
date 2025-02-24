import NetInfo, { 
  NetInfoState, 
  NetInfoSubscription
} from '@react-native-community/netinfo';
import { EventEmitter } from '../utils/EventEmitter';

export type NetworkEventType = 'connected' | 'disconnected' | 'offline' | 'online' | 'statusChange';
type NetworkHandler = (state?: NetInfoState) => void;

class NetworkService extends EventEmitter {
  private static instance: NetworkService;
  private unsubscribe: NetInfoSubscription | null = null;
  private isConnected: boolean = true;
  private currentState: NetInfoState | null = null;
  private eventHandlers: Map<NetworkEventType, Set<NetworkHandler>> = new Map();
  private reconnectionAttempts: number = 0;
  private maxReconnectionAttempts: number = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private baseReconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;

  private constructor() {
    super();
    this.setupNetworkMonitoring();
  }

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  private setupNetworkMonitoring() {
    this.checkInitialConnectivity();
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
  }

  private async checkInitialConnectivity() {
    try {
      const state = await NetInfo.fetch();
      this.handleNetworkChange(state);
    } catch (error) {
      console.error('Error checking initial connectivity:', error);
      this.isConnected = false;
      this.attemptReconnection();
    }
  }

  private attemptReconnection = async () => {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectionAttempts),
      this.maxReconnectDelay
    );

    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectionAttempts + 1})`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectionAttempts++;
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          this.handleNetworkChange(state);
        } else {
          this.attemptReconnection();
        }
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        this.attemptReconnection();
      }
    }, delay);
  };

  private handleNetworkChange = (state: NetInfoState) => {
    const previousState = this.currentState;
    this.currentState = state;
    const wasConnected = this.isConnected;
    this.isConnected = state.isConnected ?? false;

    this.emit('statusChange', state);

    if (wasConnected !== this.isConnected) {
      if (this.isConnected) {
        this.handleNetworkRecovery(state);
      } else {
        this.handleNetworkLoss(state);
      }
    }

    if (previousState?.type !== state.type) {
      this.handleNetworkTypeChange(previousState?.type, state.type);
    }
  };

  private handleNetworkRecovery(state: NetInfoState) {
    console.log('Network recovered:', state.type);
    this.reconnectionAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.emit('connected', state);
    this.emit('online', state);
  }

  private handleNetworkLoss(state: NetInfoState) {
    console.log('Network lost:', state.type);
    this.emit('disconnected', state);
    this.emit('offline', state);
    this.attemptReconnection();
  }

  private handleNetworkTypeChange(oldType: string | undefined, newType: string) {
    console.log(`Network type changed from ${oldType} to ${newType}`);
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking connectivity:', error);
      return false;
    }
  }

  async getNetworkState(): Promise<NetInfoState | null> {
    try {
      return await NetInfo.fetch();
    } catch (error) {
      console.error('Error getting network state:', error);
      return null;
    }
  }

  isNetworkConnected(): boolean {
    return this.isConnected;
  }

  getCurrentState(): NetInfoState | null {
    return this.currentState;
  }

  async isWifiEnabled(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.type === 'wifi' && state.isConnected === true;
  }

  async isCellularEnabled(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.type === 'cellular' && state.isConnected === true;
  }

  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.eventHandlers.clear();
    this.removeAllListeners();
  }
}

export const networkService = NetworkService.getInstance();