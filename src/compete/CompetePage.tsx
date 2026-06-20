import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useThemeStore } from "../state/useTheme";
import { useRunner, useRunnerStore, runOnce } from "../runner/RunnerProvider";
import { Icon } from "../components/Icons";
import DebugPanel from "../components/DebugPanel";
import CompeteLeft from "./CompeteLeft";
import { runSubmit } from "./submitRunner";
import type { Problem, ExampleRun, SubmitState, ServerTest, SubmitTestCase } from "./types";

// ── Submit progress state ────────────────────────────────────────────────────

interface SubmitProgress {
  tier: 1 | 2 | 3;
  testN: number;
  totalInTier: number;
}

// ── Verdict card ─────────────────────────────────────────────────────────────

function VerdictCard({
  state,
  onDismiss,
}: {
  state: SubmitState;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const ok = state.verdict === 'ok';
  return (
    <div style={{
      margin: '12px 16px',
      padding: '14px 16px',
      borderRadius: 8,
      background: ok ? '#10b98122' : '#ef444422',
      border: `1px solid ${ok ? '#10b981' : '#ef4444'}`,
      fontFamily: theme.fontUI,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>
          {ok ? '✅' : '❌'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: ok ? '#10b981' : '#ef4444' }}>
            {t(`compete.verdict_${state.verdict}`)}
            {' '}
            {'★'.repeat(state.stars)}
          </div>
          {!ok && state.failedTest != null && (
            <div style={{ fontSize: 12.5, color: theme.panelTxtMute, marginTop: 3 }}>
              {t('compete.failedOn', { n: state.failedTest, tier: '★'.repeat(state.failedTier ?? 1) })}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          style={{ all: 'unset', cursor: 'pointer', color: theme.panelTxtMute }}
        >
          <Icon name="close" size={14} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: SubmitProgress }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ margin: '12px 16px', fontFamily: theme.fontUI, fontSize: 12.5, color: theme.panelTxtMute }}>
      {t('compete.runningTier', {
        tier: '★'.repeat(progress.tier),
        n: progress.testN,
        total: progress.totalInTier,
      })}
      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: theme.chip }}>
        <div style={{
          height: '100%',
          width: `${Math.round((progress.testN / progress.totalInTier) * 100)}%`,
          background: theme.accent,
          borderRadius: 2,
          transition: 'width 0.15s',
        }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompetePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const savedTheme = useRef(useThemeStore.getState().themeId);

  useEffect(() => {
    savedTheme.current = useThemeStore.getState().themeId;
    setTheme('midnight');
    return () => setTheme(savedTheme.current);
  }, [setTheme]);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [exampleRuns, setExampleRuns] = useState<ExampleRun[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState | null>(null);
  const [submitProgress, setSubmitProgress] = useState<SubmitProgress | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [inProgress, setInProgress] = useState(false);

  const { output, interrupt } = useRunner();
  const running = useRunnerStore((s) => s.running);
  const debugFrames = useRunnerStore((s) => s.debugFrames);
  const codeRef = useRef(code);
  codeRef.current = code;

  // Load problem
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/problems/${slug}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setProblem(data);
          setCode(data.starter_code ?? '');
        }
      })
      .catch(() => {});
  }, [slug]);

  // ── Visible test runner ────────────────────────────────────────────────────

  const runTests = useCallback(async (tests: ServerTest[]) => {
    if (inProgress) return;
    setInProgress(true);
    setExampleRuns([]);
    setConsoleOpen(true);
    const results: ExampleRun[] = [];
    for (const test of tests) {
      const { stdout } = await runOnce(codeRef.current, test.input, 10_000);
      const passed = stdout.trimEnd() === test.expected.trimEnd();
      results.push({ testId: String(test.id), stdout, passed });
      setExampleRuns([...results]);
    }
    setInProgress(false);
  }, [inProgress]);

  const handleRun = useCallback(() => {
    if (!problem) return;
    setSubmitState(null);
    setSubmitProgress(null);
    void runTests(problem.visibleTests);
  }, [problem, runTests]);

  const handleRunTest = useCallback((testId: string) => {
    if (!problem) return;
    const test = problem.visibleTests.find((t) => String(t.id) === testId);
    if (!test) return;
    setSubmitState(null);
    setSubmitProgress(null);
    void runTests([test]);
  }, [problem, runTests]);

  // ── Real submit ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!problem || !slug) return;
    if (inProgress) return;
    if (running) await interrupt();

    setInProgress(true);
    setSubmitState(null);
    setSubmitProgress(null);
    setConsoleOpen(false);

    try {
      const res = await fetch(`/api/problems/${slug}/tests-for-submit`, { credentials: 'include' });
      if (!res.ok) return;
      const allTests: (ServerTest & { tier: number })[] = await res.json();

      const tierCounts: Record<number, number> = {};
      for (const t of allTests) tierCounts[t.tier] = (tierCounts[t.tier] ?? 0) + 1;

      const tierTestProgress: Record<number, number> = {};
      const submitTests: SubmitTestCase[] = allTests.map((t) => ({
        ordinal: t.ordinal,
        tier: t.tier as 1 | 2 | 3,
        input: t.input,
        expected: t.expected,
      }));

      const progressRunOnce: typeof runOnce = async (code, stdin, tl) => {
        const test = submitTests.find((t) => t.input === stdin);
        if (test) {
          tierTestProgress[test.tier] = (tierTestProgress[test.tier] ?? 0) + 1;
          setSubmitProgress({
            tier: test.tier,
            testN: tierTestProgress[test.tier],
            totalInTier: tierCounts[test.tier] ?? 1,
          });
        }
        return runOnce(code, stdin, tl);
      };

      const result = await runSubmit(codeRef.current, submitTests, progressRunOnce);

      setSubmitProgress(null);

      const verdict: SubmitState = result.verdict === 'ok'
        ? { verdict: 'ok', stars: 3 }
        : { verdict: result.verdict, stars: result.stars, failedTest: result.failedTest, failedTier: result.failedTier };
      setSubmitState(verdict);

      fetch(`/api/problems/${slug}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeRef.current,
          stars: result.stars,
          verdict: result.verdict,
          failed_test: result.verdict !== 'ok' ? result.failedTest : undefined,
          failed_tier: result.verdict !== 'ok' ? result.failedTier : undefined,
        }),
      }).catch(() => {});
    } finally {
      setInProgress(false);
    }
  }, [problem, slug, running, interrupt, inProgress]);

  const submitting = inProgress;

  const railBtn = (active: boolean, onClick?: () => void) => ({
    style: {
      all: 'unset' as const,
      width: 40, height: 40,
      display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
      borderRadius: 8,
      cursor: 'pointer' as const,
      background: active ? theme.railActiveBg : 'transparent',
      color: active ? theme.railIconActive : theme.railIcon,
    },
    onClick,
  });

  if (!problem) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: theme.appBg, color: theme.panelTxtMute, fontFamily: theme.fontUI,
      }}>
        {t('compete.noProblems')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.appBg, overflow: 'hidden' }}>
      {/* Mini rail */}
      <div style={{
        width: 56, background: theme.railBg,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 0', gap: 2, flex: 'none',
      }}>
        <div style={{
          fontFamily: theme.fontMono, fontSize: 18, fontWeight: 800,
          color: theme.railLogo, marginBottom: 12, letterSpacing: -1,
        }}>
          π
        </div>
        <button {...railBtn(true)} title={t('compete.problems')}>
          <Icon name="nodes" size={18} color="currentColor" />
        </button>
        <button {...railBtn(debugOpen)} title="Debug" onClick={() => setDebugOpen((v) => !v)}>
          <Icon name="sparkle" size={18} color="currentColor" />
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Slim header */}
        <div style={{
          height: 48, background: theme.surfacePanel,
          borderBottom: `1px solid ${theme.panelBorder}`,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 10, flex: 'none',
        }}>
          <a href="/" style={{ color: theme.panelTxtMute, fontSize: 12, textDecoration: 'none' }}>
            ← IDE
          </a>
          <span style={{ fontFamily: theme.fontUI, fontSize: 15, fontWeight: 700, color: theme.panelTxt }}>
            {problem.title}
          </span>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: editor + console + debug */}
          <div style={{ flex: '0 0 50%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <CompeteLeft
              code={code}
              onCodeChange={setCode}
              output={output as { kind: string; text?: string }[]}
              running={running || inProgress}
              consoleOpen={consoleOpen}
              onToggleConsole={() => setConsoleOpen((v) => !v)}
              onRun={handleRun}
              onSubmit={handleSubmit}
              submitting={submitting}
              exampleRuns={exampleRuns}
            />
            {debugOpen && debugFrames.length > 0 && (
              <div style={{
                flex: '0 0 220px', borderTop: `1px solid ${theme.panelBorder}`,
                background: theme.surfacePanel, overflowY: 'auto',
              }}>
                <DebugPanel />
              </div>
            )}
          </div>

          {/* Right: problem statement */}
          <div style={{ flex: '0 0 50%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Verdict / progress */}
            {submitProgress && <ProgressBar progress={submitProgress} />}
            {submitState && !submitProgress && (
              <VerdictCard state={submitState} onDismiss={() => setSubmitState(null)} />
            )}

            {/* Statement */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px',
              fontFamily: theme.fontUI, fontSize: 14, color: theme.panelTxt,
              lineHeight: 1.7, background: theme.surfacePanel,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {problem.statement}
              </ReactMarkdown>

              {/* Visible test examples */}
              {problem.visibleTests.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: theme.panelTxtMute }}>
                    {t('compete.runTests')}
                  </div>
                  {problem.visibleTests.map((test) => {
                    const run = exampleRuns.find((r) => r.testId === String(test.id));
                    return (
                      <div key={test.id} style={{
                        border: `1px solid ${run ? (run.passed ? '#10b98166' : '#ef444466') : theme.panelBorder}`,
                        borderRadius: 6, marginBottom: 10,
                        background: theme.surface, overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          padding: '6px 10px',
                          borderBottom: `1px solid ${theme.panelBorder}`,
                          gap: 8,
                        }}>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
                            Test #{test.ordinal}
                          </span>
                          {run && (
                            <span style={{ fontSize: 12, color: run.passed ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                              {run.passed ? '✓ OK' : '✗ WA'}
                            </span>
                          )}
                          <button
                            onClick={() => handleRunTest(String(test.id))}
                            disabled={inProgress}
                            style={{
                              all: 'unset', cursor: inProgress ? 'not-allowed' : 'pointer',
                              fontSize: 11.5, color: theme.accent,
                              padding: '2px 8px', borderRadius: 4,
                              border: `1px solid ${theme.accent}`,
                              opacity: inProgress ? 0.5 : 1,
                            }}
                          >
                            {t('compete.run')}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 0 }}>
                          <div style={{ flex: 1, padding: '8px 10px', borderRight: `1px solid ${theme.panelBorder}` }}>
                            <div style={{ fontSize: 10.5, color: theme.panelTxtMute, marginBottom: 3 }}>Input</div>
                            <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                              {test.input}
                            </pre>
                          </div>
                          <div style={{ flex: 1, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10.5, color: theme.panelTxtMute, marginBottom: 3 }}>
                              {run ? 'Output' : 'Expected'}
                            </div>
                            <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                              {run ? run.stdout : test.expected}
                            </pre>
                          </div>
                        </div>
                        {run && !run.passed && (
                          <div style={{ padding: '4px 10px 8px', borderTop: `1px solid ${theme.panelBorder}` }}>
                            <div style={{ fontSize: 10.5, color: theme.panelTxtMute, marginBottom: 3 }}>Expected</div>
                            <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: '#ef4444', whiteSpace: 'pre-wrap' }}>
                              {test.expected}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
