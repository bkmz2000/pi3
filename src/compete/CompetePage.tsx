import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useThemeStore } from "../state/useTheme";
import { useRunner, useRunnerStore, runOnce } from "../runner/RunnerProvider";
import { Icon } from "../components/Icons";
import Rail from "../SideMenu";
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
  const bg = ok ? theme.successPill : `${theme.consoleErr}22`;
  const border = ok ? theme.successPillTxt : theme.consoleErr;
  const color = ok ? theme.successPillTxt : theme.consoleErr;
  return (
    <div style={{
      margin: '12px 16px',
      padding: '14px 16px',
      borderRadius: theme.radiusCard,
      background: bg,
      border: `1px solid ${border}`,
      fontFamily: theme.fontUI,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>
          {ok ? '✅' : '❌'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color }}>
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
          type="button"
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

  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [exampleRuns, setExampleRuns] = useState<ExampleRun[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState | null>(null);
  const [submitProgress, setSubmitProgress] = useState<SubmitProgress | null>(null);
  const [inProgress, setInProgress] = useState(false);

  const { output, interrupt } = useRunner();
  const running = useRunnerStore((s) => s.running);
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
        fieldsJson: (t as { fields_json?: string | null }).fields_json ?? null,
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

      const checkerPy = problem?.checker_py ?? null;
      const result = await runSubmit(codeRef.current, submitTests, progressRunOnce, checkerPy);

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

  const passColor = theme.successPillTxt;
  const failColor = theme.consoleErr;

  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.appBg, overflow: 'hidden' }}>
      {/* Rail — the real IDE rail; Problems panel is already wired in */}
      <Rail />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: editor + console */}
        <CompeteLeft
          code={code}
          onCodeChange={setCode}
          output={output as { kind: string; text?: string; error?: unknown }[]}
          running={running || inProgress}
          consoleOpen={consoleOpen}
          onToggleConsole={() => setConsoleOpen((v) => !v)}
          onRun={handleRun}
          onSubmit={handleSubmit}
          submitting={inProgress}
          exampleRuns={exampleRuns}
        />

        {/* Right: problem statement */}
        <div style={{ flex: '0 0 50%', minWidth: 0, display: 'flex', flexDirection: 'column', background: theme.surfacePanel }}>
          {/* Panel header with problem title */}
          <div style={{
            padding: '12px 20px 10px',
            borderBottom: `1px solid ${theme.panelBorder}`,
            background: theme.panelHeader,
            flex: 'none',
          }}>
            <div style={{ fontFamily: theme.fontUI, fontWeight: theme.weightHeader, fontSize: 16, color: theme.panelTxt }}>
              {problem.title}
            </div>
          </div>

          {/* Verdict / progress */}
          {submitProgress && <ProgressBar progress={submitProgress} />}
          {submitState && !submitProgress && (
            <VerdictCard state={submitState} onDismiss={() => setSubmitState(null)} />
          )}

          {/* Statement */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px',
            fontFamily: theme.fontUI, fontSize: 14, color: theme.panelTxt,
            lineHeight: 1.7,
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {problem.statement}
            </ReactMarkdown>

            {/* Visible test examples */}
            {problem.visibleTests.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  fontFamily: theme.fontUI,
                  fontWeight: 600,
                  fontSize: 11.5,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: theme.panelTxtMute,
                  marginBottom: 10,
                }}>
                  {t('compete.runTests')}
                </div>
                {problem.visibleTests.map((test) => {
                  const run = exampleRuns.find((r) => r.testId === String(test.id));
                  const borderColor = run
                    ? (run.passed ? `${passColor}66` : `${failColor}66`)
                    : theme.panelBorder;
                  return (
                    <div key={test.id} style={{
                      border: `1px solid ${borderColor}`,
                      borderRadius: theme.radiusCard,
                      marginBottom: 10,
                      background: theme.surface,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: '6px 10px',
                        borderBottom: `1px solid ${theme.panelBorder}`,
                        gap: 8,
                      }}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
                          {t('compete.testN', { n: test.ordinal })}
                        </span>
                        {run && (
                          <span style={{ fontSize: 12, color: run.passed ? passColor : failColor, fontWeight: 600 }}>
                            {run.passed ? '✓ OK' : '✗ WA'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRunTest(String(test.id))}
                          disabled={inProgress}
                          style={{
                            all: 'unset', cursor: inProgress ? 'not-allowed' : 'pointer',
                            fontSize: 11.5, color: theme.accent,
                            padding: '2px 8px', borderRadius: theme.radiusCard,
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
                          <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: failColor, whiteSpace: 'pre-wrap' }}>
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
  );
}
