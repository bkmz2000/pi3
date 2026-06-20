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
  parseTokenResponse(raw: unknown): { access_token: string; id_token?: string };
  parseUserinfo(raw: unknown): NormalizedUser;
}

export class AuthProviderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthProviderError';
  }
}
