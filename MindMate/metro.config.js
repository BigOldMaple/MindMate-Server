const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add svg to the sourceExts
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Make sure 'svg' is not duplicated in assetExts
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');

// Set SVG transformer
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

module.exports = config;