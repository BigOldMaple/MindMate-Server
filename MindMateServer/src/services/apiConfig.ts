// services/apiConfig.ts

interface ApiConfig {
  baseUrl: string;
  wsUrl: string;
}

const isBrowser = typeof window !== 'undefined';
const isNode = !isBrowser && typeof process !== 'undefined';

const getDevelopmentApiConfig = (): ApiConfig => {
  // If running in Node.js (server environment)
  if (isNode) {
    return {
      baseUrl: 'http://localhost:3000/api',
      wsUrl: 'ws://localhost:3000/ws'
    };
  }

  // For React Native environments
  try {
    const Platform = require('react-native').Platform;
    // Android emulator needs special localhost handling
    if (Platform.OS === 'android') {
      return {
        baseUrl: 'http://10.0.2.2:3000/api',
        wsUrl: 'ws://10.0.2.2:3000/ws'
      };
    }
  } catch (e) {
    // If react-native import fails, assume we're in a web environment
  }
  
  // Default for iOS, web, and other environments
  return {
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000/ws'
  };
};

const getProductionApiConfig = (): ApiConfig => {
  const defaultConfig = {
    baseUrl: 'https://api.mindmate.com/api',
    wsUrl: 'wss://api.mindmate.com/ws'
  };

  // Only try to access Constants if we're in a React Native environment
  if (!isNode) {
    try {
      const Constants = require('expo-constants');
      return {
        baseUrl: Constants.expoConfig?.extra?.apiUrl || defaultConfig.baseUrl,
        wsUrl: Constants.expoConfig?.extra?.wsUrl || defaultConfig.wsUrl
      };
    } catch (e) {
      // If Constants import fails, return default config
    }
  }

  return defaultConfig;
};

export const getApiConfig = (): ApiConfig => {
  // Check if we're in development mode
  const isDev = isNode ? process.env.NODE_ENV !== 'production' : __DEV__;
  return isDev ? getDevelopmentApiConfig() : getProductionApiConfig();
};

// Maintain backwards compatibility with old getApiUrl function
export const getApiUrl = (): string => {
  const config = getApiConfig();
  return config.baseUrl;
};