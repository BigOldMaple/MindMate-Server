const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    assetExts: [
      ...defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
      'db',
      'mp3',
      'wav',
      'ttf',
      'obj',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
    ],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg', 'mjs', 'cjs'],
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['ios', 'android', 'web'],
    // Remove blockList configuration
    extraNodeModules: new Proxy(
      {},
      {
        get: (target, name) => path.resolve(__dirname, `node_modules/${name}`),
      }
    ),
  },
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  watchFolders: [path.resolve(__dirname)],
  maxWorkers: 2
};