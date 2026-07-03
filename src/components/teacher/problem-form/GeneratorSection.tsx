import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { useThemeStore } from '../../../state/useTheme';
import { competeProfile } from '../../../editor/profiles';
import { IconTrash } from '../../Icons';
import ConsoleView from '../../ConsoleView';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

interface GeneratorError {
  kind: string;
  details: string;
}

function SectionCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{
      background: theme.surfacePanel,
      border: `0.5px solid ${theme.panelBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 15px',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        <span style={{ color: theme.primaryBg, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>{title}</span>
        {desc && (
          <span style={{ fontSize: 11.5, color: theme.panelTxtMute, marginLeft: 'auto', textAlign: 'right' as const }}>
            {desc}
          </span>
        )}
      </div>
      <div style={{ padding: 15 }}>{children}</div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ fontSize: 12, color: theme.panelTxtMute, display: 'block', marginBottom: 6 }}>
      {label}
    </div>
  );
}

const IconCode = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);

interface Props {
  generatorPy: string;
  onChangeGenerator: (v: string) => void;
  generatorRunning: boolean;
  generatorError: GeneratorError | null;
  generatorOutput: string | null;
  generatorPreview: TestDraft[] | null;
  onRunGenerator: () => void;
  onUseGeneratedTests: () => void;
  onRemoveFromPreview: (idx: number) => void;
  problemSlug: string;
}

export default function GeneratorSection({
  generatorPy,
  onChangeGenerator,
  generatorRunning,
  generatorError,
  generatorOutput,
  generatorPreview,
  onRunGenerator,
  onUseGeneratedTests,
  onRemoveFromPreview,
}: Props) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const themeId = useThemeStore((s) => s.themeId);
  const fontSize = useThemeStore((s) => s.fontSize);

  const cmTheme = themeId === 'midnight' ? githubDark : githubLight;

  return (
    <SectionCard icon={<IconCode />} title={t('teacher.generator.title')} desc={t('teacher.generator.desc')}>
      {(generatorError || generatorOutput) && (
        <div style={{ marginBottom: 10 }}>
          <ConsoleView
            label={generatorError ? generatorError.kind : t('teacher.generator.consoleOutput')}
            content={generatorError ? generatorError.details : (generatorOutput ?? '')}
            status={generatorError ? 'error' : undefined}
            maxHeight={240}
          />
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
          <FieldLabel label={t('teacher.generator.label')} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onRunGenerator}
            disabled={generatorRunning || !generatorPy.trim()}
            style={{
              all: 'unset', cursor: generatorRunning || !generatorPy.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 7,
              background: theme.primaryBg, color: theme.primaryTxt,
              opacity: generatorRunning || !generatorPy.trim() ? 0.5 : 1,
            }}
          >
            {generatorRunning ? t('teacher.generator.running') : t('teacher.generator.runButton')}
          </button>
        </div>
        <div style={{ border: `0.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
          <CodeMirror
            value={generatorPy}
            extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
            onChange={onChangeGenerator}
            height="240px"
          />
        </div>
      </div>
      {generatorPreview && (
        <div style={{
          border: `0.5px solid ${theme.panelBorder}`,
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 10px', background: theme.chip,
            borderBottom: `0.5px solid ${theme.panelBorder}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 11.5, color: theme.panelTxtMute, fontWeight: 600 }}>
              {t('teacher.generator.previewCount', { count: generatorPreview.length })}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onUseGeneratedTests}
              style={{
                all: 'unset', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600,
                padding: '3px 10px', borderRadius: 6,
                background: theme.successPill,
                color: theme.successPillTxt,
              }}
            >
              {t('teacher.generator.useTests')}
            </button>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {generatorPreview.map((tc, i) => (
              <div key={i} style={{
                display: 'flex', gap: 0,
                borderBottom: i < generatorPreview.length - 1 ? `0.5px solid ${theme.panelBorder}` : undefined,
              }}>
                <div style={{ width: 70, flexShrink: 0, padding: '6px 8px', borderRight: `0.5px solid ${theme.panelBorder}` }}>
                  <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 2 }}>T{tc.tier} {tc.is_visible ? '👁' : ''}</div>
                  <div style={{ fontSize: 10.5, color: theme.panelTxtMute }}>#{i + 1}</div>
                </div>
                <div style={{ flex: 1, padding: '6px 8px', borderRight: `0.5px solid ${theme.panelBorder}` }}>
                  <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 2 }}>Input</div>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                    {tc.input || '—'}
                  </pre>
                </div>
                <div style={{ flex: 1, padding: '6px 8px', borderRight: `0.5px solid ${theme.panelBorder}` }}>
                  <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 2 }}>Expected</div>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                    {tc.expected || '—'}
                  </pre>
                </div>
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onRemoveFromPreview(i)}
                    aria-label={t('teacher.generator.removeTest')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4,
                      borderRadius: 4,
                      color: theme.panelTxtMute,
                    }}
                  >
                    <IconTrash size={12} color="currentColor" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
