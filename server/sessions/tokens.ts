import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

// Signed membership for both ephemeral link rooms and time-boxed classroom
// sessions. Classroom metadata is persisted separately so members can discover
// the invitation; the signed token still authorizes each participant.

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export type SessionPayload = {
  sid: string;
  starterId: string;
  iat: number;
  exp: number;
  groupId?: string;
};

export type VerifiedSession = SessionPayload & {
  role: 'starter' | 'joiner';
};

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-in-production';
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const padded = pad === 4 ? s : s + '='.repeat(pad);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function issueSessionToken(
  starterId: string,
  now: number = Date.now(),
  opts: { groupId?: string; sid?: string; expiresAt?: number } = {},
): { token: string; payload: SessionPayload } {
  const payload: SessionPayload = {
    sid: opts.sid ?? randomBytes(9).toString('hex'),
    starterId,
    iat: now,
    exp: opts.expiresAt ?? now + SESSION_TTL_MS,
    ...(opts.groupId ? { groupId: opts.groupId } : {}),
  };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  const token = `${body}.${b64urlEncode(sig)}`;
  return { token, payload };
}

export function verifySessionToken(token: string, viewerId: string, now: number = Date.now()): VerifiedSession | null {
  if (typeof token !== 'string' || token.length < 8) return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sigStr = token.slice(dot + 1);
  let sigBuf: Buffer;
  try {
    sigBuf = b64urlDecode(sigStr);
  } catch {
    return null;
  }
  const expected = createHmac('sha256', getSecret()).update(body).digest();
  if (sigBuf.length !== expected.length) return null;
  if (!timingSafeEqual(sigBuf, expected)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.sid !== 'string' || typeof payload.starterId !== 'string'
      || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    return null;
  }
  if (now >= payload.exp) return null;
  return {
    ...payload,
    role: viewerId === payload.starterId ? 'starter' : 'joiner',
  };
}
