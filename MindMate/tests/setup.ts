// tests/setup.ts - revised with better module mocks
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { StyleProp, ViewStyle, TextStyle, GestureResponderEvent } from 'react-native';

// Mock Expo module dependencies first (before any imports can use them)
jest.mock('expo-modules-core', () => ({
  EventEmitter: {
    setMaxListeners: jest.fn(),
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  NativeModulesProxy: {},
}), { virtual: true });

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({ downloadAsync: jest.fn() })),
    loadAsync: jest.fn(),
  },
}), { virtual: true });

jest.mock('expo', () => ({
  registerRootComponent: jest.fn(),
  AppState: { addEventListener: jest.fn() },
}), { virtual: true });

// Mock implementations
const mockSecureStore = {
  _store: {} as Record<string, string>,

  async setItemAsync(key: string, value: string): Promise<void> {
    this._store[key] = value;
  },

  async getItemAsync(key: string): Promise<string | null> {
    return this._store[key] || null;
  },

  async deleteItemAsync(key: string): Promise<void> {
    delete this._store[key];
  },

  _reset(): void {
    this._store = {};
  }
};

// Setup global mocks
beforeAll(() => {
  // Mock Expo vector icons
  jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');
  jest.mock('@expo/vector-icons', () => ({
    FontAwesome: 'FontAwesome',
  }));

  // Mock Themed components
  jest.mock('@/components/Themed', () => ({
    View: ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => 
      React.createElement('View', { style }, children),
    Text: ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => 
      React.createElement('Text', { style }, children),
  }));

  // Mock SecureStore
  jest.mock('expo-secure-store', () => mockSecureStore);
  
  // Mock fetch
  global.fetch = jest.fn();
  
  // Mock expo-router BEFORE it's imported by any tests
  jest.mock('expo-router', () => ({
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => 
      React.createElement('Link', { href }, children),
    Stack: {
      Screen: (props: Record<string, unknown>) => 
        React.createElement('Screen', props),
    },
    Tabs: (props: Record<string, unknown>) => 
      React.createElement('Tabs', props),
  }));
  
  // Mock ActivityIndicator and other RN components
  jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
      ...RN,
      ActivityIndicator: function MockActivityIndicator(props: any) { 
        return React.createElement('ActivityIndicator', props);
      },
      Alert: {
        ...RN.Alert,
        alert: jest.fn(),
      },
      Switch: function MockSwitch(props: any) { 
        return React.createElement('Switch', props);
      },
      Pressable: function MockPressable({ 
        onPress, 
        style, 
        children,
        disabled,
        testID,
      }: any) {
        return React.createElement(
          'Pressable', 
          { onPress, style, disabled, testID, props: { disabled } }, 
          children
        );
      },
    };
  });
  
  // Silence the warning: Animated: `useNativeDriver` is not supported
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
  
  console.log('Test environment setup complete');
});

// Clean up between tests
afterEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Reset SecureStore mock data
  mockSecureStore._reset();
  
  // Reset fetch mock
  (global.fetch as jest.Mock).mockReset();
});

// Clean up after all tests
afterAll(() => {
  // Any cleanup needed after all tests
  jest.restoreAllMocks();
});

// Export the mock implementations for use in tests
export { mockSecureStore };