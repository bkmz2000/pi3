/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\?.+$': '<rootDir>/tests/unit/__mocks__/rawTextMock.js',
    '^konva$': '<rootDir>/tests/unit/__mocks__/konva.cjs',
    '^react-konva$': '<rootDir>/tests/unit/__mocks__/react-konva.cjs',
    '^../state/useUser$': '<rootDir>/tests/unit/__mocks__/useUser.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(konva|react-konva|@testing-library)/)',
  ],
  testMatch: [
    '**/tests/unit/**/*.test.+(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
  ],
  // Ratchet floors seeded at real measured actuals (2026-05-20), not aspirational.
  // Rule: these only move UP. Bump the relevant slot in the same PR that adds a
  // tier's tests. Path-specific keys are checked independently and subtracted
  // from the global pool, so each area regresses (and gates) on its own.
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 6,
      statements: 6,
    },
    './src/state/': {
      branches: 5,
      functions: 0,
      lines: 1,
      statements: 2,
    },
    './src/runner/': {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

module.exports = config;
