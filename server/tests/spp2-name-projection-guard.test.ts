import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SPP-2 structural guardrail. Every prior audit found a fresh `u.name`
// projection in a file the last audit hadn't touched. This test fails the
// build if any server route file re-introduces one of the leak patterns.
//
// The allowlist is intentionally narrow — the goal is to catch the pattern,
// not to make it easy to add exceptions. If you actually need to project
// a legacy name for a documented reason, do it via a helper that this test
// explicitly whitelists.

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// Forbid any of these tokens in real code (not comments).
const FORBIDDEN = /\b(u\.name|users\.name|target\.name)\b/;

function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('SPP-2 guardrail: no `u.name` / `users.name` / `target.name` projections in server/routes', () => {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    it(`${file} has no forbidden name reference`, () => {
      const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
      const code = stripComments(src);
      const offenders: { line: number; text: string }[] = [];
      code.split('\n').forEach((line, i) => {
        if (FORBIDDEN.test(line)) {
          offenders.push({ line: i + 1, text: line.trim() });
        }
      });
      if (offenders.length > 0) {
        throw new Error(
          `SPP-2 violation in ${file}:\n` +
            offenders.map((o) => `  line ${o.line}: ${o.text}`).join('\n') +
            '\n\nSee docs/audit-2026-07-13-consolidated-review.md — every prior audit found a fresh `u.name` leak in a different file. Handle-only.',
        );
      }
      expect(offenders).toEqual([]);
    });
  }
});
