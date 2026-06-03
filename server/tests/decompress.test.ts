import { describe, it, expect, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { gzipSync } from 'zlib';
import { decompressRequest } from '../middleware/decompress.js';

let app: express.Application;

beforeAll(() => {
  app = express();
  app.use(decompressRequest);
  app.use(express.json({ limit: '10mb' }));
  app.post('/echo', (req, res) => {
    res.json({ received: req.body, headers: { ce: req.headers['content-encoding'] ?? null } });
  });
});

describe('decompressRequest middleware', () => {
  it('passes uncompressed JSON straight through to express.json', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ hello: 'world' });
    expect(res.body.headers.ce).toBeNull();
  });

  // supertest/superagent JSON-serializes Buffer bodies when Content-Type is
  // application/json. Override the serializer with identity so the raw gzip
  // bytes hit the wire untouched.
  const sendRaw = (buf: Buffer) => {
    const req = request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip') as unknown as { serialize: (fn: (x: unknown) => unknown) => typeof req; send: (b: Buffer) => Promise<request.Response> };
    req.serialize((x) => x);
    return req.send(buf);
  };

  it('inflates a gzip-encoded JSON body and parses it', async () => {
    const payload = { foo: 'bar'.repeat(1000), nested: { n: 42 } };
    const gzipped = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
    const res = await sendRaw(gzipped);
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual(payload);
    // header should be stripped so downstream isn't confused
    expect(res.body.headers.ce).toBeNull();
  });

  it('returns 400 on malformed gzip body', async () => {
    const res = await sendRaw(Buffer.from('not actually gzip'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on valid gzip but invalid JSON', async () => {
    const gzipped = gzipSync(Buffer.from('this is not json', 'utf8'));
    const res = await sendRaw(gzipped);
    expect(res.status).toBe(400);
  });
});
