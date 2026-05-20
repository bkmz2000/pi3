import { Router, Request, Response } from 'express';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware, regenerateSession } from '../middleware/auth.js';

const router = Router();

function isSafeReturnUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');
}

const DOMAIN = process.env.LOGINUS_DOMAIN || 'https://loginus.ru';
const CLIENT_ID = process.env.LOGINUS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.LOGINUS_CLIENT_SECRET || '';
const DEFAULT_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://pi3.sys5.ru' : 'http://localhost:3001';
const APP_BASE_URL = process.env.APP_BASE_URL || DEFAULT_BASE_URL;
const REDIRECT_URI = `${APP_BASE_URL}/api/auth/callback`;
const TEACHER_ROLE = process.env.LOGINUS_TEACHER_ROLE || 'teacher';
// Use SESSION_SECRET for state signing (validated at bootstrap)
const STATE_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

interface LoginusUserinfo {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  preferred_username?: string;
  globalRoles?: { name: string }[];
}

interface LoginusTokenResponse {
  access_token: string;
  id_token?: string;
}

class AuthProviderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthProviderError';
  }
}

function parseLoginusToken(raw: unknown): LoginusTokenResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = typeof raw === 'object' && raw !== null ? (raw as any) : {};
  const payload = data.data ?? data;

  if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
    throw new AuthProviderError('token', 'Missing or invalid access_token');
  }

  return {
    access_token: payload.access_token,
    id_token: typeof payload.id_token === 'string' ? payload.id_token : undefined,
  };
}

function parseLoginusUserinfo(raw: unknown): LoginusUserinfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = typeof raw === 'object' && raw !== null ? (raw as any) : {};
  const payload = data.data ?? data;

  if (typeof payload.id !== 'string' || payload.id.length === 0) {
    throw new AuthProviderError('userinfo', 'Missing or invalid id');
  }

  return {
    id: payload.id,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    firstName: typeof payload.firstName === 'string' ? payload.firstName : undefined,
    lastName: typeof payload.lastName === 'string' ? payload.lastName : undefined,
    preferred_username: typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
    globalRoles: Array.isArray(payload.globalRoles) ? payload.globalRoles : undefined,
  };
}

function mapProviderRoleToAppRole(userinfo: LoginusUserinfo): 'student' | 'teacher' {
  const isTeacher = userinfo.globalRoles?.some((r) => r.name === TEACHER_ROLE) ?? false;
  return isTeacher ? 'teacher' : 'student';
}

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

// GET /api/auth/login
router.get('/login', (req: Request, res: Response): void => {
  const state = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');

  const rawReturnUrl = typeof req.query.return_url === 'string' ? req.query.return_url : undefined;
  const returnUrl = rawReturnUrl && isSafeReturnUrl(rawReturnUrl) ? rawReturnUrl : '/';

  // Store state in a dedicated cookie instead of the session so it survives
  // the cross-site redirect regardless of session cookie SameSite/Secure issues.
  res.cookie('oauth_state', signState(state), {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 min
    path: '/',
  });

  if (returnUrl !== '/') {
    res.cookie('oauth_return', returnUrl, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'login',
  });

  res.redirect(`${DOMAIN}/api/v2/oauth/authorize?${params}`);
});

// GET /api/auth/callback
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
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
    console.error('[auth/callback] state mismatch — cookie:', stateCookie, 'url state:', state);
    res.redirect('/?auth_error=state');
    return;
  }

  const cookieReturnUrl = req.cookies?.oauth_return;
  const returnUrl = (cookieReturnUrl && isSafeReturnUrl(cookieReturnUrl)) ? cookieReturnUrl : '/';
  res.clearCookie('oauth_return', { path: '/' });

  // Exchange code for tokens
  let access_token: string;
  let id_token: string | undefined;
  try {
    const tokenRes = await fetch(`${DOMAIN}/api/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      res.redirect('/?auth_error=token');
      return;
    }
    const tokenData = parseLoginusToken(await tokenRes.json());
    access_token = tokenData.access_token;
    id_token = tokenData.id_token;
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

  // Fetch userinfo
  let userinfo: LoginusUserinfo;
  try {
    const userinfoRes = await fetch(`${DOMAIN}/api/v2/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userinfoRes.ok) {
      console.error('Userinfo fetch failed:', await userinfoRes.text());
      res.redirect('/?auth_error=userinfo');
      return;
    }
    userinfo = parseLoginusUserinfo(await userinfoRes.json());
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

  const role = mapProviderRoleToAppRole(userinfo);
  const name = userinfo.preferred_username
    || [userinfo.firstName, userinfo.lastName].filter(Boolean).join(' ')
    || userinfo.email
    || userinfo.id
    || 'Unknown';

  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE oauth_provider_id = ?')
    .get(userinfo.id) as { id: string } | undefined;

  let userId: string;
  const now = Date.now();

  if (existing) {
    db.prepare('UPDATE users SET name = ?, role = ?, updated_at = ? WHERE id = ?')
      .run(name, role, now, existing.id);
    userId = existing.id;
  } else {
    userId = uuidv4();
    const api_token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    db.prepare(`
      INSERT INTO users (id, api_token, name, role, oauth_provider_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, api_token, name, role, userinfo.id, now, now);
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
router.post('/logout', authMiddleware, (req: Request, res: Response): void => {
  const idToken = req.session.idToken;
  const db = getDb();
  const newToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  db.prepare('UPDATE users SET api_token = ?, updated_at = ? WHERE id = ?')
    .run(newToken, Date.now(), req.user!.id);

  req.session.destroy(() => {
    res.clearCookie('connect.sid');

    if (idToken) {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        id_token_hint: idToken,
        post_logout_redirect_uri: REDIRECT_URI.replace('/api/auth/callback', '/'),
      });
      res.json({ ok: true, logoutUrl: `${DOMAIN}/api/v2/oauth/end_session?${params}` });
    } else {
      res.json({ ok: true });
    }
  });
});

export default router;
