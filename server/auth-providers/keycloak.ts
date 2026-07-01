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

  parseUserinfo(raw: unknown): NormalizedUser {
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

    // Roles can live in realm_access.roles (standard Keycloak JWT claim propagated
    // to userinfo via mapper) or as a top-level `roles` array if the realm is
    // configured with a "User Realm Role" userinfo mapper.
    let roles: string[] = [];
    if (Array.isArray(payload.roles)) {
      roles = payload.roles.filter((r: unknown) => typeof r === 'string');
    } else if (
      typeof payload.realm_access === 'object' &&
      payload.realm_access !== null &&
      Array.isArray(payload.realm_access.roles)
    ) {
      roles = payload.realm_access.roles.filter((r: unknown) => typeof r === 'string');
    }

    const teacherRole = process.env.KEYCLOAK_TEACHER_ROLE || 'teacher';
    return {
      providerId: payload.sub as string,
      email: email || undefined,
      name,
      role: isTeacherRole(roles, teacherRole) ? 'teacher' : 'student',
    };
  },
};
