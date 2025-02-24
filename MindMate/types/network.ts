// types/network.ts
import { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkServiceEvents {
  connected: (state: NetInfoState) => void;
  disconnected: (state: NetInfoState) => void;
  offline: (state: NetInfoState) => void;
  online: (state: NetInfoState) => void;
  statusChange: (state: NetInfoState) => void;
}

export interface NetworkServiceInterface {
  checkConnectivity(): Promise<boolean>;
  getNetworkState(): Promise<NetInfoState | null>;
  isNetworkConnected(): boolean;
  getCurrentState(): NetInfoState | null;
  isWifiEnabled(): Promise<boolean>;
  isCellularEnabled(): Promise<boolean>;
  on<K extends keyof NetworkServiceEvents>(event: K, listener: NetworkServiceEvents[K]): void;
  off<K extends keyof NetworkServiceEvents>(event: K, listener: NetworkServiceEvents[K]): void;
  cleanup(): void;
}