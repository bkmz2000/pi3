import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';

const router = Router();

const DOMAIN = process.env.LOGINUS_DOMAIN || 'https://loginus.ru';
const CLIENT_ID = process.env.LOGINUS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.LOGINUS_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.LOGINUS_REDIRECT_URI || '';
const TEACHER_ROLE = process.env.LOGINUS_TEACHER_ROLE || 'teacher';

interface LoginusUserinfo {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  preferred_username?: string;
  globalRoles?: { name: string }[];
}

// GET /api/auth/login
router.get('/login', (req: Request, res: Response): void => {
  const state = randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const returnUrl = typeof req.query.return_url === 'string' ? req.query.return_url : undefined;
  if (returnUrl) req.session.returnUrl = returnUrl;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  res.redirect(`${DOMAIN}/api/v2/oauth/authorize?${params}`);
});

// GET /api/auth/callback
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error from Loginus:', error);
    res.redirect('/?auth_error=1');
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect('/?auth_error=1');
    return;
  }

  if (!state || state !== req.session.oauthState) {
    res.status(400).json({ error: 'Invalid state parameter' });
    return;
  }
  delete req.session.oauthState;

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
      res.redirect('/?auth_error=1');
      return;
    }
    const tokens = await tokenRes.json() as { access_token: string; id_token?: string };
    access_token = tokens.access_token;
    id_token = tokens.id_token;
  } catch (err) {
    console.error('Token exchange error:', err);
    res.redirect('/?auth_error=1');
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
      res.redirect('/?auth_error=1');
      return;
    }
    userinfo = await userinfoRes.json() as LoginusUserinfo;
  } catch (err) {
    console.error('Userinfo fetch error:', err);
    res.redirect('/?auth_error=1');
    return;
  }

  const isTeacher = userinfo.globalRoles?.some((r) => r.name === TEACHER_ROLE) ?? false;
  const role = isTeacher ? 'teacher' : 'student';
  const name = userinfo.preferred_username
    || [userinfo.firstName, userinfo.lastName].filter(Boolean).join(' ')
    || userinfo.email
    || userinfo.id;

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

  if (id_token) req.session.idToken = id_token;
  req.session.userId = userId;

  const returnUrl = req.session.returnUrl || '/';
  delete req.session.returnUrl;
  res.redirect(returnUrl);
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  const idToken = req.session.idToken;

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
