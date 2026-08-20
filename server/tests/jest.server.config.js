/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Cap worker count to bound memory (see jest.config.cjs for rationale).
  maxWorkers: 4,
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
  // Re-seeded after the fable-audit fix pass (live-presence hardening,
  // rate-limit buckets on comments/shares/teacher-problem writes, SKIP_AUTH
  // prod gate, session-token-header tests) — floors had drifted well below
  // actuals.
  coverageThreshold: {
    global: {
      branches: 63,
      functions: 80,
      lines: 73,
      statements: 71,
    },
  },
  coverageDirectory: 'coverage/server',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
