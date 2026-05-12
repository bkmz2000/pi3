import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    idToken?: string;
    returnUrl?: string;
  }
}
