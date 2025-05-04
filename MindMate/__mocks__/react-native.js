// __mocks__/react-native.js
module.exports = {
    // Mock the Alert API
    Alert: {
      alert: jest.fn(),
    },
    
    // Mock the Dimensions API
    Dimensions: {
      get: jest.fn(() => ({
        width: 390,
        height: 844,
        scale: 1,
        fontScale: 1
      })),
    },
    
    // Mock Platform
    Platform: {
      OS: 'ios',
      select: jest.fn(options => options.ios),
      Version: 14,
    },
    
    // Add other RN APIs you need to mock
    StyleSheet: {
      create: jest.fn(styles => styles),
      flatten: jest.fn(styles => styles),
    },
    
    // Add empty implementations for components
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    ScrollView: 'ScrollView',
    TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    
    // Don't try to spread the actual RN module
    UIManager: {
      measureInWindow: jest.fn((node, callback) => callback(0, 0, 100, 100)),
    },
  };