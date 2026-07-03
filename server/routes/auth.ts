import { Router, Request, Response } from 'express';
import { randomBytes, createHmac, timingSafeEqual, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/index.js';
import { assignHandle } from '../db/handle.js';
import { authMiddleware, regenerateSession } from '../middleware/auth.js';
import { authOauthLimiter } from '../middleware/rateLimit.js';
import { authAdapter, AuthProviderError } from '../auth-providers/index.js';

const router = Router();

function isSafeReturnUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');
}

const DEFAULT_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://pi3.sys5.ru' : 'http://localhost:3001';
const APP_BASE_URL = process.env.APP_BASE_URL || DEFAULT_BASE_URL;
const REDIRECT_URI = `${APP_BASE_URL}/api/auth/callback`;
const STATE_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

function signState(state: string): string {
  const sig = createHmac('sha256', STATE_SECRET).update(state).digest('hex');
  return `${state}.${sig}`;
}

function verifyState(cookie: string, urlState: string): boolean {
  const dot = cookie.lastIndexOf('.');
  if (dot === -1) return false;
  const state = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = createHmac('sha256', STATE_SECRET).update(state).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf) && state === urlState;
}

function verifyNonce(cookie: string, idTokenNonce: string): boolean {
  const dot = cookie.lastIndexOf('.');
  if (dot === -1) return false;
  const nonce = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = createHmac('sha256', STATE_SECRET).update(nonce).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf) && nonce === idTokenNonce;
}

function verifyPkce(cookie: string): string | null {
  const dot = cookie.lastIndexOf('.');
  if (dot === -1) return null;
  const verifier = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = createHmac('sha256', STATE_SECRET).update(verifier).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;
  return verifier;
}

// GET /api/auth/login
router.get('/login', authOauthLimiter, (req: Request, res: Response): void => {
  const state = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');

  const rawReturnUrl = typeof req.query.return_url === 'string' ? req.query.return_url : undefined;
  const returnUrl = rawReturnUrl && isSafeReturnUrl(rawReturnUrl) ? rawReturnUrl : '/';

  const cookieOpts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax' as const,
    maxAge: 10 * 60 * 1000,
    path: '/',
  };

  res.cookie('oauth_state', signState(state), cookieOpts);

  res.cookie('oauth_nonce', signState(nonce), cookieOpts);

  if (returnUrl !== '/') {
    res.cookie('oauth_return', returnUrl, cookieOpts);
  }

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  res.cookie('oauth_pkce', signState(codeVerifier), cookieOpts);

  const params = new URLSearchParams({
    client_id: authAdapter.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: authAdapter.scopes,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`${authAdapter.authorizationUrl}?${params}`);
});

