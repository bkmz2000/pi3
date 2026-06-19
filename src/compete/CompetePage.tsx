import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useThemeStore } from "../state/useTheme";
import { useRunner, useRunnerStore, getWorker } from "../runner/RunnerProvider";
import { Icon } from "../components/Icons";
import CompeteLeft from "./CompeteLeft";
import CompeteProblem from "./CompeteProblem";
import CompeteVisualizer from "./CompeteVisualizer";
import type { Problem, ExampleRun, SubmitState, ProblemTest } from "./types";

const MOCK_PROBLEM: Problem = {
  slug: 'bfs-shortest-path',
  title: 'BFS: Shortest Path',
  difficulty: 2,
  tags: ['graphs', 'BFS', 'shortest path'],
  acceptedPct: 68,
  statement: `## Task

Given an undirected graph with **N** nodes and **M** edges, find the shortest path from node **1** to node **N** using BFS.

### Input

First line: two integers \`N\` and \`M\` (2 ≤ N ≤ 100, 1 ≤ M ≤ 500).

Next M lines: two integers \`u\` and \`v\` — an edge between nodes u and v.

### Output

A single integer — the minimum number of edges on the path from 1 to N, or \`-1\` if no path exists.`,
  visibleTests: [
    { id: 't1', input: '4 4\n1 2\n2 3\n3 4\n1 3\n', expected: '2\n', label: 'Example 1 — simple graph' },
    { id: 't2', input: '2 1\n1 2\n', expected: '1\n', label: 'Example 2 — direct edge' },
    { id: 't3', input: '3 1\n1 2\n', expected: '-1\n', label: 'Example 3 — unreachable' },
  ],
  hiddenTestCount: 22,
  starterCode: `from collections import deque

n, m = map(int, input().split())
graph = [[] for _ in range(n + 1)]
for _ in range(m):
    u, v = map(int, input().split())
    graph[u].append(v)
    graph[v].append(u)

# Your BFS here
`,
};

type ActiveTab = 'problem' | 'visualizer';

