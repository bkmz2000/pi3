import type { Request, Response, NextFunction } from 'express';
import { gunzip } from 'zlib';

// Cap on inflated size to defuse decompression-bomb requests. Matches the
// express.json limit so a gzipped body can't sneak past it.
const MAX_INFLATED_BYTES = 10 * 1024 * 1024;

export function decompressRequest(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['content-encoding'] !== 'gzip') {
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  let aborted = false;

  req.on('data', (chunk: Buffer) => {
    if (aborted) return;
    total += chunk.length;
    // Compressed bound — assume worst-case 1000x ratio is implausible; cap raw too.
    if (total > MAX_INFLATED_BYTES) {
      aborted = true;
      res.status(413).json({ error: 'PayloadTooLarge', message: 'Compressed request body too large' });
    } else {
      chunks.push(chunk);
    }
  });

  req.on('end', () => {
    if (aborted) return;
    const compressed = Buffer.concat(chunks);
    gunzip(compressed, (err, inflated) => {
      if (err) {
        res.status(400).json({ error: 'BadRequest', message: 'Invalid gzip body' });
        return;
      }
      if (inflated.length > MAX_INFLATED_BYTES) {
        res.status(413).json({ error: 'PayloadTooLarge', message: 'Decompressed body exceeds limit' });
        return;
      }
      // Parse JSON ourselves and mark the body as consumed so express.json no-ops.
      const ctype = req.headers['content-type'] || '';
      if (ctype.includes('application/json')) {
        try {
          req.body = inflated.length > 0 ? JSON.parse(inflated.toString('utf8')) : {};
        } catch {
          res.status(400).json({ error: 'BadRequest', message: 'Invalid JSON' });
          return;
        }
      } else {
        req.body = inflated;
      }
      // body-parser's contract for "I've already read the body"
      (req as unknown as { _body: boolean })._body = true;
      delete req.headers['content-encoding'];
      req.headers['content-length'] = String(inflated.length);
      next();
    });
  });

  req.on('error', next);
}
