import { loginusAdapter } from './loginus.js';
import { keycloakAdapter } from './keycloak.js';
import type { AuthAdapter } from './types.js';

export type { AuthAdapter, NormalizedUser } from './types.js';
export { AuthProviderError } from './types.js';

const PROVIDER = (process.env.AUTH_PROVIDER || 'loginus').toLowerCase();

export const authAdapter: AuthAdapter =
  PROVIDER === 'keycloak' ? keycloakAdapter : loginusAdapter;
