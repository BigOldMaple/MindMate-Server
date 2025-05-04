// __mocks__/react-native.js
const React = require('react');

// Create a function to create simple component mocks
const createComponentMock = (name) => {
  const Component = ({ children, ...props }) => {
    return React.createElement(name, props, children);
  };
  Component.displayName = name;
  return Component;
};

// Mock the required React Native components
const View = createComponentMock('View');
const Text = createComponentMock('Text');
const TextInput = createComponentMock('TextInput');
const Pressable = createComponentMock('Pressable');
const TouchableOpacity = createComponentMock('TouchableOpacity');
const KeyboardAvoidingView = createComponentMock('KeyboardAvoidingView');
const ActivityIndicator = createComponentMock('ActivityIndicator');
const ScrollView = createComponentMock('ScrollView');
const Alert = { alert: jest.fn() };
const Platform = { OS: 'ios', select: jest.fn((obj) => obj.ios || obj.default) };

// Export all mocked components and APIs
module.exports = {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
  StyleSheet: {
    create: (styles) => styles,
    flatten: jest.fn((styles) => styles),
  },
  Alert,
  Platform,
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => ({})),
    })),
    View,
    Text,
    createAnimatedComponent: jest.fn(component => component),
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
  },
};