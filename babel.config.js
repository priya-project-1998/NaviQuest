module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@services': './src/services',
          '@screens': './src/screens',
          '@components': './src/components',
          '@model': './src/model',      // agar tu model folder bhi use karega
        },
      },
    ],
    'react-native-reanimated/plugin', // <- keep this last
  ],
};
