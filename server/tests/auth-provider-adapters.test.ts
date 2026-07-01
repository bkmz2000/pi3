import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loginusAdapter } from '../auth-providers/loginus.js';
import { keycloakAdapter } from '../auth-providers/keycloak.js';
import { AuthProviderError } from '../auth-providers/types.js';

// ─── Loginus adapter ──────────────────────────────────────────────────────────

describe('loginusAdapter.parseTokenResponse', () => {
  it('accepts a flat (non-enveloped) token response', () => {
    const result = loginusAdapter.parseTokenResponse({
      access_token: 'tok_abc',
      id_token: 'id_xyz',
    });
    expect(result.access_token).toBe('tok_abc');
    expect(result.id_token).toBe('id_xyz');
  });

  it('unwraps a data-enveloped token response', () => {
    const result = loginusAdapter.parseTokenResponse({
      data: { access_token: 'tok_def', id_token: 'id_uvw' },
    });
    expect(result.access_token).toBe('tok_def');
    expect(result.id_token).toBe('id_uvw');
  });

  it('omits id_token when absent', () => {
    const result = loginusAdapter.parseTokenResponse({ access_token: 'tok_ghi' });
    expect(result.id_token).toBeUndefined();
  });

  it('throws AuthProviderError when access_token is missing', () => {
    expect(() => loginusAdapter.parseTokenResponse({ error: 'invalid_grant' }))
      .toThrow(AuthProviderError);
  });
});

describe('loginusAdapter.parseUserinfo', () => {
  let savedEnv: string | undefined;
  beforeEach(() => { savedEnv = process.env.LOGINUS_TEACHER_ROLE; });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.LOGINUS_TEACHER_ROLE;
    else process.env.LOGINUS_TEACHER_ROLE = savedEnv;
  });

  it('maps a student userinfo to role=student', () => {
    const user = loginusAdapter.parseUserinfo({
      id: 'user-1',
      email: 'student@example.com',
      preferred_username: 'ivan',
      globalRoles: [{ name: 'student' }],
    });
    expect(user.providerId).toBe('user-1');
    expect(user.role).toBe('student');
    expect(user.name).toBe('ivan');
    expect(user.email).toBe('student@example.com');
  });

  it('maps a teacher userinfo to role=teacher', () => {
    const user = loginusAdapter.parseUserinfo({
      id: 'user-2',
      globalRoles: [{ name: 'teacher' }],
    });
    expect(user.role).toBe('teacher');
  });

  it('respects LOGINUS_TEACHER_ROLE override', () => {
    process.env.LOGINUS_TEACHER_ROLE = 'instructor';
    const user = loginusAdapter.parseUserinfo({
      id: 'user-3',
      globalRoles: [{ name: 'instructor' }],
    });
    expect(user.role).toBe('teacher');
  });

  it('strips [П] / [Т] role prefixes from preferred_username', () => {
    const user = loginusAdapter.parseUserinfo({
      id: 'user-4',
      preferred_username: '[Т] Иванов Иван',
    });
    expect(user.name).toBe('Иванов Иван');
  });

  it('falls back to firstName + lastName when preferred_username is absent', () => {
    const user = loginusAdapter.parseUserinfo({
      id: 'user-5',
      firstName: 'Jane',
      lastName: 'Smith',
    });
    expect(user.name).toBe('Jane Smith');
  });

  it('falls back to email when no name fields are present', () => {
    const user = loginusAdapter.parseUserinfo({ id: 'user-6', email: 'x@y.com' });
    expect(user.name).toBe('x@y.com');
  });

  it('accepts a data-enveloped userinfo response', () => {
    const user = loginusAdapter.parseUserinfo({
      data: { id: 'user-7', preferred_username: 'wrapped' },
    });
    expect(user.providerId).toBe('user-7');
    expect(user.name).toBe('wrapped');
  });

  it('throws AuthProviderError when id is missing', () => {
    expect(() => loginusAdapter.parseUserinfo({ email: 'no-id@example.com' }))
      .toThrow(AuthProviderError);
  });
});

// ─── Keycloak adapter ─────────────────────────────────────────────────────────

describe('keycloakAdapter.parseTokenResponse', () => {
  it('accepts a standard OIDC token response', () => {
    const result = keycloakAdapter.parseTokenResponse({
      access_token: 'kc_tok',
      id_token: 'kc_id',
      token_type: 'Bearer',
      expires_in: 300,
    });
    expect(result.access_token).toBe('kc_tok');
    expect(result.id_token).toBe('kc_id');
  });

  it('throws AuthProviderError when access_token is missing', () => {
    expect(() => keycloakAdapter.parseTokenResponse({ error: 'invalid_client' }))
      .toThrow(AuthProviderError);
  });
});

describe('keycloakAdapter.parseUserinfo', () => {
  let savedEnv: string | undefined;
  beforeEach(() => { savedEnv = process.env.KEYCLOAK_TEACHER_ROLE; });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.KEYCLOAK_TEACHER_ROLE;
    else process.env.KEYCLOAK_TEACHER_ROLE = savedEnv;
  });

  it('maps a student userinfo to role=student', () => {
    const user = keycloakAdapter.parseUserinfo({
      sub: 'kc-user-1',
      email: 'student@school.ru',
      given_name: 'Anna',
      family_name: 'Ivanova',
      realm_access: { roles: ['student', 'offline_access'] },
    });
    expect(user.providerId).toBe('kc-user-1');
    expect(user.name).toBe('Anna Ivanova');
    expect(user.email).toBe('student@school.ru');
    expect(user.role).toBe('student');
  });

  it('maps a teacher via realm_access.roles to role=teacher', () => {
    const user = keycloakAdapter.parseUserinfo({
      sub: 'kc-user-2',
      given_name: 'Petr',
      family_name: 'Petrov',
      realm_access: { roles: ['teacher'] },
    });
    expect(user.role).toBe('teacher');
  });

  it('maps a teacher via top-level roles array to role=teacher', () => {
    const user = keycloakAdapter.parseUserinfo({
      sub: 'kc-user-3',
      preferred_username: 'prof',
      roles: ['teacher'],
    });
    expect(user.role).toBe('teacher');
    expect(user.name).toBe('prof');
  });

  it('respects KEYCLOAK_TEACHER_ROLE override', () => {
    process.env.KEYCLOAK_TEACHER_ROLE = 'instructor';
    const user = keycloakAdapter.parseUserinfo({
      sub: 'kc-user-4',
      roles: ['instructor'],
    });
    expect(user.role).toBe('teacher');
  });

  it('falls back to preferred_username when given/family name absent', () => {
    const user = keycloakAdapter.parseUserinfo({
      sub: 'kc-user-5',
      preferred_username: 'jdoe',
    });
    expect(user.name).toBe('jdoe');
  });

  it('falls back to sub when no name fields are present', () => {
    const user = keycloakAdapter.parseUserinfo({ sub: 'bare-sub' });
    expect(user.name).toBe('bare-sub');
  });

  it('throws AuthProviderError when sub is missing', () => {
    expect(() => keycloakAdapter.parseUserinfo({ email: 'no-sub@example.com' }))
      .toThrow(AuthProviderError);
  });
});
