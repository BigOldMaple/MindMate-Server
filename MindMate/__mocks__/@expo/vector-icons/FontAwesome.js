// __mocks__/@expo/vector-icons/FontAwesome.js
const React = require('react');

const FontAwesome = ({ name, size, color, style }) => {
  return React.createElement('FontAwesome', { name, size, color, style }, null);
};

FontAwesome.displayName = 'FontAwesome';

module.exports = FontAwesome;