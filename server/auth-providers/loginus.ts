import { AuthAdapter, AuthProviderError, NormalizedUser } from './types.js';

const DOMAIN = process.env.LOGINUS_DOMAIN || 'https://loginus.ru';

// Loginus wraps some responses in a { data: ... } envelope; unwrap if present.
function unwrap(raw: unknown): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = typeof raw === 'object' && raw !== null ? (raw as any) : {};
  return obj.data ?? obj;
}

export const loginusAdapter: AuthAdapter = {
  name: 'loginus',
  get clientId()     { return process.env.LOGINUS_CLIENT_ID || ''; },
  get clientSecret() { return process.env.LOGINUS_CLIENT_SECRET || ''; },
  get authorizationUrl() { return `${DOMAIN}/api/v2/oauth/authorize`; },
  get tokenUrl()         { return `${DOMAIN}/api/v2/oauth/token`; },
  get userinfoUrl()      { return `${DOMAIN}/api/v2/oauth/userinfo`; },
  // Loginus end_session is not reliably configured; local-only logout is used.
  endSessionUrl: undefined,

  parseTokenResponse(raw: unknown) {
    const payload = unwrap(raw);
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new AuthProviderError('token', 'Missing or invalid access_token');
    }
    return {
      access_token: payload.access_token,
      id_token: typeof payload.id_token === 'string' ? payload.id_token : undefined,
    };
  },

  parseUserinfo(raw: unknown): NormalizedUser {
    const payload = unwrap(raw);
    if (typeof payload.id !== 'string' || payload.id.length === 0) {
      throw new AuthProviderError('userinfo', 'Missing or invalid id');
    }

    const teacherRole = process.env.LOGINUS_TEACHER_ROLE || 'teacher';
    const globalRoles = Array.isArray(payload.globalRoles) ? payload.globalRoles : [];
    const isTeacher = globalRoles.some((r: unknown) =>
      typeof r === 'object' && r !== null && (r as Record<string, unknown>).name === teacherRole
    );

    const preferred_username = typeof payload.preferred_username === 'string' ? payload.preferred_username : '';
    const firstName = typeof payload.firstName === 'string' ? payload.firstName : '';
    const lastName  = typeof payload.lastName  === 'string' ? payload.lastName  : '';
    const email     = typeof payload.email     === 'string' ? payload.email     : '';

    const rawName = preferred_username
      || [firstName, lastName].filter(Boolean).join(' ')
      || email
      || (payload.id as string)
      || 'Unknown';
    // Loginus prefixes preferred_username with role markers like "[П] " or "[Т] ".
    const name = rawName.replace(/^\s*\[[\p{L}\d]{1,3}\]\s*/u, '').trim() || rawName;

    return {
      providerId: payload.id as string,
      email: email || undefined,
      name,
      role: isTeacher ? 'teacher' : 'student',
    };
  },
};
