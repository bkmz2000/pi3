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
  onExpand: () => void;
  onSetTest: (idx: number, patch: Partial<TestDraft>) => void;
  onRemove: (idx: number) => void;
  isExpanded: boolean;
}

function truncate(s: string, maxLen: number): string {
  if (!s) return '—';
  const collapsed = s.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen) + '…';
}

export default function TestCard({
  test,
  testIndex,
  localIdx,
  onExpand,
  onSetTest,
  onRemove,
  isExpanded,
}: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(testIndex));
        e.dataTransfer.effectAllowed = 'move';
        // Set a simple drag ghost
        const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
        ghost.style.opacity = '0.6';
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
      }}
      onClick={onExpand}
      style={{
        border: `0.5px solid ${theme.panelBorder}`,
        borderRadius: 8,
        marginBottom: 5,
        background: theme.surface,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 1px ${theme.panelBorder}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* Drag handle */}
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            color: theme.panelTxtMute,
            cursor: 'grab',
            padding: '2px 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          title={t('teacher.dragToReorder')}
        >
          <span style={{ display: 'block', letterSpacing: -2 }}>⋮⋮</span>
        </span>

        <span style={{ fontSize: 11, fontWeight: 600, color: theme.panelTxt }}>
          Test {localIdx + 1}
        </span>

        <div style={{ flex: 1 }} />

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetTest(testIndex, { is_visible: !test.is_visible });
          }}
          aria-label={test.is_visible ? t('teacher.testShown') : t('teacher.testHidden')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 6px',
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

        {/* Remove */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(testIndex);
          }}
          aria-label={t('teacher.removeTest')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 3,
            color: theme.panelTxtMute,
            flexShrink: 0,
          }}
        >
          <IconTrash size={12} color="currentColor" />
        </button>
      </div>

      {/* Card body — truncated preview */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '6px 8px' }}>
          <div style={{ fontSize: 9, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            {t('teacher.testInput')}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: theme.fontMono,
            color: theme.panelTxt,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {truncate(test.input, 30)}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          color: theme.primaryBg,
          flexShrink: 0,
          padding: '0 1px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
        <div style={{ flex: 1, padding: '6px 8px', borderLeft: `0.5px solid ${theme.panelBorder}` }}>
          <div style={{ fontSize: 9, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            {t('teacher.testExpected')}
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: theme.fontMono,
            color: theme.panelTxt,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {truncate(test.expected, 30)}
          </div>
        </div>
      </div>
    </div>
  );
}
