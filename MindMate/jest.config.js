module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
      'node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|expo(nent)?|@expo|expo-router|@unimodules|unimodules|@sentry/react-native|native-base|react-native-svg|@testing-library)'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    moduleNameMapper: {
      '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '^@/(.*)$': '<rootDir>/$1'
    },
    testMatch: [
      '**/__tests__/**/*.test.[jt]s?(x)',
      '<rootDir>/tests/**/*.test.[jt]s?(x)'
    ],
    testPathIgnorePatterns: [
      '/node_modules/',
      '/android/',
      '/ios/'
    ],
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
    },
    collectCoverage: true,
    collectCoverageFrom: [
      'services/**/*.{ts,tsx}',
     // 'components/**/*.{ts,tsx}',
      'app/**/*.{ts,tsx}',
      '!**/__tests__/**'
    ],
    coverageReporters: ['json', 'lcov', 'text', 'clover'],
    testEnvironment: 'node'
  };