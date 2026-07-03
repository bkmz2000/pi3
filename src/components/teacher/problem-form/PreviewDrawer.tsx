import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { SafeLink } from '../../SafeLink';
import { useThemeStore } from '../../../state/useTheme';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

interface Props {
  title: string;
  statement: string;
  visibleTests: TestDraft[];
  onClose: () => void;
}

export default function PreviewDrawer({
  title,
  statement,
  visibleTests,
  onClose,
}: Props) {
  const theme = useThemeStore((s) => s.theme);

  // Close on Escape
  if (typeof window !== 'undefined') {
    const prevHandler = (window as any).__previewEscapeHandler;
    if (prevHandler) window.removeEventListener('keydown', prevHandler);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    (window as any).__previewEscapeHandler = handler;
    window.addEventListener('keydown', handler);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 99,
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        maxWidth: '90vw',
        zIndex: 100,
        background: theme.surfacePanel,
        borderLeft: `0.5px solid ${theme.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Drawer header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: `0.5px solid ${theme.panelBorder}`,
          flexShrink: 0,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.primaryBg, display: 'inline-block', flexShrink: 0 }} />
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            color: theme.panelTxtMute,
          }}>
            Preview · what students see
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 18,
              color: theme.panelTxtMute,
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: theme.fontUI,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{
            padding: '12px 18px 10px',
            borderBottom: `1px solid ${theme.panelBorder}`,
            background: theme.chip,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: theme.panelTxt }}>
              {title || 'Untitled'}
            </div>
          </div>

          <div style={{
            padding: '15px 18px',
            fontSize: 13.5,
            lineHeight: 1.7,
            color: theme.panelTxt,
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ a: SafeLink }}>
              {statement || '_No statement yet._'}
            </ReactMarkdown>

            {visibleTests.length > 0 && (
              <>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: theme.panelTxtMute,
                  margin: '18px 0 10px',
                }}>
                  Examples
                </div>
                {visibleTests.map((test, i) => (
                  <div key={i} style={{
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 8,
                    marginBottom: 10,
                    background: theme.surface,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderBottom: `1px solid ${theme.panelBorder}`,
                      gap: 8,
                    }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
                        Test {i + 1}
                      </span>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ flex: 1, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 3 }}>Input</div>
                        <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                          {test.input || '—'}
                        </pre>
                      </div>
                      <div style={{ flex: 1, padding: '8px 10px', borderLeft: `1px solid ${theme.panelBorder}` }}>
                        <div style={{ fontSize: 10, color: theme.panelTxtMute, marginBottom: 3 }}>Expected</div>
                        <pre style={{ margin: 0, fontSize: 12, fontFamily: theme.fontMono, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>
                          {test.expected || '—'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Slide-in keyframe injected once */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
