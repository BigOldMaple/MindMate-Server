// integration-tests/jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 30000,
  testMatch: ["**/integration-tests/**/*.test.ts"],
  moduleNameMapper: {
    // Add module mappings if needed
    "^@/(.*)$": "<rootDir>/../MindMate/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
};
