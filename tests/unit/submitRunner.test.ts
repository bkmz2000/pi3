import { describe, it, expect, jest } from '@jest/globals';
import { runSubmit } from '../../src/compete/submitRunner';
import type { SubmitTestCase } from '../../src/compete/types';

type RunOnceFn = (code: string, stdin: string, timeLimitMs: number) => Promise<{ stdout: string; runtimeError: boolean; tle: boolean }>;

function makeRunner(results: { stdout: string; runtimeError?: boolean; tle?: boolean }[]): RunOnceFn {
  let idx = 0;
  return jest.fn(async () => {
    const r = results[idx++] ?? { stdout: '', runtimeError: false, tle: false };
    return { stdout: r.stdout, runtimeError: r.runtimeError ?? false, tle: r.tle ?? false };
  }) as RunOnceFn;
}

const TESTS_3T: SubmitTestCase[] = [
  { ordinal: 1, tier: 1, input: '1\n', expected: '1\n' },
  { ordinal: 2, tier: 2, input: '2\n', expected: '2\n' },
  { ordinal: 3, tier: 3, input: '3\n', expected: '3\n' },
];

const TESTS_2T1: SubmitTestCase[] = [
  { ordinal: 1, tier: 1, input: 'a\n', expected: 'a\n' },
  { ordinal: 2, tier: 1, input: 'b\n', expected: 'b\n' },
];

// ── Verdict: ok ───────────────────────────────────────────────────────────────

describe('ok verdict', () => {
  it('all tiers pass → ok stars=3', async () => {
    const runner = makeRunner([
      { stdout: '1\n' },
      { stdout: '2\n' },
      { stdout: '3\n' },
    ]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'ok', stars: 3 });
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it('only tier 1 tests, all pass → ok stars=3', async () => {
    const runner = makeRunner([{ stdout: 'a\n' }, { stdout: 'b\n' }]);
    const result = await runSubmit('code', TESTS_2T1, runner);
    expect(result).toEqual({ verdict: 'ok', stars: 3 });
  });
});

// ── Verdict: wa ───────────────────────────────────────────────────────────────

describe('wa verdict', () => {
  it('tier 1 fail → wa stars=0, no further tests run', async () => {
    const runner = makeRunner([{ stdout: 'WRONG\n' }]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'wa', stars: 0, failedTier: 1, failedTest: 1 });
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('tier 1 passes, tier 2 fails → wa stars=1', async () => {
    const runner = makeRunner([
      { stdout: '1\n' },    // tier 1 pass
      { stdout: 'BAD\n' },  // tier 2 fail
    ]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'wa', stars: 1, failedTier: 2, failedTest: 2 });
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('tier 2 passes, tier 3 fails → wa stars=2', async () => {
    const runner = makeRunner([
      { stdout: '1\n' },   // tier 1
      { stdout: '2\n' },   // tier 2
      { stdout: 'X\n' },   // tier 3 fail
    ]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'wa', stars: 2, failedTier: 3, failedTest: 3 });
  });

  it('stops immediately on first fail within a tier', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: 'x\n', expected: 'x\n' },
      { ordinal: 2, tier: 1, input: 'y\n', expected: 'y\n' },
      { ordinal: 3, tier: 2, input: 'z\n', expected: 'z\n' },
    ];
    const runner = makeRunner([
      { stdout: 'x\n' },   // tier 1 test 1 pass
      { stdout: 'BAD\n' }, // tier 1 test 2 fail
    ]);
    const result = await runSubmit('code', tests, runner);
    expect(result).toEqual({ verdict: 'wa', stars: 0, failedTier: 1, failedTest: 2 });
    expect(runner).toHaveBeenCalledTimes(2); // tier 2 never runs
  });
});

// ── Verdict: tle ──────────────────────────────────────────────────────────────

