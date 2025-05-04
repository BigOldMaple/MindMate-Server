// __mocks__/react-native.js
const React = require('react');

// Create mock components
const createMockComponent = (name) => {
  const component = React.forwardRef((props, ref) => {
    return React.createElement(name, {...props, ref});
  });
  component.displayName = name;
  return component;
};

// Mock the basic RN components
const View = createMockComponent('View');
const Text = createMockComponent('Text');
const TextInput = createMockComponent('TextInput');
const ScrollView = createMockComponent('ScrollView');
const TouchableOpacity = createMockComponent('TouchableOpacity');
const Pressable = createMockComponent('Pressable');
const KeyboardAvoidingView = createMockComponent('KeyboardAvoidingView');
const ActivityIndicator = createMockComponent('ActivityIndicator');

module.exports = {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(styles => styles),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(options => options.ios || options.default),
  },
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1
    })),
  },
  Animated: {
    View,
    Text,
    createAnimatedComponent: jest.fn(component => component),
    timing: jest.fn(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
    })),
    spring: jest.fn(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
    })),
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => ({
        __getValue: jest.fn(() => 0),
      })),
      __getValue: jest.fn(() => 0),
    })),
  },
};