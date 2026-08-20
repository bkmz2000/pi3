/**
 * Wires validate_error_hook.py into the Jest pipeline.
 *
 * Executes the REAL error_hook.classify_error against a matrix of student
 * exceptions and asserts the structured keys/args — guarding the gibberish
 * regressions (operator parsing, not-iterable, index-out-of-range, generic
 * fallbacks). Mirrors graphicsPython.test.ts: Python runs standalone.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const SCRIPT = resolve(__dirname, 'validate_error_hook.py');

test('validate_error_hook.py: friendly-error classifier assertions pass', () => {
  let output = '';
  try {
    output = execSync('python3 "' + SCRIPT + '"', {
      cwd: ROOT,
      env: { ...process.env, PYTHONPATH: resolve(ROOT, 'src/assets/python') },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
    throw new Error('validate_error_hook.py failed:\n' + combined);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
