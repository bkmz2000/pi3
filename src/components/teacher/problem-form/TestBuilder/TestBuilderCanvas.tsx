import { useState, useRef, useEffect } from 'react';
import TierColumn from './TierColumn';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

interface Props {
  tests: TestDraft[];
  expandedIndex: number | null;
  onSetExpanded: (idx: number | null) => void;
  onSetTest: (idx: number, patch: Partial<TestDraft>) => void;
  onRemoveTest: (idx: number) => void;
  onAddTest: (tier: 1 | 2 | 3) => void;
  onChangeTier: (testIndex: number, newTier: 1 | 2 | 3, insertIndex: number) => void;
  onReorder: (tier: 1 | 2 | 3, fromIndex: number, toIndex: number) => void;
  dragoverTier: 1 | 2 | 3 | null;
  setDragoverTier: (t: 1 | 2 | 3 | null) => void;
  onDragStart: (testIndex: number) => void;
  onDragEnd: () => void;
  dragTestIndex: number | null;
}

export default function TestBuilderCanvas({
  tests,
  expandedIndex,
  onSetExpanded,
  onSetTest,
  onRemoveTest,
  onAddTest,
  onChangeTier,
  onReorder,
  dragoverTier,
  setDragoverTier,
  onDragStart,
  onDragEnd,
  dragTestIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  // Track window width for responsive layout
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const isNarrow = windowWidth < 900;

  const tierTests = (tier: 1 | 2 | 3) =>
    tests
      .map((test, idx) => ({ test, idx }))
      .filter(({ test }) => test.tier === tier);

  return (
    <div ref={containerRef}>
      {isNarrow ? (
        // Stacked accordion-style for narrow screens
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([1, 2, 3] as (1 | 2 | 3)[]).map((tier) => (
            <TierColumn
              key={tier}
              tier={tier}
              tests={tierTests(tier)}
              expandedIndex={expandedIndex}
              onSetExpanded={onSetExpanded}
              onSetTest={onSetTest}
              onRemoveTest={onRemoveTest}
              onAddTest={onAddTest}
              droppable
              isDragOver={dragoverTier === tier}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragoverTier(tier);
              }}
              onDragLeave={() => setDragoverTier(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragoverTier(null);
                const fromIdxStr = e.dataTransfer.getData('text/plain');
                if (!fromIdxStr) return;
                const fromIdx = parseInt(fromIdxStr, 10);
                if (isNaN(fromIdx)) return;
                const fromTest = tests[fromIdx];
                if (!fromTest) return;
                const existingInTier = tierTests(tier);
                if (fromTest.tier === tier) return; // same tier, handled differently
                onChangeTier(fromIdx, tier, existingInTier.length);
                onDragEnd();
              }}
            />
          ))}
        </div>
      ) : (
        // 3-column layout for wide screens
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          minWidth: 0,
        }}>
          {([1, 2, 3] as (1 | 2 | 3)[]).map((tier) => (
            <TierColumn
              key={tier}
              tier={tier}
              tests={tierTests(tier)}
              expandedIndex={expandedIndex}
              onSetExpanded={onSetExpanded}
              onSetTest={onSetTest}
              onRemoveTest={onRemoveTest}
              onAddTest={onAddTest}
              droppable
              isDragOver={dragoverTier === tier}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragoverTier(tier);
              }}
              onDragLeave={() => setDragoverTier(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragoverTier(null);
                const fromIdxStr = e.dataTransfer.getData('text/plain');
                if (!fromIdxStr) return;
                const fromIdx = parseInt(fromIdxStr, 10);
                if (isNaN(fromIdx)) return;
                const fromTest = tests[fromIdx];
                if (!fromTest) return;
                const existingInTier = tierTests(tier);
                if (fromTest.tier === tier) return;
                onChangeTier(fromIdx, tier, existingInTier.length);
                onDragEnd();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
