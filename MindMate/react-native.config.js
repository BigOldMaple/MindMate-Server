// react-native.config.js
module.exports = {
  // This configuration tells React Native to let Expo handle these modules
  // The null configuration means "use the default Expo configuration"
  dependencies: {
    // Let Expo handle all Expo modules
    'expo-modules-core': {
      platforms: {
        android: null,
        ios: null,
      },
    }
  },
};