// jest.config.js
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|expo(nent)?|@expo|expo-router|@unimodules|unimodules|@sentry/react-native|native-base|react-native-svg|@testing-library)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/__mocks__/fileMock.js",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^@/(.*)$": "<rootDir>/$1",
    "^@/app/(.*)$": "<rootDir>/app/$1",
    "@expo/vector-icons/FontAwesome": "<rootDir>/__mocks__/@expo/vector-icons/FontAwesome.js",
    "@expo/vector-icons": "<rootDir>/__mocks__/@expo/vector-icons/index.js",
    "@/components/Themed": "<rootDir>/__mocks__/components/Themed.js",
    "@/contexts/AuthContext": "<rootDir>/__mocks__/contexts/AuthContext.js",
    "@/services/auth": "<rootDir>/__mocks__/services/auth.js",
    "expo-router": "<rootDir>/__mocks__/expo-router.js",
    // Add direct mapping for react-native
    "^react-native$": "<rootDir>/__mocks__/react-native.js"
  },
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  collectCoverage: true,
  collectCoverageFrom: [
    "services/**/*.{ts,tsx}",
    "!**/__tests__/**",
  ],
  coverageReporters: ["json", "lcov", "text", "clover"],
  testEnvironment: "jsdom",
};