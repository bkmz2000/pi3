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
  // Global left untouched during the fable-audit fix pass: repeated local runs
  // showed "All files" is flaky (~1-in-15 runs lands ~6-8pt below the typical
  // 33.58/23.67/27.16/35.18, at 27.14/18.48/20.73/27.92 — some large
  // lazy/dynamic-import file's coverage isn't always captured, root cause not
  // chased). The low outcome sits right at today's floor, so these numbers
  // were already conservatively seeded for it — bumping to the typical value
  // would make CI intermittently red. Re-seed only once the flake is fixed.
  coverageThreshold: {
    global: {
      branches: 18,
      functions: 20,
      lines: 27,
      statements: 27,
    },
    // Bumped after the live-code / live-session tier (useLiveSession 100%,
    // usePresencePinger content+session paths), then the join-link tier
    // (pendingSession, usePresencePinger leave/clear), then the live-panel tier
    // (peer tabs in useLiveSession, useSessionAutoJoin 100%).
    './src/state/': {
      branches: 52,
      functions: 53,
      lines: 58,
      statements: 57,
    },
    './src/utils/': {
      branches: 56,
      functions: 76,
      lines: 79,
      statements: 74,
    },
    // Bumped after the live-code runner tier (RunnerProvider message-handler
    // branches: result.keepCanvas, start/canvas_resize/input_request, error +
    // runtime_error channels, sound routing, store actions), then the
    // star-import hoist (hoistStarImports 100%), then the interrupt-detection
    // predicate (isInterruptError 100%).
    './src/runner/': {
      branches: 36,
      functions: 32,
      lines: 39,
      statements: 38,
    },
  },
};

module.exports = config;
