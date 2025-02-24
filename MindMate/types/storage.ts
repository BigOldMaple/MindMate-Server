// types/storage.ts
export interface StorageItem {
    key: string;
    value: string;
    timestamp: number;
    temporary?: boolean;
    expiresAt?: number;
  }