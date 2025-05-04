// __mocks__/components/Themed.js
const React = require('react');
const { View: RNView, Text: RNText } = require('react-native');

const View = (props) => {
  return React.createElement(RNView, props, props.children);
};

const Text = (props) => {
  return React.createElement(RNText, props, props.children);
};

module.exports = {
  View,
  Text,
};