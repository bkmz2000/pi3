import { AuthAdapter, AuthProviderError, NormalizedUser } from './types.js';

// KEYCLOAK_URL  — base URL of the Keycloak server, e.g. https://auth.example.com
// KEYCLOAK_REALM — realm name, e.g. "pi3"
// KEYCLOAK_CLIENT_ID / KEYCLOAK_CLIENT_SECRET
// KEYCLOAK_TEACHER_ROLE — role name that maps to 'teacher' (default: 'teacher')
function realmBase(): string {
  const url   = process.env.KEYCLOAK_URL   || '';
  const realm = process.env.KEYCLOAK_REALM || '';
  if (!url || !realm) throw new Error('KEYCLOAK_URL and KEYCLOAK_REALM must be set');
  return `${url}/realms/${realm}/protocol/openid-connect`;
}

function isTeacherRole(roles: string[], teacherRole: string): boolean {
  return roles.includes(teacherRole);
}

export const keycloakAdapter: AuthAdapter = {
  name: 'keycloak',
  get clientId()     { return process.env.KEYCLOAK_CLIENT_ID     || ''; },
  get clientSecret() { return process.env.KEYCLOAK_CLIENT_SECRET || ''; },
  get authorizationUrl() { return `${realmBase()}/auth`; },
  get tokenUrl()         { return `${realmBase()}/token`; },
  get userinfoUrl()      { return `${realmBase()}/userinfo`; },
  get endSessionUrl()    { return `${realmBase()}/logout`; },
  scopes: 'openid email profile roles',

  parseTokenResponse(raw: unknown) {
    // Keycloak returns standard OIDC — no envelope wrapper.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = typeof raw === 'object' && raw !== null ? (raw as any) : {};
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new AuthProviderError('token', 'Missing or invalid access_token');
    }
    return {
      access_token: payload.access_token,
      id_token: typeof payload.id_token === 'string' ? payload.id_token : undefined,
    };
  },

  parseUserinfo(raw: unknown, idTokenClaims?: Record<string, unknown>): NormalizedUser {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = typeof raw === 'object' && raw !== null ? (raw as any) : {};

    // Keycloak uses `sub` (not `id`) per the OIDC spec.
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AuthProviderError('userinfo', 'Missing or invalid sub');
    }

    const email     = typeof payload.email              === 'string' ? payload.email              : '';
    const given     = typeof payload.given_name         === 'string' ? payload.given_name         : '';
    const family    = typeof payload.family_name        === 'string' ? payload.family_name        : '';
    const preferred = typeof payload.preferred_username === 'string' ? payload.preferred_username : '';

    const name = [given, family].filter(Boolean).join(' ')
      || preferred
      || email
      || payload.sub as string;

    // Roles: check userinfo first (top-level `roles[]` from custom mapper, or
    // `realm_access.roles[]` if a "User Realm Role" userinfo mapper is set),
    // then fall back to id_token claims. Keycloak's default `roles` client
    // scope emits realm_access.roles into id_token/access_token but NOT into
    // userinfo, so id_token is the reliable source unless IT configures the
    // userinfo mapper explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readRoles = (src: any): string[] => {
      if (!src || typeof src !== 'object') return [];
      if (Array.isArray(src.roles) && src.roles.every((r: unknown) => typeof r === 'string')) {
        return src.roles as string[];
      }
      if (src.realm_access && typeof src.realm_access === 'object' && Array.isArray(src.realm_access.roles)) {
        return (src.realm_access.roles as unknown[]).filter((r): r is string => typeof r === 'string');
      }
      return [];
    };
    const roles = readRoles(payload).length > 0 ? readRoles(payload) : readRoles(idTokenClaims);

    const teacherRole = process.env.KEYCLOAK_TEACHER_ROLE || 'teacher';
    return {
      providerId: payload.sub as string,
      email: email || undefined,
      name,
      role: isTeacherRole(roles, teacherRole) ? 'teacher' : 'student',
    };
  },
};
