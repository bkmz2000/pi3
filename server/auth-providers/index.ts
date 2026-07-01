import { loginusAdapter } from './loginus.js';
import type { AuthAdapter } from './types.js';

export type { AuthAdapter, NormalizedUser } from './types.js';
export { AuthProviderError } from './types.js';

export const authAdapter: AuthAdapter = loginusAdapter;
