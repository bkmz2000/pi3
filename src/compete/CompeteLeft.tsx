import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { useThemeStore } from "../state/useTheme";
import { ErrorCard } from "../components/ConsolePanel";
import type { ExampleRun } from "./types";
import type { RuntimeError } from "../runner/WorkerInterface";

const CM_EXTENSIONS = [
  python(),
  EditorView.lineWrapping,
];

function BlinkDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: 999,
      background: color, display: 'inline-block',
      animation: `pi3blink 1s ease-in-out ${delay}s infinite`,
    }} />
  );
}

export default function CompeteLeft({
  code,
  onCodeChange,
  output,
  running,
  consoleOpen,
  onToggleConsole,
  onRun,
  onSubmit,
  submitting,
  exampleRuns,
}: {
  code: string;
  onCodeChange: (v: string) => void;
  output: { kind: string; text?: string; error?: unknown }[];
  running: boolean;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  onRun: () => void;
  onSubmit: () => void;
  submitting: boolean;
  exampleRuns: ExampleRun[];
}) {
  const theme = useThemeStore((s) => s.theme);
  const themeId = useThemeStore((s) => s.themeId);
  const { t } = useTranslation();
  const cmTheme = themeId === 'midnight' ? githubDark : githubLight;
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [output, consoleOpen]);

  const passCount = exampleRuns.filter(r => r.passed).length;
  const allPass = exampleRuns.length > 0 && passCount === exampleRuns.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 50%', minWidth: 0, borderRight: `1px solid ${theme.panelBorder}` }}>
      {/* Toolbar */}
      <div style={{
        height: 40,
        background: theme.surfacePanel,
        borderBottom: `1px solid ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        flex: 'none',
      }}>
        <span style={{
          padding: '1px 7px', borderRadius: theme.radiusCard,
          background: theme.successPill,
          fontFamily: theme.fontMono, fontSize: 10.5,
          color: theme.successPillTxt, fontWeight: 700,
        }}>
          Python
        </span>
        <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.panelTxtMute }}>
          {t('compete.solutionPy')}
        </span>
        <div style={{ flex: 1 }} />

        {exampleRuns.length > 0 && (
          <span style={{
            padding: '1px 8px', borderRadius: 999,
            background: allPass ? theme.successPill : `${theme.consoleErr}22`,
            color: allPass ? theme.successPillTxt : theme.consoleErr,
            fontFamily: theme.fontUI, fontSize: 11, fontWeight: 600,
          }}>
            {passCount}/{exampleRuns.length}
          </span>
        )}

        <button
          type="button"
          onClick={onRun}
          disabled={running || submitting}
          style={{
            all: 'unset',
            cursor: running || submitting ? 'default' : 'pointer',
            padding: '4px 14px',
            borderRadius: theme.radiusButton,
            background: theme.runBg,
            color: theme.runTxt,
            fontFamily: theme.fontUI,
            fontSize: 12.5,
            fontWeight: 700,
            opacity: running || submitting ? 0.6 : 1,
          }}
        >
          {running ? t('compete.running') : t('compete.run')}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={running || submitting}
          style={{
            all: 'unset',
            cursor: running || submitting ? 'default' : 'pointer',
            padding: '4px 14px',
            borderRadius: theme.radiusButton,
            background: theme.submitBg,
            color: theme.submitTxt,
            fontFamily: theme.fontUI,
            fontSize: 12.5,
            fontWeight: 700,
            opacity: running || submitting ? 0.6 : 1,
          }}
        >
          {submitting ? t('compete.submitting') : t('compete.submit')}
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CodeMirror
          ref={cmRef}
          value={code}
          onChange={onCodeChange}
          theme={cmTheme}
          extensions={CM_EXTENSIONS}
          height="100%"
          width="100%"
          style={{ height: '100%' }}
        />
      </div>

      {/* Console strip */}
      <div style={{
        flex: 'none',
        borderTop: `1px solid ${theme.consoleBorder}`,
        background: theme.consoleBg,
        height: consoleOpen ? 140 : 32,
        transition: 'height 0.15s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div
          style={{
            height: 32,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: consoleOpen ? `1px solid ${theme.consoleBorder}` : 'none',
            cursor: 'pointer',
            flex: 'none',
          }}
          onClick={onToggleConsole}
        >
          <span style={{
            fontFamily: theme.fontUI,
            fontSize: 11.5,
            fontWeight: 600,
            color: theme.consoleTxtMute,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {t('compete.console')}
          </span>
          {running && (
            <span style={{ display: 'inline-flex', gap: 3 }}>
              <BlinkDot color={theme.consoleInfo} />
              <BlinkDot color={theme.consoleInfo} delay={0.2} />
              <BlinkDot color={theme.consoleInfo} delay={0.4} />
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ color: theme.consoleTxtMute, fontSize: 10 }}>
            {consoleOpen ? '▾' : '▴'}
          </span>
        </div>

        {consoleOpen && (
          <div style={{
            flex: 1, overflow: 'auto',
            padding: '6px 12px',
            fontFamily: theme.fontMono,
            fontSize: 12,
            color: theme.consoleTxt,
            lineHeight: 1.5,
          }}>
            {output.map((line, i) => {
              if (line.kind === 'error_card') {
                return <ErrorCard key={i} error={line.error as RuntimeError} />;
              }
              return (
                <div key={i} style={{ color: line.kind === 'stderr' ? theme.consoleErr : theme.consoleTxt, whiteSpace: 'pre-wrap' }}>
                  {line.text}
                </div>
              );
            })}
            {output.length === 0 && !running && (
              <span style={{ color: theme.consoleTxtMute }}>{t('compete.noOutput')}</span>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
