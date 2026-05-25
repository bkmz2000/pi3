// Vite's `import.meta.env` access is isolated here so the rest of `api.ts`
// stays free of bundler-specific syntax — tests mock this module via
// `moduleNameMapper` in jest.config.cjs.
export const API_BASE: string = import.meta?.env?.VITE_API_URL || '';
