// tests/setup.ts
import '@testing-library/jest-native/extend-expect';

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
    View: ({ children, style }) => ({ children, style }),
    Text: ({ children, style }) => ({ children, style }),
  }));

  // Mock SecureStore
  jest.mock('expo-secure-store', () => mockSecureStore);
  
  // Mock fetch
  global.fetch = jest.fn();
  
  // Mock expo-router
  jest.mock('expo-router', () => ({
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn()
    },
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn()
    }),
    useLocalSearchParams: jest.fn(() => ({})),
    Link: ({ href, children }) => ({ href, children }),
    Stack: {
      Screen: (props) => props,
    },
    Tabs: (props) => props,
  }));
  
  // Mock ActivityIndicator and other RN components
  jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
      ...RN,
      ActivityIndicator: 'ActivityIndicator',
      Alert: {
        ...RN.Alert,
        alert: jest.fn(),
      },
      Switch: 'Switch',
      Pressable: ({ onPress, style, children }) => ({
        onPress,
        style,
        children,
      }),
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