// integration-tests/jest.config.js
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testTimeout: 30000,
    testMatch: ["**/integration-tests/**/*.test.ts"],
    moduleNameMapper: {
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
    // Force Jest to exit after tests complete
    forceExit: true,
    // Increase default timeout for async operations
    testTimeout: 30000,
  };