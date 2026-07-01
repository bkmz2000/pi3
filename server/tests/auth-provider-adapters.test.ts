import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loginusAdapter } from '../auth-providers/loginus.js';
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
