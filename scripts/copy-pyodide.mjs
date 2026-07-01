#!/usr/bin/env node
/**
 * Mirror the Pyodide runtime from `node_modules/pyodide/` into `public/pyodide/`
 * so the worker can load it from the same origin (no CDN dependency, no
 * cross-origin isolation surprises). Re-runs are no-ops when the destination
 * is already up to date.
 *
 * Also patches public/sw.js to stamp in the installed Pyodide version so the
 * service worker precaches the correct CDN fallback URLs.
 *
 * Invoked from `predev` and `prebuild` so devs and CI both get a populated
 * bundle without an extra manual step.
 */
import { mkdirSync, copyFileSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', 'pyodide');
const DST = join(ROOT, 'public', 'pyodide');

// Only the files the runtime actually fetches at startup. Skips .d.ts, .map,
// README, console html demos — they bloat the public bundle without adding
// runtime value.
const FILES = [
  'pyodide.mjs',
  'pyodide.js',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

const SKIP_COPY = process.env.VERCEL === '1';

if (!SKIP_COPY && !existsSync(SRC)) {
  console.error(`[copy-pyodide] ${SRC} missing — run \`npm install\` first.`);
  process.exit(1);
}

if (SKIP_COPY) {
  console.log('[copy-pyodide] VERCEL=1 detected — skipping file copy, patching sw.js only');
}

let copied = 0;
let skipped = 0;
if (!SKIP_COPY) {
mkdirSync(DST, { recursive: true });
for (const name of FILES) {
  const from = join(SRC, name);
  const to = join(DST, name);
  if (!existsSync(from)) {
    console.warn(`[copy-pyodide] missing source file: ${name}`);
    continue;
  }
  // Skip if destination is the same size and at least as new as source — a
  // good-enough freshness check that avoids re-copying 8 MB of wasm every
  // dev-server start.
  if (existsSync(to)) {
    const s = statSync(from);
    const d = statSync(to);
    if (d.size === s.size && d.mtimeMs >= s.mtimeMs) {
      skipped++;
      continue;
    }
  }
  copyFileSync(from, to);
  copied++;
}
} // end if (!SKIP_COPY)

console.log(`[copy-pyodide] ${copied} copied, ${skipped} up-to-date → public/pyodide/`);

// Patch public/sw.js: stamp in the installed Pyodide version so the SW
// precaches the correct CDN fallback URLs (stays in sync with package.json).
const swPath = join(ROOT, 'public', 'sw.js');
if (existsSync(swPath)) {
  const { version } = require('../node_modules/pyodide/package.json');
  let sw = readFileSync(swPath, 'utf8');
  sw = sw.replace(
    /const PYODIDE_VERSION = '[^']+';/,
    `const PYODIDE_VERSION = '${version}';`,
  );
  sw = sw.replace(
    /const CACHE_NAME = '[^']+';/,
    `const CACHE_NAME = 'webide-v4';`,
  );
  writeFileSync(swPath, sw, 'utf8');
  console.log(`[copy-pyodide] sw.js patched → PYODIDE_VERSION=${version}, CACHE_NAME=webide-v4`);
}