export default function CompetePage() {
  const { slug } = useParams<{ slug: string }>();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const savedTheme = useRef(useThemeStore.getState().themeId);

  useEffect(() => {
    savedTheme.current = useThemeStore.getState().themeId;
    setTheme('midnight');
    return () => setTheme(savedTheme.current);
  }, [setTheme]);

  const [problem, setProblem] = useState<Problem>(MOCK_PROBLEM);
  const [code, setCode] = useState(MOCK_PROBLEM.starterCode);
  const [activeTab, setActiveTab] = useState<ActiveTab>('problem');
  const [exampleRuns, setExampleRuns] = useState<ExampleRun[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState | null>(null);
  const [submitProgress, setSubmitProgress] = useState<number | null>(null);

  const { output, running } = useRunner();

  // Fetch real problem if API exists
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/problems/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setProblem(data); })
      .catch(() => {});
  }, [slug]);

  // ── Test runner queue ──
  const testQueue = useRef<ProblemTest[]>([]);
  const capturedResults = useRef<ExampleRun[]>([]);
  const isRunningTests = useRef(false);
  const prevRunning = useRef(false);
  const onFinish = useRef<((results: ExampleRun[]) => void) | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const runNextTest = useCallback(() => {
    if (testQueue.current.length === 0) {
      isRunningTests.current = false;
      const results = [...capturedResults.current];
      setExampleRuns(results);
      onFinish.current?.(results);
      onFinish.current = null;
      return;
    }
    const test = testQueue.current[0];
    // Override _async_input (the async shim input() is compiled to) so it reads
    // from our StringIO instead of waiting for a JS input_response message.
    const injected = `import io as _pi3_io\n_pi3_data = _pi3_io.StringIO(${JSON.stringify(test.input)})\nasync def _async_input(prompt=''):\n    _line = _pi3_data.readline()\n    return _line.rstrip('\\n') if _line else ''\ndel _pi3_io\n${codeRef.current}`;
    useRunnerStore.getState().clear();
    useRunnerStore.getState().setRunning(true);
    getWorker().postMessage({ cmd: 'run', files: { 'solution.py': injected }, assets: {}, entry: 'solution.py' });
  }, []);

  useEffect(() => {
    if (prevRunning.current && !running && isRunningTests.current) {
      const test = testQueue.current.shift();
      if (!test) return;
      // Defer one rAF: RunnerProvider batches stdout via requestAnimationFrame,
      // so the result message fires before the store is updated. Waiting one frame
      // guarantees the flush rAF has already written pending output to the store.
      requestAnimationFrame(() => {
        if (!test) return;
        const currentOutput = useRunnerStore.getState().output;
        const stdout = currentOutput
          .filter(l => l.kind === 'stdout')
          .map(l => (l as { kind: 'stdout'; text: string }).text)
          .join('');
        const passed = stdout.trimEnd() === test.expected.trimEnd();
        capturedResults.current.push({ testId: test.id, stdout, passed });
        runNextTest();
      });
    }
    prevRunning.current = running;
  }, [running, runNextTest]);

  const startRun = useCallback((tests: ProblemTest[], onDone?: (results: ExampleRun[]) => void) => {
    if (isRunningTests.current || running) return;
    testQueue.current = [...tests];
    capturedResults.current = [];
    isRunningTests.current = true;
    onFinish.current = onDone ?? null;
    setExampleRuns([]);
    setConsoleOpen(true);
    runNextTest();
  }, [running, runNextTest]);

  const handleRun = useCallback(() => {
    setSubmitState(null);
    setSubmitProgress(null);
    startRun(problem.visibleTests);
  }, [problem.visibleTests, startRun]);

  const handleRunTest = useCallback((testId: string) => {
    const test = problem.visibleTests.find(t => t.id === testId);
    if (!test) return;
    setSubmitState(null);
    setSubmitProgress(null);
    startRun([test]);
  }, [problem.visibleTests, startRun]);

  const handleSubmit = useCallback(() => {
    if (isRunningTests.current || running) return;
    setSubmitState(null);
    setSubmitProgress(null);
    setActiveTab('problem');

    startRun(problem.visibleTests, (visibleResults) => {
      // Animate hidden test progress
      const hiddenTotal = problem.hiddenTestCount;
      const publicPassed = visibleResults.filter(r => r.passed).length;
      const allPublicPass = publicPassed === visibleResults.length;

      let progress = 0;
      const interval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 18 + 6, 100);
        setSubmitProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          const hiddenPassed = allPublicPass ? Math.floor(hiddenTotal * 0.82) : Math.floor(hiddenTotal * 0.45);
          const verdict = allPublicPass && hiddenPassed > hiddenTotal * 0.7 ? 'accepted' : 'wrong_answer';
          setSubmitState({
            verdict,
            publicResults: visibleResults.map(r => ({ testId: r.testId, passed: r.passed })),
            hiddenPassed,
            hiddenTotal,
          });
          setSubmitProgress(null);
        }
      }, 120);
    });
  }, [problem, startRun, running]);

  const submitting = submitProgress !== null;

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

  return (
    <div style={{ display: 'flex', height: '100vh', background: theme.appBg, overflow: 'hidden' }}>
      {/* Mini Rail */}
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
        <button {...railBtn(true)} title="Contest">
          <Icon name="nodes" size={18} color="currentColor" />
        </button>
        <button {...railBtn(false)} title="Files">
          <Icon name="folder" size={18} color="currentColor" />
        </button>
        <button {...railBtn(false)} title="Participants">
          <Icon name="users" size={18} color="currentColor" />
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
          <span style={{ fontFamily: theme.fontUI, fontSize: 15, fontWeight: 700, color: theme.panelTxt }}>
            {problem.title}
          </span>
          <div style={{ flex: 1 }} />
          {problem.tags.map(tag => (
            <span key={tag} style={{
              padding: '2px 9px', borderRadius: 999,
              background: theme.chip,
              fontFamily: theme.fontUI, fontSize: 11.5, color: theme.panelTxtMute,
            }}>{tag}</span>
          ))}
          <span style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute }}>
            {problem.acceptedPct}% AC
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: editor + console */}
          <div style={{ flex: '0 0 50%', minWidth: 0 }}>
            <CompeteLeft
              code={code}
              onCodeChange={setCode}
              output={output as { kind: string; text?: string }[]}
              running={running}
              consoleOpen={consoleOpen}
              onToggleConsole={() => setConsoleOpen(v => !v)}
              onRun={handleRun}
              onSubmit={handleSubmit}
              submitting={submitting}
              exampleRuns={exampleRuns}
            />
          </div>

          {/* Right: problem / visualizer */}
          <div style={{ flex: '0 0 50%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            <div style={{
              height: 40, background: theme.surfacePanel,
              borderBottom: `1px solid ${theme.panelBorder}`,
              display: 'flex', alignItems: 'end',
              padding: '0 12px', flex: 'none', gap: 0,
            }}>
              {(['problem', 'visualizer'] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '0 14px',
                    height: 36,
                    display: 'flex', alignItems: 'center',
                    fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 600,
                    color: activeTab === tab ? theme.tabActiveTxt : theme.tabInactiveTxt,
                    borderBottom: `2px solid ${activeTab === tab ? theme.accent : 'transparent'}`,
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, background: theme.surfacePanel }}>
              {activeTab === 'problem' ? (
                <CompeteProblem
                  problem={problem}
                  exampleRuns={exampleRuns}
                  submitState={submitState}
                  submitProgress={submitProgress}
                  onRunTest={handleRunTest}
                />
              ) : (
                <CompeteVisualizer />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
