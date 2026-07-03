import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../../state/useTheme';
import TestCard from './TestCard';
import TestCardExpanded from './TestCardExpanded';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" style={{ display: 'block' }}>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
        fill={filled ? '#f0b429' : '#6f8a90'}
        opacity={filled ? 1 : 0.45}
      />
    </svg>
  );
}

interface Props {
  tier: 1 | 2 | 3;
  tests: { test: TestDraft; idx: number }[];
  expandedIndex: number | null;
  onSetExpanded: (idx: number | null) => void;
  onSetTest: (idx: number, patch: Partial<TestDraft>) => void;
  onRemoveTest: (idx: number) => void;
  onAddTest: (tier: 1 | 2 | 3) => void;
  // Drop zone props
  droppable?: boolean;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

export default function TierColumn({
  tier,
  tests,
  expandedIndex,
  onSetExpanded,
  onSetTest,
  onRemoveTest,
  onAddTest,
  droppable,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const tierLabelKey = `teacher.tier${tier}` as const;
  const tierMeaningKey = `teacher.tier${tier}Meaning` as const;

  return (
    <div style={{
      background: isDragOver
        ? `${theme.primaryBg}0a`
        : theme.surfacePanel,
      border: `0.5px solid ${isDragOver ? theme.primaryBg : theme.panelBorder}`,
      borderRadius: 10,
      overflow: 'hidden',
      minHeight: 120,
      transition: 'background 0.15s, border-color 0.15s',
    }}>
      {/* Tier header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {[1, 2, 3].map((i) => <StarIcon key={i} filled={i <= tier} />)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>
          {t(tierLabelKey)}
        </span>
        <span style={{ fontSize: 11, color: theme.panelTxtMute }}>
          {t(tierMeaningKey)}
        </span>
        <span style={{
          fontSize: 11,
          marginLeft: 'auto',
          color: theme.panelTxtMute,
          background: theme.chip,
          padding: '1px 7px',
          borderRadius: 999,
        }}>
          {tests.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{ padding: '8px 8px 4px', minHeight: 60 }}
        {...(droppable ? {
          onDragOver,
          onDragLeave,
          onDrop,
        } : {})}
      >
        {tests.length === 0 && !isDragOver ? (
          <div style={{
            padding: '16px 8px',
            textAlign: 'center',
            fontSize: 11.5,
            color: theme.panelTxtMute,
            fontStyle: 'italic',
          }}>
            {t('teacher.dropTestsHere')}
          </div>
        ) : (
          tests.map(({ test, idx }, localIdx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div key={idx}>
                {isExpanded ? (
                  <TestCardExpanded
                    test={test}
                    testIndex={idx}
                    localIdx={localIdx}
                    onSetTest={onSetTest}
                    onRemove={onRemoveTest}
                    onCollapse={() => onSetExpanded(null)}
                  />
                ) : (
                  <TestCard
                    test={test}
                    testIndex={idx}
                    localIdx={localIdx}
                    onExpand={() => onSetExpanded(idx)}
                    onSetTest={onSetTest}
                    onRemove={onRemoveTest}
                    isExpanded={false}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add button */}
      <div style={{ padding: '4px 8px 8px' }}>
        <button
          type="button"
          onClick={() => onAddTest(tier)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            width: '100%',
            padding: '7px 0',
            borderRadius: 7,
            border: `0.5px dashed ${theme.panelBorder}`,
            fontSize: 12,
            color: theme.primaryBg,
            fontFamily: theme.fontUI,
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${theme.primaryBg}0d`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('teacher.addTestToTier', { tier })}
        </button>
      </div>
    </div>
  );
}
