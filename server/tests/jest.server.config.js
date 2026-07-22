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
  // Ratchet floor seeded at real measured actuals. Server is the
  // strongest-covered layer; this stops it silently regressing. Only moves UP.
  // Nudged after the live-code endpoints tier (live.ts ~95%).
  coverageThreshold: {
    global: {
      branches: 46,
      functions: 70,
      lines: 62,
      statements: 62,
    },
  },
  coverageDirectory: 'coverage/server',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