// GET /api/auth/callback
router.get('/callback', authOauthLimiter, async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error from provider:', error);
    res.redirect('/?auth_error=provider');
    return;
  }

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    res.redirect('/?auth_error=missing_params');
    return;
  }

  const stateCookie = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', { path: '/' });

  if (!stateCookie || !verifyState(stateCookie, state)) {
    console.error('[auth/callback] state mismatch');
    res.redirect('/?auth_error=state');
    return;
  }

  // Nonce cookie — read and clear
  const nonceCookie = req.cookies?.oauth_nonce;
  res.clearCookie('oauth_nonce', { path: '/' });

  // PKCE cookie — read, clear, and verify
  const pkceCookie = req.cookies?.oauth_pkce;
  res.clearCookie('oauth_pkce', { path: '/' });
  const codeVerifier = pkceCookie ? verifyPkce(pkceCookie) : null;
  if (!codeVerifier) {
    console.error('[auth/callback] pkce verification failed');
    res.redirect('/?auth_error=pkce');
    return;
  }

  const cookieReturnUrl = req.cookies?.oauth_return;
  const returnUrl = (cookieReturnUrl && isSafeReturnUrl(cookieReturnUrl)) ? cookieReturnUrl : '/';
  res.clearCookie('oauth_return', { path: '/' });

  let access_token: string;
  let id_token: string | undefined;
  try {
    const tokenRes = await fetch(authAdapter.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: authAdapter.clientId,
        client_secret: authAdapter.clientSecret,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });
    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenRes.status);
      res.redirect('/?auth_error=token');
      return;
    }
    const parsed = authAdapter.parseTokenResponse(await tokenRes.json());
    access_token = parsed.access_token;
    id_token = parsed.id_token;
  } catch (err) {
    if (err instanceof AuthProviderError) {
      console.error(`Token exchange error (${err.code}):`, err.message);
      res.redirect(`/?auth_error=${err.code}`);
    } else {
      console.error('Token exchange error:', err);
      res.redirect('/?auth_error=token');
    }
    return;
  }

  // Decode id_token once — used for nonce check AND passed to parseUserinfo
  // so adapters can read claims (e.g. Keycloak realm roles) that live in the
  // id_token but not in the userinfo response.
  if (!id_token) {
    console.error('[auth/callback] missing id_token');
    res.redirect('/?auth_error=nonce');
    return;
  }
  let idTokenClaims: Record<string, unknown>;
  try {
    const parts = id_token.split('.');
    if (parts.length !== 3) throw new Error('invalid id_token format');
    idTokenClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    console.error('[auth/callback] failed to decode id_token');
    res.redirect('/?auth_error=nonce');
    return;
  }
  const idTokenNonce = typeof idTokenClaims.nonce === 'string' ? idTokenClaims.nonce : undefined;
  if (!idTokenNonce || !nonceCookie || !verifyNonce(nonceCookie, idTokenNonce)) {
    console.error('[auth/callback] nonce mismatch');
    res.redirect('/?auth_error=nonce');
    return;
  }

  let providerId: string;
  let userName: string;
  let userEmail: string | undefined;
  let userRole: 'student' | 'teacher';
  try {
    const userinfoRes = await fetch(authAdapter.userinfoUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userinfoRes.ok) {
      console.error('Userinfo fetch failed:', userinfoRes.status);
      res.redirect('/?auth_error=userinfo');
      return;
    }
    const user = authAdapter.parseUserinfo(await userinfoRes.json(), idTokenClaims);
    providerId = user.providerId;
    userName   = user.name;
    userEmail  = user.email;
    userRole   = user.role;
  } catch (err) {
    if (err instanceof AuthProviderError) {
      console.error(`Userinfo fetch error (${err.code}):`, err.message);
      res.redirect(`/?auth_error=${err.code}`);
    } else {
      console.error('Userinfo fetch error:', err);
      res.redirect('/?auth_error=userinfo');
    }
    return;
  }

  const client = getClient();
  const existing = (await client.execute(
    'SELECT id FROM users WHERE oauth_provider_id = ?',
    [providerId],
  )).rows[0] as { id: string } | undefined;

  let userId: string;
  const now = Date.now();

  if (existing) {
    await client.execute(
      'UPDATE users SET name = ?, role = ?, updated_at = ? WHERE id = ?',
      [userName, userRole, now, existing.id],
    );
    userId = existing.id as string;
  } else {
    userId = uuidv4();
    const api_token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const { seq, handle } = await assignHandle(client);
    await client.execute(
      `INSERT INTO users (id, api_token, name, role, oauth_provider_id, handle, handle_seq, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, api_token, userName, userRole, providerId, handle, seq, now, now],
    );
  }

  if (userEmail) {
    try {
      await client.execute(
        'UPDATE users SET email = ?, updated_at = ? WHERE id = ?',
        [userEmail, now, userId],
      );
    } catch {
      // email column may not exist in older schemas; non-fatal
    }
  }

  try {
    await regenerateSession(req);
    if (id_token) req.session.idToken = id_token;
    req.session.userId = userId;
    res.redirect(returnUrl);
  } catch (err) {
    console.error('Session regeneration error:', err);
    res.redirect('/?auth_error=session');
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const client = getClient();
  const newToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  await client.execute(
    'UPDATE users SET api_token = ?, updated_at = ? WHERE id = ?',
    [newToken, Date.now(), req.user!.id],
  );

  const idToken = req.session.idToken;
  req.session.destroy(() => {
    res.clearCookie('connect.sid');

    if (authAdapter.endSessionUrl && idToken) {
      const params = new URLSearchParams({
        id_token_hint: idToken,
        client_id: authAdapter.clientId,
      });
      res.json({ ok: true, endSessionUrl: `${authAdapter.endSessionUrl}?${params}` });
    } else {
      res.json({ ok: true });
    }
  });
});

export default router;
