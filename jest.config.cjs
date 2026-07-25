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
    // workerFactory.ts uses import.meta.url (ESM-only); swap for a jest.fn() mock
    // so RunnerProvider can be imported in jsdom tests.
    '^\\./(workerFactory)$': '<rootDir>/tests/unit/__mocks__/workerFactory.ts',
    // deploymentProfile.ts reads import.meta.env; same treatment as apiBase.
    '^.*/state/deploymentProfile$': '<rootDir>/tests/unit/__mocks__/deploymentProfile.ts',
    // assets.ts uses import.meta.glob (Vite-only); swap for a stub.
    '^.*/state/assets$': '<rootDir>/tests/unit/__mocks__/assets.ts',
    // storage.ts uses indexedDB (browser-only); swap for a stub.
    '^.*/utils/storage$': '<rootDir>/tests/unit/__mocks__/storage.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(konva|react-konva|@testing-library|remark-math|rehype-katex|katex|hast-util-to-html|hast-util-sanitize|micromark-extension-math|mdast-util-math)/)',
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
  // Ratchet floors seeded at real measured actuals, not aspirational.
  // Rule: these only move UP. Bump the relevant slot in the same PR that adds a
  // tier's tests. Path-specific keys are checked independently and subtracted
  // from the global pool, so each area regresses (and gates) on its own.
  // Global floors recalibrated after compete-mode + DBG tools on main.
  coverageThreshold: {
    global: {
      branches: 17,
      functions: 19,
      lines: 27,
      statements: 27,
    },
    // Bumped after the live-code / live-session tier (useLiveSession 100%,
    // usePresencePinger content+session paths), then the join-link tier
    // (pendingSession, usePresencePinger leave/clear), then the live-panel tier
    // (peer tabs in useLiveSession, useSessionAutoJoin 100%).
    './src/state/': {
      branches: 52,
      functions: 52,
      lines: 58,
      statements: 57,
    },
    './src/utils/': {
      branches: 50,
      functions: 65,
      lines: 70,
      statements: 70,
    },
    // Bumped after the live-code runner tier (RunnerProvider message-handler
    // branches: result.keepCanvas, start/canvas_resize/input_request, error +
    // runtime_error channels, sound routing, store actions).
    './src/runner/': {
      branches: 35,
      functions: 31,
      lines: 38,
      statements: 37,
    },
  },
};

module.exports = config;
