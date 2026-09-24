import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const requireModule = createRequire(__filename);

describe('service worker build stamp', () => {
  it('replaces the build placeholder in the production worker', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi3-sw-stamp-'));
    const worker = join(dir, 'sw.js');
    writeFileSync(worker, "const BUILD_ID = '__PI3_BUILD_ID__';\n", 'utf8');

    try {
      const { stampServiceWorker } = requireModule(
        resolve(__dirname, '..', '..', 'scripts', 'stamp-service-worker.cjs'),
      ) as {
        stampServiceWorker(path: string, buildId: string): void;
      };
      stampServiceWorker(worker, 'release-abc123');

      const output = readFileSync(worker, 'utf8');
      expect(output).toContain('release-abc123');
      expect(output).not.toContain('__PI3_BUILD_ID__');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
