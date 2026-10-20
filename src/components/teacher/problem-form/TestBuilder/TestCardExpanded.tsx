import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../../state/useTheme';
import { IconTrash, IconEye, IconEyeOff } from '../../../Icons';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

interface Props {
  test: TestDraft;
  testIndex: number;
  localIdx: number;
  onSetTest: (idx: number, patch: Partial<TestDraft>) => void;
  onRemove: (idx: number) => void;
  onCollapse: () => void;
}

export default function TestCardExpanded({
  test,
  testIndex,
  localIdx,
  onSetTest,
  onRemove,
  onCollapse,
}: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const taStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    color: theme.panelTxt,
    border: 'none',
    outline: 'none',
    padding: 0,
    fontFamily: theme.fontMono,
    fontSize: 12,
    lineHeight: 1.5,
    resize: 'vertical',
    minHeight: 52,
  };

  return (
    <div style={{
      border: `0.5px solid ${theme.primaryBg}`,
      borderRadius: 8,
      marginBottom: 5,
      background: theme.surface,
      overflow: 'hidden',
      boxShadow: `0 0 0 1px ${theme.primaryBg}40`,
    }}>
      {/* Expanded header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 11px',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
        background: `${theme.primaryBg}0d`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>
          Test {localIdx + 1}
        </span>

        <div style={{ flex: 1 }} />

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() => onSetTest(testIndex, { is_visible: !test.is_visible })}
          aria-label={test.is_visible ? t('teacher.testShown') : t('teacher.testHidden')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: theme.fontUI,
            background: test.is_visible ? theme.successPill : theme.chip,
            color: test.is_visible ? theme.successPillTxt : theme.panelTxtMute,
            flexShrink: 0,
          }}
        >
          {test.is_visible
            ? <IconEye size={11} color="currentColor" />
            : <IconEyeOff size={11} color="currentColor" />
          }
        </button>

        <button
          type="button"
          onClick={() => onRemove(testIndex)}
          aria-label={t('teacher.removeTest')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 3,
            borderRadius: 3,
            color: theme.panelTxtMute,
            flexShrink: 0,
          }}
        >
          <IconTrash size={13} color="currentColor" />
        </button>
      </div>

      {/* Edit areas */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 }}>
            {t('teacher.testInput')}
          </div>
          <textarea
            value={test.input}
            onChange={(e) => onSetTest(testIndex, { input: e.target.value })}
            rows={3}
            style={taStyle}
            autoFocus
          />
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 2px',
          color: theme.primaryBg,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', borderLeft: `0.5px solid ${theme.panelBorder}` }}>
          <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 }}>
            {t('teacher.testExpected')}
          </div>
          <textarea
            value={test.expected}
            onChange={(e) => onSetTest(testIndex, { expected: e.target.value })}
            rows={3}
            style={taStyle}
          />
        </div>
      </div>

      {/* Done button */}
      <div style={{
        padding: '6px 10px',
        borderTop: `0.5px solid ${theme.panelBorder}`,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <button
          type="button"
          onClick={onCollapse}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: 6,
            background: theme.actionBg,
            color: theme.actionTxt,
            fontFamily: theme.fontUI,
          }}
        >
          {t('teacher.done')}
        </button>
      </div>
    </div>
  );
}
