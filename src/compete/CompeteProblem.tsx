import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useThemeStore } from "../state/useTheme";
import type { Problem, ExampleRun, SubmitState } from "./types";

function DifficultyDots({ n }: { n: number }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: 999,
          background: i < n ? theme.accent : theme.chip,
        }} />
      ))}
    </div>
  );
}

function ExampleCard({
  test,
  run,
  onRun,
}: {
  test: { id: string; input: string; expected: string; label?: string };
  run: ExampleRun | undefined;
  onRun: (testId: string) => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  const verdict = run
    ? run.passed
      ? { label: 'Pass', bg: theme.successPill, color: theme.successPillTxt }
      : { label: 'Fail', bg: 'rgba(255,139,139,0.18)', color: '#ff8b8b' }
    : null;

  const monoBox = (content: string) => (
    <pre style={{
      margin: 0,
      padding: '8px 10px',
      background: theme.consoleBg,
      borderRadius: 4,
      fontFamily: theme.fontMono,
      fontSize: 11.5,
      color: theme.consoleTxt,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: 1.5,
      flex: 1,
      minWidth: 0,
    }}>{content}</pre>
  );

  return (
    <div style={{
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      <div style={{
        padding: '6px 12px',
        background: theme.panelHeader,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: theme.fontUI,
        fontSize: 12,
        color: theme.panelTxtMute,
      }}>
        <span>{test.label ?? `Example ${test.id}`}</span>
        <div style={{ flex: 1 }} />
        {verdict && (
          <span style={{ padding: '1px 8px', borderRadius: 999, background: verdict.bg, color: verdict.color, fontSize: 11, fontWeight: 600 }}>
            {verdict.label}
          </span>
        )}
        <button
          type="button"
          onClick={() => onRun(test.id)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: theme.accent,
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          ▶ Run this
        </button>
      </div>

      <div style={{ padding: 10, display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: theme.fontUI, fontSize: 10.5, color: theme.panelTxtMute, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Input</div>
          {monoBox(test.input)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: theme.fontUI, fontSize: 10.5, color: theme.panelTxtMute, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Expected</div>
          {monoBox(test.expected)}
        </div>
        {run && !run.passed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: theme.fontUI, fontSize: 10.5, color: '#ff8b8b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Got</div>
            {monoBox(run.stdout || '(no output)')}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitResults({ state }: { state: SubmitState }) {
  const theme = useThemeStore((s) => s.theme);
  const accepted = state.verdict === 'accepted';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        padding: '10px 14px',
        borderRadius: 6,
        background: accepted ? theme.successPill : 'rgba(255,139,139,0.12)',
        border: `1px solid ${accepted ? theme.successPillTxt : '#ff8b8b'}`,
        marginBottom: 10,
        fontFamily: theme.fontUI,
        fontSize: 14,
        fontWeight: 700,
        color: accepted ? theme.successPillTxt : '#ff8b8b',
      }}>
        {accepted ? '✓ Accepted' : '✗ Wrong Answer'}
      </div>

      <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginBottom: 6 }}>
        Public tests: {state.publicResults.filter(r => r.passed).length} / {state.publicResults.length}
      </div>

      <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginBottom: 4 }}>
        Hidden tests: {state.hiddenPassed} / {state.hiddenTotal}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(25, 1fr)',
        gap: 2,
        marginBottom: 12,
      }}>
        {Array.from({ length: state.hiddenTotal }, (_, i) => (
          <div key={i} style={{
            height: 6,
            borderRadius: 1,
            background: i < state.hiddenPassed ? theme.successPillTxt : '#ff8b8b',
          }} />
        ))}
      </div>

      {accepted && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 6,
          background: theme.chip,
          fontFamily: theme.fontUI,
          fontSize: 12,
          color: theme.panelTxtMute,
        }}>
          🎉 Great solution! All tests passed.
        </div>
      )}
    </div>
  );
}

export default function CompeteProblem({
  problem,
  exampleRuns,
  submitState,
  submitProgress,
  onRunTest,
}: {
  problem: Problem;
  exampleRuns: ExampleRun[];
  submitState: SubmitState | null;
  submitProgress: number | null;
  onRunTest: (testId: string) => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  const mdComponents = {
    code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
      const isBlock = className?.startsWith('language-');
      return isBlock ? (
        <pre style={{ background: theme.consoleBg, borderRadius: 4, padding: '8px 12px', overflow: 'auto', marginBottom: 10 }}>
          <code style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.consoleTxt }} {...props}>{children}</code>
        </pre>
      ) : (
        <code style={{ fontFamily: theme.fontMono, fontSize: 12.5, background: theme.chip, padding: '1px 5px', borderRadius: 3, color: theme.panelTxt }} {...props}>{children}</code>
      );
    },
    p({ children }: React.ComponentPropsWithoutRef<'p'>) {
      return <p style={{ marginBottom: 10, lineHeight: 1.6 }}>{children}</p>;
    },
    h2({ children }: React.ComponentPropsWithoutRef<'h2'>) {
      return <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, marginTop: 14, color: theme.panelTxt }}>{children}</h2>;
    },
    h3({ children }: React.ComponentPropsWithoutRef<'h3'>) {
      return <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, marginTop: 10, color: theme.panelTxt }}>{children}</h3>;
    },
  };

  const runForTest = (id: string) => exampleRuns.find(r => r.testId === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: `1px solid ${theme.panelBorder}`,
        flex: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: theme.fontUI, fontSize: 20, fontWeight: 700, color: theme.panelTxt }}>
            {problem.title}
          </span>
          <span style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute }}>
            {problem.acceptedPct}% accepted
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DifficultyDots n={problem.difficulty} />
          {problem.tags.map(tag => (
            <span key={tag} style={{
              padding: '1px 8px', borderRadius: 999,
              background: theme.chip,
              fontFamily: theme.fontUI, fontSize: 11, color: theme.panelTxtMute,
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '14px 16px',
        fontFamily: theme.fontUI,
        fontSize: 13,
        color: theme.panelTxt,
      }}>
        {submitState && <SubmitResults state={submitState} />}

        {submitProgress !== null && submitState === null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginBottom: 6 }}>
              Checking hidden tests…
            </div>
            <div style={{ height: 6, background: theme.chip, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 3,
                background: theme.accent,
                width: `${submitProgress}%`,
                transition: 'width 0.1s',
              }} />
            </div>
          </div>
        )}

        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {problem.statement}
        </ReactMarkdown>

        <div style={{ fontFamily: theme.fontUI, fontSize: 13, fontWeight: 600, color: theme.panelTxt, marginBottom: 8, marginTop: 4 }}>
          Examples
        </div>
        {problem.visibleTests.map(test => (
          <ExampleCard
            key={test.id}
            test={test}
            run={runForTest(test.id)}
            onRun={onRunTest}
          />
        ))}
      </div>
    </div>
  );
}
