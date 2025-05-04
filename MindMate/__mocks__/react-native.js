// __mocks__/react-native.js - Simplified version
module.exports = {
    Alert: { alert: jest.fn() },
    Platform: { OS: 'ios', select: jest.fn(obj => obj.ios || obj.default) },
    StyleSheet: { create: styles => styles }
  };