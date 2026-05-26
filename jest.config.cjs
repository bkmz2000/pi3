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
    // api.ts reads import.meta.env via apiBase.ts; ts-jest can't transform
    // import.meta, so swap it for a plain-string mock in tests.
    '^\\./apiBase$': '<rootDir>/tests/unit/__mocks__/apiBase.ts',
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
    // Declarative content (API reference, recipe data) pinned by
    // tests/unit/graphicsDocs.test.ts. Counting it as covered code makes the
    // denominator grow every time docs do, sinking line % without any real
    // test regression.
    '!src/docs/**',
  ],
  // Ratchet floors seeded at real measured actuals (2026-05-20), not aspirational.
  // Rule: these only move UP. Bump the relevant slot in the same PR that adds a
  // tier's tests. Path-specific keys are checked independently and subtracted
  // from the global pool, so each area regresses (and gates) on its own.
  coverageThreshold: {
    global: {
      branches: 11,
      functions: 10,
      lines: 16,
      statements: 14,
    },
    './src/state/': {
      branches: 39,
      functions: 37,
      lines: 36,
      statements: 35,
    },
    './src/runner/': {
      branches: 23,
      functions: 3,
      lines: 23,
      statements: 22,
    },
  },
};

module.exports = config;
