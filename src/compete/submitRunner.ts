import { runOnce, runChecker } from '../runner/RunnerProvider';
import type { SubmitTestCase, SubmitResult, Tier } from './types';

type RunOnceFn = typeof runOnce;
type RunCheckerFn = typeof runChecker;

function normalizeOutput(s: string): string {
  return s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export async function runSubmit(
  code: string,
  tests: SubmitTestCase[],
  _runOnce: RunOnceFn = runOnce,
  checkerPy?: string | null,
  _runChecker: RunCheckerFn = runChecker,
): Promise<SubmitResult> {
  const tiers: Tier[] = [1, 2, 3];
  const byTier: Record<number, SubmitTestCase[]> = { 1: [], 2: [], 3: [] };
  for (const t of tests) byTier[t.tier].push(t);
  for (const tier of tiers) byTier[tier].sort((a, b) => a.ordinal - b.ordinal);

  for (const tier of tiers) {
    const tierTests = byTier[tier];
    if (tierTests.length === 0) continue;

    for (const test of tierTests) {
      const { stdout, runtimeError, tle } = await _runOnce(code, test.input, 2000);

      if (tle) {
        return { verdict: 'tle', stars: (tier - 1) as 0 | 1 | 2, failedTier: tier, failedTest: test.ordinal };
      }
      if (runtimeError) {
        return { verdict: 'rte', stars: (tier - 1) as 0 | 1 | 2, failedTier: tier, failedTest: test.ordinal };
      }

      let passed: boolean;
      if (checkerPy) {
        const { passed: checkerPassed } = await _runChecker(
          checkerPy,
          test.fieldsJson ?? null,
          stdout,
          test.expected,
        );
        passed = checkerPassed;
      } else {
        passed = normalizeOutput(stdout) === normalizeOutput(test.expected);
      }

      if (!passed) {
        return { verdict: 'wa', stars: (tier - 1) as 0 | 1 | 2, failedTier: tier, failedTest: test.ordinal };
      }
    }
  }

  return { verdict: 'ok', stars: 3 };
}