describe('tle verdict', () => {
  it('tier 1 TLE → tle stars=0', async () => {
    const runner = makeRunner([{ stdout: '', tle: true }]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'tle', stars: 0, failedTier: 1, failedTest: 1 });
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('tier 2 TLE → tle stars=1', async () => {
    const runner = makeRunner([
      { stdout: '1\n' },         // tier 1 pass
      { stdout: '', tle: true }, // tier 2 TLE
    ]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'tle', stars: 1, failedTier: 2, failedTest: 2 });
  });
});

// ── Verdict: rte ──────────────────────────────────────────────────────────────

describe('rte verdict', () => {
  it('tier 1 RTE → rte stars=0', async () => {
    const runner = makeRunner([{ stdout: '', runtimeError: true }]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'rte', stars: 0, failedTier: 1, failedTest: 1 });
  });

  it('tier 3 RTE → rte stars=2', async () => {
    const runner = makeRunner([
      { stdout: '1\n' },
      { stdout: '2\n' },
      { stdout: '', runtimeError: true },
    ]);
    const result = await runSubmit('code', TESTS_3T, runner);
    expect(result).toEqual({ verdict: 'rte', stars: 2, failedTier: 3, failedTest: 3 });
  });
});

// ── Integration: TLE then clean run ───────────────────────────────────────────

describe('integration: TLE then clean run', () => {
  it('after a TLE on one test, subsequent tests receive clean state', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: '1\n', expected: '1\n' },
      { ordinal: 2, tier: 2, input: '2\n', expected: '2\n' },
      { ordinal: 3, tier: 3, input: '3\n', expected: '3\n' },
    ];
    // tier 1 passes; tier 2 TLEs → submit stops. We verify tier 3 was never called.
    const runner = makeRunner([
      { stdout: '1\n' },         // tier 1 pass
      { stdout: '', tle: true }, // tier 2 TLE
    ]);
    const result = await runSubmit('slow_code', tests, runner);
    expect(result.verdict).toBe('tle');
    expect(result.stars).toBe(1);
    expect(runner).toHaveBeenCalledTimes(2);
  });
});

// ── Output normalization ───────────────────────────────────────────────────────

describe('output normalization', () => {
  it('trailing newline tolerated', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: 'x\n', expected: 'hello' },
    ];
    const runner = makeRunner([{ stdout: 'hello\n' }]);
    const result = await runSubmit('code', tests, runner);
    expect(result.verdict).toBe('ok');
  });

  it('trailing blank line tolerated', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: 'x\n', expected: 'a\nb' },
    ];
    const runner = makeRunner([{ stdout: 'a\nb\n\n' }]);
    const result = await runSubmit('code', tests, runner);
    expect(result.verdict).toBe('ok');
  });

  it('trailing spaces on each line stripped', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: 'x\n', expected: 'a\nb' },
    ];
    const runner = makeRunner([{ stdout: 'a   \nb   ' }]);
    const result = await runSubmit('code', tests, runner);
    expect(result.verdict).toBe('ok');
  });

  it('mid-output whitespace is strict (different content → wa)', async () => {
    const tests: SubmitTestCase[] = [
      { ordinal: 1, tier: 1, input: 'x\n', expected: 'a b' },
    ];
    const runner = makeRunner([{ stdout: 'ab' }]);
    const result = await runSubmit('code', tests, runner);
    expect(result.verdict).toBe('wa');
  });
});

// ── Tier ordering ─────────────────────────────────────────────────────────────

describe('tier ordering', () => {
  it('tests are sorted by tier before ordinal regardless of input order', async () => {
    const calls: string[] = [];
    const runner = jest.fn(async (_code: string, stdin: string) => {
      calls.push(stdin.trim());
      return { stdout: stdin, runtimeError: false, tle: false };
    }) as RunOnceFn;

    const tests: SubmitTestCase[] = [
      { ordinal: 3, tier: 2, input: 'tier2\n', expected: 'tier2\n' },
      { ordinal: 1, tier: 1, input: 'tier1\n', expected: 'tier1\n' },
      { ordinal: 5, tier: 3, input: 'tier3\n', expected: 'tier3\n' },
    ];
    await runSubmit('code', tests, runner);
    expect(calls).toEqual(['tier1', 'tier2', 'tier3']);
  });
});
