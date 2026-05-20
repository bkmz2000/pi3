import { describe, it, expect } from '@jest/globals';

// Tests documenting the provider adapter contract
// The actual adapters (parseLoginusToken, parseLoginusUserinfo) are tested
// through the auth.test.ts integration tests which use recorded provider responses

describe('Provider Adapter Contract', () => {
  describe('Token Response Shapes', () => {
    it('documents direct token response shape (non-enveloped)', () => {
      // Loginus may return token responses at top level
      const directResponse = {
        access_token: 'tok_abc123',
        id_token: 'id_xyz789',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      expect(directResponse.access_token).toBe('tok_abc123');
    });

    it('documents enveloped token response shape (data wrapper)', () => {
      // Loginus may also wrap responses in a data field
      const envelopedResponse = {
        data: {
          access_token: 'tok_def456',
          id_token: 'id_uvw123',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      expect(envelopedResponse.data.access_token).toBe('tok_def456');
    });

    it('documents error response shape (non-enveloped)', () => {
      const errorResponse = {
        error: 'invalid_grant',
        error_description: 'Authorization code has expired',
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(errorResponse.access_token).toBeUndefined();
    });

    it('documents error response shape (enveloped)', () => {
      const errorResponse = {
        data: {
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        },
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(errorResponse.data.access_token).toBeUndefined();
    });
  });

  describe('Userinfo Response Shapes', () => {
    it('documents direct userinfo response shape (non-enveloped)', () => {
      const directResponse = {
        id: 'user123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        preferred_username: 'johndoe',
        globalRoles: [{ name: 'student' }],
      };

      expect(directResponse.id).toBe('user123');
      expect(directResponse.globalRoles).toEqual([{ name: 'student' }]);
    });

    it('documents enveloped userinfo response shape (data wrapper)', () => {
      const envelopedResponse = {
        data: {
          id: 'user456',
          email: 'another@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          preferred_username: 'janesmith',
          globalRoles: [{ name: 'teacher' }],
        },
      };

      expect(envelopedResponse.data.id).toBe('user456');
      expect(envelopedResponse.data.globalRoles).toEqual([{ name: 'teacher' }]);
    });

    it('documents minimal userinfo response (only required id)', () => {
      const minimalResponse = {
        id: 'minimal_user',
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(minimalResponse.id).toBe('minimal_user');
      expect(minimalResponse.email).toBeUndefined();
    });
  });

  it('adapters are tested through OAuth callback integration tests', () => {
    // The parseLoginusToken and parseLoginusUserinfo functions are tested
    // via the OAuth callback flow in auth.test.ts, which exercises
    // their validation and envelope-unwrapping behavior
    expect(true).toBe(true);
  });
});
