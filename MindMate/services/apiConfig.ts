// services/apiConfig.ts

interface ApiConfig {
  baseUrl: string;
  wsUrl: string;
}

const isBrowser = typeof window !== 'undefined';
const isNode = !isBrowser && typeof process !== 'undefined';

// You can set this constant manually or it will be fetched from the server
// This will be automatically updated when the server starts with ngrok
const NGROK_URL: string | null = 'https://ca62-139-222-245-184.ngrok-free.app';

// Function to fetch ngrok URL from server config endpoint
const fetchNgrokUrl = async (): Promise<{ url: string; wsUrl: string } | null> => {
  try {
    console.log('Attempting to fetch ngrok URL from server');
    
    // We need a base URL to fetch from - try multiple options
    const developmentConfig = getDevelopmentApiConfig();
    console.log('Trying base URL:', developmentConfig.baseUrl);
    
    // Try to get from multiple potential endpoints to increase chances of success
    const endpoints = [
      `${developmentConfig.baseUrl}/config/ngrok-url`,
      'http://localhost:3000/api/config/ngrok-url',
      'http://10.0.2.2:3000/api/config/ngrok-url'
    ];
    
    let response = null;
    let workingEndpoint = '';
    
    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log('Trying endpoint:', endpoint);
        // Use AbortController to implement timeout without using the unsupported timeout option
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        response = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          workingEndpoint = endpoint;
          break;
        }
      } catch (error) {
        // Handle the error with proper type checking
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`Endpoint ${endpoint} failed:`, errorMessage);
      }
    }
    
    if (!response || !response.ok) {
      console.warn('Failed to fetch ngrok URL from any endpoint');
      return null;
    }
    
    console.log(`Successfully connected to ${workingEndpoint}`);
    const data = await response.json();
    console.log('Received ngrok data:', data);
    
    return {
      url: data.httpUrl,
      wsUrl: data.wsUrl
    };
  } catch (error) {
    // Handle the error with proper type checking
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Error fetching ngrok URL:', errorMessage);
    return null;
  }
};

const getDevelopmentApiConfig = (): ApiConfig => {
  // If running in Node.js (server environment)
  if (isNode) {
    return {
      baseUrl: 'http://localhost:3000/api',
      wsUrl: 'ws://localhost:3000/ws'
    };
  }
  
  // Default for iOS, web, and other environments
  return {
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000/ws'
  };
};

const getProductionApiConfig = (): ApiConfig => {
  // First check if we have a hardcoded NGROK_URL
  if (NGROK_URL) {
    // Create a typed variable to help TypeScript understand this is definitely a string
    const ngrokUrlString: string = NGROK_URL;
    
    return {
      baseUrl: `${ngrokUrlString}/api`,
      wsUrl: `${ngrokUrlString.replace('https://', 'wss://').replace('http://', 'ws://')}/ws`
    };
  }

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

// Cache for ngrok URL
let ngrokConfig: ApiConfig | null = null;

// Async function to try fetching ngrok URL
export const initApiConfig = async (): Promise<void> => {
  try {
    // Only in development mode
    const isDev = isNode ? process.env.NODE_ENV !== 'production' : __DEV__;
    if (!isDev) return;
    
    const ngrokInfo = await fetchNgrokUrl();
    if (ngrokInfo) {
      ngrokConfig = {
        baseUrl: `${ngrokInfo.url}/api`,
        wsUrl: ngrokInfo.wsUrl
      };
      console.log('Using ngrok URL:', ngrokConfig);
    }
  } catch (error) {
    console.warn('Error initializing API config:', error);
  }
};

export const getApiConfig = (): ApiConfig => {
  // If we've fetched ngrok URL successfully, use that
  if (ngrokConfig) {
    console.log('Using ngrok configuration');
    return ngrokConfig;
  }
  
  // If NGROK_URL is manually specified, use that
  if (NGROK_URL) {
    console.log('Using manually specified ngrok URL');
    const ngrokUrlString: string = NGROK_URL;
    
    return {
      baseUrl: `${ngrokUrlString}/api`,
      wsUrl: `${ngrokUrlString.replace('https://', 'wss://').replace('http://', 'ws://')}/ws`
    };
  }
  
  // Otherwise use regular config
  const isDev = isNode ? process.env.NODE_ENV !== 'production' : __DEV__;
  return isDev ? getDevelopmentApiConfig() : getProductionApiConfig();
};

// Maintain backwards compatibility with old getApiUrl function
export const getApiUrl = (): string => {
  const config = getApiConfig();
  return config.baseUrl;
};