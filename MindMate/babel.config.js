module.exports = function (api) {
  api.cache(true);
 
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'react-native-reanimated/plugin',
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': '.',
          '@components': './components',
          '@screens': './screens',
          '@utils': './utils',
          '@services': './services',
          '@assets': './assets',
        },
      }]
    ]
  };
};