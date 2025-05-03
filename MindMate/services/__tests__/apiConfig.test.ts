// services/__tests__/apiConfig.test.ts

// Mock external dependencies that the apiConfig module uses
jest.mock('react-native', () => ({
    Platform: {
      OS: 'ios'
    }
  }));
  
  jest.mock('expo-constants', () => ({
    expoConfig: {
      extra: {
        apiUrl: 'https://mocked-production-api.com/api',
        wsUrl: 'wss://mocked-production-api.com/ws'
      }
    }
  }));
  
  // Mock global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        httpUrl: 'https://test-ngrok.io', 
        wsUrl: 'wss://test-ngrok.io' 
      })
    })
  ) as jest.Mock;
  
  // Mock console.warn for error testing
  const originalConsoleWarn = console.warn;
  console.warn = jest.fn();
  
  // Create a mock for global.__DEV__
  Object.defineProperty(global, '__DEV__', {
    get: jest.fn(() => true),
    configurable: true
  });
  
  // Import the module AFTER setting up all mocks
  import * as apiConfigModule from '../apiConfig';
  
  // Create a convenience alias to prevent typing issues
  const { getApiConfig, initApiConfig } = apiConfigModule;
  
  describe('API Config Service', () => {
    // Save original fetch implementation
    const originalFetch = global.fetch;
    
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Reset fetch mock
      global.fetch = jest.fn(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            httpUrl: 'https://test-ngrok.io', 
            wsUrl: 'wss://test-ngrok.io' 
          })
        })
      ) as jest.Mock;
    });
    
    afterAll(() => {
      // Restore original globals
      global.fetch = originalFetch;
      console.warn = originalConsoleWarn;
    });
  
    describe('getApiConfig', () => {
      it('correctly formats URLs when NGROK_URL constant is defined', async () => {
        // Setup - ensure we're in dev mode
        Object.defineProperty(global, '__DEV__', {
          get: jest.fn(() => true),
          configurable: true
        });
        
        // Call initApiConfig to set ngrokConfig
        await initApiConfig();
        
        // Act
        const config = getApiConfig();
        
        // Assert
        expect(config.baseUrl).toBe('https://test-ngrok.io/api');
        expect(config.wsUrl).toBe('wss://test-ngrok.io');
      });
    });
  
    describe('initApiConfig', () => {
      it('sets ngrokConfig with correct URLs when fetch succeeds', async () => {
        // Setup - ensure we're in dev mode
        Object.defineProperty(global, '__DEV__', {
          get: jest.fn(() => true),
          configurable: true
        });
        
        // Act
        await initApiConfig();
        
        // Now check if the config is updated
        const config = getApiConfig();
        
        // Assert
        expect(config.baseUrl).toBe('https://test-ngrok.io/api');
        expect(config.wsUrl).toBe('wss://test-ngrok.io');
      });
  
      it('handles network errors during initialization', async () => {
        // Setup - mock fetch to reject
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        
        // Ensure we're in dev mode
        Object.defineProperty(global, '__DEV__', {
          get: jest.fn(() => true),
          configurable: true
        });
        
        // Act - should not throw
        await expect(initApiConfig()).resolves.not.toThrow();
        
        // Assert - should have logged a warning
        expect(console.warn).toHaveBeenCalled();
      });
    });
  });