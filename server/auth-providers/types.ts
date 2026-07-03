export interface NormalizedUser {
  providerId: string;
  email?: string;
  name: string;
  role: 'student' | 'teacher';
}

export interface AuthAdapter {
  readonly name: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly userinfoUrl: string;
  readonly endSessionUrl?: string;
  // OAuth scopes to request. Provider-specific because e.g. Keycloak needs
  // `roles` to receive realm_access.roles in tokens, while Loginus doesn't
  // recognize that scope and would reject it with invalid_scope.
  readonly scopes: string;
  parseTokenResponse(raw: unknown): { access_token: string; id_token?: string };
  // idTokenClaims: decoded id_token JWT payload. Adapters MAY use it as an
  // additional source (e.g. Keycloak emits realm roles in id_token by default
  // but not in userinfo unless a mapper is configured).
  parseUserinfo(raw: unknown, idTokenClaims?: Record<string, unknown>): NormalizedUser;
}

export class AuthProviderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthProviderError';
  }
}
