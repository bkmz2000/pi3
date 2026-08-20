/**
 * Wires validate_worker_reset.py into the Jest pipeline.
 *
 * Executes the REAL graphics._reset_run_state()/_clear() against the A2
 * invariant (_reset_run_state must NOT bump _loop_generation) and the
 * per-run reset semantics. Used to be an expect(true) placeholder.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const SCRIPT = resolve(__dirname, 'validate_worker_reset.py');

test('validate_worker_reset.py: graphics reset invariants hold', () => {
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
    throw new Error('validate_worker_reset.py failed:\n' + combined);
  }
  expect(output).toMatch(/ALL TESTS PASSED/);
});
