// Mock for src/utils/storage.ts — prevents IndexedDB access in jsdom tests.
// Methods are jest.fn() so tests can spy/assert without modifying this file.
export const projectStorage = {
  cacheProjectMeta:           jest.fn().mockResolvedValue(undefined),
  getCachedProjectMeta:       jest.fn().mockResolvedValue([]),
  cacheProjectContent:        jest.fn().mockResolvedValue(undefined),
  getCachedProjectContent:    jest.fn().mockResolvedValue(null),
  queueSave:                  jest.fn().mockResolvedValue(undefined),
  getQueuedSaves:             jest.fn().mockResolvedValue([]),
  removeQueuedSave:           jest.fn().mockResolvedValue(undefined),
  removeQueuedSavesForProject: jest.fn().mockResolvedValue(undefined),
  downloadProjectZip:         jest.fn().mockResolvedValue(undefined),
};

// jest.fn() so tests can control online/offline state per-test
export const isOnline = jest.fn().mockReturnValue(true);
export const onOnline = jest.fn().mockReturnValue(() => {});
export const triggerSync = jest.fn();
