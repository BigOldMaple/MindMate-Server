// __mocks__/components/Themed.js
const React = require('react');
const { View: RNView, Text: RNText } = require('react-native');

// The View component
const View = React.forwardRef((props, ref) => {
  return React.createElement(RNView, {...props, ref});
});
View.displayName = 'ThemedView';

// The Text component
const Text = React.forwardRef((props, ref) => {
  return React.createElement(RNText, {...props, ref});
});
Text.displayName = 'ThemedText';

module.exports = {
  View,
  Text,
};