/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['<rootDir>/server/tests/server.setup.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.server.json',
      },
    ],
  },
  testMatch: ['**/server/tests/**/*.test.ts'],
  collectCoverageFrom: ['server/**/*.ts'],
  // Ratchet floor seeded at real measured actuals (2026-05-20). Server is the
  // strongest-covered layer; this stops it silently regressing. Only moves UP.
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 75,
      lines: 60,
      statements: 60,
    },
  },
  coverageDirectory: 'coverage/server',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
