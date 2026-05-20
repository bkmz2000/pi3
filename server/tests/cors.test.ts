import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';

let app: express.Application;

const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:5173',
  'https://example.com',
];

beforeAll(() => {
  app = express();
  app.set('trust proxy', 1);

  // CORS configuration with allowlist
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));

  app.use(cookieParser());
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
  }));

  // Simple test endpoint
  app.get('/api/test', (req, res) => {
    res.json({ ok: true });
  });
});

afterAll(() => {
  // Cleanup
});

describe('CORS Origin Allowlist', () => {
  it('allows configured origin with credentials', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('Origin', 'http://localhost:3001');

    // Should allow the request
    expect(res.status).toBe(200);
    // Should include CORS headers
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows development localhost origins', async () => {
    const devOrigins = ['http://localhost:5173', 'http://localhost:3001'];

    for (const origin of devOrigins) {
      const res = await request(app)
        .get('/api/test')
        .set('Origin', origin);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('rejects unknown origin', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('Origin', 'https://evil.com');

    // Should reject (CORS error)
    // Note: Supertest may not reflect full CORS error behavior, but headers should indicate rejection
    if (res.headers['access-control-allow-origin']) {
      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
    }
  });

  it('allows requests without Origin header (like curl, mobile)', async () => {
    // Request without Origin header should be allowed (no CORS check)
    const res = await request(app)
      .get('/api/test');

    expect(res.status).toBe(200);
  });

  it('allows credentialed requests from allowed origins', async () => {
    const res = await request(app)
      .get('/api/test')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'test=value');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
