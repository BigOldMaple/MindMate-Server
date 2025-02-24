// react-native.config.js
module.exports = {
    dependencies: {
      'expo-sensors': {
        platforms: {
          android: null, // Let expo-modules-core handle the configuration
        },
      },
      'expo-location': {
        platforms: {
          android: null,
        },
      },
      'expo-notifications': {
        platforms: {
          android: null,
        },
      },
      'expo-camera': {
        platforms: {
          android: null,
        },
      },
      'expo-secure-store': {
        platforms: {
          android: null,
        },
      },
      'expo-media-library': {
        platforms: {
          android: null,
        },
      },
      'expo-file-system': {
        platforms: {
          android: null,
        },
      },
    },
  };