// __mocks__/react-native.js
const React = require('react');

// Basic string-based native components
const View = 'View';
const Text = 'Text';
const TextInput = 'TextInput';
const Pressable = 'Pressable';

// Export basic components
module.exports = {
  View, 
  Text,
  TextInput,
  Pressable,
  Alert: { alert: jest.fn() },
  StyleSheet: { create: styles => styles }
};