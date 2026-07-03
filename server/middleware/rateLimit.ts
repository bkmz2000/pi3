import rateLimit, { type Options } from 'express-rate-limit';

// Skip limiter under NODE_ENV=test so existing tests aren't rate-limited by accident;
// dedicated rate-limit tests set RATE_LIMIT_TEST=1 to enable it.
const skipInTest = () =>
  process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST !== '1';

function make(opts: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: skipInTest,
    message: { error: 'Too many requests, please try again later.' },
    ...opts,
  });
}

// OAuth start + callback: prevent flood of authorize/callback traffic.
// Callback failures could otherwise be replayed to brute the state HMAC.
export const authOauthLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 30,
});

// Outsider create-account: rate-limit signup to prevent name-enumeration and mass account creation.
export const outsiderSignupLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 10,
});

// Outsider password login: strict — brute-force target.
export const outsiderLoginLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
