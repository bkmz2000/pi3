import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { useThemeStore } from '../../state/useTheme';
import { competeProfile } from '../../editor/profiles';
import { IconTrash, IconEye, IconEyeOff } from '../Icons';

interface TestDraft {
  tier: 1 | 2 | 3;
  is_visible: boolean;
  input: string;
  expected: string;
}

interface FormState {
  slug: string;
  title: string;
  statement: string;
  starter_code: string;
  order_index: number;
  tests: TestDraft[];
}

function emptyTest(tier: 1 | 2 | 3): TestDraft {
  return { tier, is_visible: tier === 1, input: '', expected: '' };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || '';
}

function validateForm(f: FormState, t: (k: string) => string): string | null {
  if (!f.title.trim()) return t('teacher.validationTitle');
  if (!f.statement.trim()) return t('teacher.validationStatement');
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(f.slug)) return t('teacher.validationBadSlug');
  if (!f.tests.some((tc) => tc.tier === 1)) return t('teacher.validationNoTier1');
  if (!f.tests.some((tc) => tc.is_visible)) return t('teacher.validationNoVisible');
  return null;
}

// ---- Icons ----

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

// ---- Section card ----

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

// ---- Field helpers ----

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ fontSize: 12, color: theme.panelTxtMute, display: 'block', marginBottom: 6 }}>
      {label}
      {required && <span style={{ color: '#ff7a7a', marginLeft: 3 }}>*</span>}
    </div>
  );
}

function FieldInput({
  value,
  onChange,
  onBlur,
  mono,
  prefix,
  type,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  mono?: boolean;
  prefix?: string;
  type?: string;
  min?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    background: theme.surface,
    color: theme.panelTxt,
    border: `0.5px solid ${theme.panelBorder}`,
    borderRadius: 8,
    padding: '9px 11px',
    fontFamily: mono ? theme.fontMono : theme.fontUI,
    fontSize: mono ? 13 : 14,
    outline: 'none',
  };

  if (prefix) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.surface,
        border: `0.5px solid ${theme.panelBorder}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          padding: '9px 11px',
          color: theme.panelTxtMute,
          fontFamily: theme.fontMono,
          fontSize: 13,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          {prefix}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={{ ...base, border: 'none', borderRadius: 0, flex: 1, paddingLeft: 2 }}
        />
      </div>
    );
  }

  return (
    <input
      value={value}
      type={type}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={base}
    />
  );
}

// ---- Visibility badge ----

function VisibilityBadge({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const label = visible ? t('teacher.testShown') : t('teacher.testHidden');
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: theme.fontUI,
        background: visible ? theme.successPill : theme.chip,
        color: visible ? theme.successPillTxt : theme.panelTxtMute,
        flexShrink: 0,
      }}
    >
      {visible
        ? <IconEye size={13} color="currentColor" />
        : <IconEyeOff size={13} color="currentColor" />
      }
      {label}
    </button>
  );
}

// ---- Test case card ----

function TestCaseCard({
  test,
  localIdx,
  onRemove,
  onSetTest,
}: {
  test: TestDraft;
  localIdx: number;
  onRemove: () => void;
  onSetTest: (patch: Partial<TestDraft>) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [hoverRemove, setHoverRemove] = useState(false);

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
      border: `0.5px solid ${theme.panelBorder}`,
      borderRadius: 10,
      marginBottom: 8,
      background: theme.surface,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 11px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
          Test {localIdx + 1}
        </span>
        <div style={{ flex: 1 }} />
        <VisibilityBadge
          visible={test.is_visible}
          onToggle={() => onSetTest({ is_visible: !test.is_visible })}
        />
        <button
          onClick={onRemove}
          aria-label={t('teacher.removeTest')}
          onMouseEnter={() => setHoverRemove(true)}
          onMouseLeave={() => setHoverRemove(false)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 4,
            color: hoverRemove ? '#ff7a7a' : theme.panelTxtMute,
          }}
        >
          <IconTrash size={14} color="currentColor" />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: theme.panelTxtMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 }}>
            {t('teacher.testInput')}
          </div>
          <textarea
            value={test.input}
            onChange={(e) => onSetTest({ input: e.target.value })}
            rows={3}
            style={taStyle}
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
            onChange={(e) => onSetTest({ expected: e.target.value })}
            rows={3}
            style={taStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Tier group ----

function TierGroup({
  tier,
  tierMeaningKey,
  tests,
  onAddTest,
  onRemoveTest,
  onSetTest,
}: {
  tier: 1 | 2 | 3;
  tierMeaningKey: string;
  tests: { test: TestDraft; idx: number }[];
  onAddTest: () => void;
  onRemoveTest: (idx: number) => void;
  onSetTest: (idx: number, patch: Partial<TestDraft>) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {[1, 2, 3].map((i) => <StarIcon key={i} filled={i <= tier} />)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.panelTxt }}>
          {t(`teacher.tier${tier}`)}
        </span>
        <span style={{ fontSize: 11.5, color: theme.panelTxtMute }}>
          {t(tierMeaningKey)}
        </span>
      </div>

      {tests.length === 0 ? (
        <div style={{
          border: `0.5px dashed ${theme.panelBorder}`,
          borderRadius: 10,
          padding: 12,
          textAlign: 'center',
          marginBottom: 8,
          fontSize: 11.5,
          color: theme.panelTxtMute,
        }}>
          {t('teacher.noTestsInTier')}
        </div>
      ) : (
        tests.map(({ test, idx }, localIdx) => (
          <TestCaseCard
            key={idx}
            test={test}
            localIdx={localIdx}
            onRemove={() => onRemoveTest(idx)}
            onSetTest={(patch) => onSetTest(idx, patch)}
          />
        ))
      )}

      <button
        onClick={onAddTest}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          color: theme.primaryBg,
          fontFamily: theme.fontUI,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t('teacher.addTestToTier', { tier })}
      </button>
    </div>
  );
}

// ---- Student preview (right pane) ----

function StudentPreview({
  title,
  statement,
  visibleTests,
}: {
  title: string;
  statement: string;
  visibleTests: TestDraft[];
}) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `0.5px solid ${theme.panelBorder}` }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        background: theme.surfacePanel,
        fontSize: 11,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        color: theme.panelTxtMute,
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.primaryBg, display: 'inline-block', flexShrink: 0 }} />
        Preview · what students see
      </div>

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
        maxHeight: 540,
        overflowY: 'auto',
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
  );
}

// ---- Section icons ----

const IconDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const IconLines = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const IconCode = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>
);

const IconCheckSquare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

// ---- Main component ----

export default function TeacherProblemForm() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const themeId = useThemeStore((s) => s.themeId);
  const fontSize = useThemeStore((s) => s.fontSize);
  const navigate = useNavigate();
  const { slug: editSlug } = useParams<{ slug?: string }>();
  const isNew = !editSlug;

  const [form, setForm] = useState<FormState>({
    slug: '',
    title: '',
    statement: '',
    starter_code: '',
    order_index: 0,
    tests: [emptyTest(1)],
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  const snapshotRef = useRef<string>(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== snapshotRef.current;

  useEffect(() => {
    if (isNew) {
      snapshotRef.current = JSON.stringify(form);
      return;
    }
    fetch(`/api/teacher/problems/${editSlug}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const loaded: FormState = {
          slug: data.slug,
          title: data.title,
          statement: data.statement,
          starter_code: data.starter_code,
          order_index: data.order_index,
          tests: data.tests.map((tc: { tier: number; is_visible: number; input: string; expected: string }) => ({
            tier: tc.tier as 1 | 2 | 3,
            is_visible: Boolean(tc.is_visible),
            input: tc.input,
            expected: tc.expected,
          })),
        };
        setForm(loaded);
        snapshotRef.current = JSON.stringify(loaded);
        setSlugTouched(true);
        setLoaded(true);
      })
      .catch(() => setError('Failed to load problem.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSlug, isNew]);

  useEffect(() => {
    const prev = document.body.style.overflowY;
    document.body.style.overflowY = 'auto';
    return () => { document.body.style.overflowY = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: (!slugTouched && isNew) ? slugify(title) : f.slug,
    }));
  };

  const setTest = (idx: number, patch: Partial<TestDraft>) => {
    setForm((f) => {
      const tests = [...f.tests];
      tests[idx] = { ...tests[idx], ...patch };
      return { ...f, tests };
    });
  };

  const addTest = (tier: 1 | 2 | 3) => {
    setForm((f) => ({ ...f, tests: [...f.tests, emptyTest(tier)] }));
  };

  const removeTest = (idx: number) => {
    setForm((f) => ({ ...f, tests: f.tests.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    const validationError = validateForm(form, t);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSaving(true);
    try {
      const url = isNew ? '/api/teacher/problems' : `/api/teacher/problems/${editSlug}`;
      const method = isNew ? 'POST' : 'PUT';
      const body = { ...form, slug: isNew ? form.slug : editSlug };
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) { setError(t('teacher.slugConflict')); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Save failed');
        return;
      }
      snapshotRef.current = JSON.stringify(form);
      navigate('/teacher/problems');
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => navigate('/teacher/problems');

  const cmTheme = themeId === 'midnight' ? githubDark : githubLight;
  const tierTests = (tier: 1 | 2 | 3) =>
    form.tests.map((test, idx) => ({ test, idx })).filter(({ test }) => test.tier === tier);
  const visibleTests = form.tests.filter((t) => t.is_visible);

  if (!loaded) {
    return <div style={{ padding: 24, fontFamily: theme.fontUI, color: theme.panelTxtMute }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.appBg, fontFamily: theme.fontUI, color: theme.panelTxt }}>

      {/* Sticky topbar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 20px',
        background: `${theme.appBg}ec`,
        backdropFilter: 'blur(6px)',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        <button
          onClick={handleCancel}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: theme.panelTxtMute,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t('teacher.problems')}
        </button>

        <span style={{ width: 1, height: 16, background: theme.panelBorder }} />

        <span style={{ fontSize: 15, fontWeight: 600, color: theme.panelTxt }}>
          {isNew ? t('teacher.newProblem') : t('teacher.editProblem')}
        </span>

        {dirty && (
          <span style={{
            fontSize: 11.5,
            padding: '2px 9px',
            borderRadius: 999,
            background: 'rgba(240,180,41,0.12)',
            color: theme.tabDirty,
          }}>
            {t('teacher.unsavedChanges')}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleCancel}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontSize: 13,
            padding: '7px 15px',
            borderRadius: 8,
            border: `0.5px solid ${theme.panelBorder}`,
            color: theme.panelTxtMute,
            fontFamily: theme.fontUI,
          }}
        >
          {t('teacher.cancel')}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            all: 'unset',
            cursor: saving ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            padding: '7px 15px',
            borderRadius: 8,
            background: saving ? theme.chip : theme.primaryBg,
            color: saving ? theme.panelTxtMute : theme.primaryTxt,
            fontFamily: theme.fontUI,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {!saving && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
          {saving ? t('teacher.savingProblem') : t('teacher.saveProblem')}
        </button>
      </div>

      {/* Two-pane body */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '18px 20px 48px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}>

        {/* Left: authoring form */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(255,77,77,0.13)',
              border: '0.5px solid rgba(255,77,77,0.27)',
              borderRadius: 8,
              color: '#ff7a7a',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Problem details */}
          <SectionCard icon={<IconDoc />} title={t('teacher.problemTitle')} desc="Title and list position">
            <div style={{ marginBottom: 14 }}>
              <FieldLabel label={t('teacher.problemTitle')} required />
              <FieldInput value={form.title} onChange={handleTitleChange} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 2 }}>
                <FieldLabel label={t('teacher.problemSlug')} required />
                <FieldInput
                  value={form.slug}
                  prefix="/compete/"
                  mono
                  onChange={(v) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: v })); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel label={t('teacher.orderIndex')} />
                <FieldInput
                  value={String(form.order_index)}
                  type="number"
                  min={0}
                  onChange={(v) => setForm((f) => ({ ...f, order_index: Number(v) || 0 }))}
                />
              </div>
            </div>
          </SectionCard>

          {/* Statement */}
          <SectionCard icon={<IconLines />} title={t('teacher.problemStatement')} desc="Markdown">
            <textarea
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              rows={8}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                background: theme.surface,
                color: theme.panelTxt,
                border: `0.5px solid ${theme.panelBorder}`,
                borderRadius: 8,
                padding: '9px 11px',
                fontFamily: theme.fontMono,
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </SectionCard>

          {/* Starter code */}
          <SectionCard icon={<IconCode />} title={t('teacher.starterCode')} desc="Pre-filled for students">
            <div style={{ border: `0.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
              <CodeMirror
                value={form.starter_code}
                extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
                onChange={(v) => setForm((f) => ({ ...f, starter_code: v }))}
                height="200px"
              />
            </div>
          </SectionCard>

          {/* Test cases */}
          <SectionCard icon={<IconCheckSquare />} title={t('teacher.testCases', 'Test cases')} desc="Each tier earns a star">
            {([1, 2, 3] as (1 | 2 | 3)[]).map((tier) => (
              <TierGroup
                key={tier}
                tier={tier}
                tierMeaningKey={`teacher.tier${tier}Meaning`}
                tests={tierTests(tier)}
                onAddTest={() => addTest(tier)}
                onRemoveTest={removeTest}
                onSetTest={setTest}
              />
            ))}
          </SectionCard>
        </div>

        {/* Right: sticky student preview */}
        <div style={{ flexShrink: 0, width: 380, position: 'sticky', top: 62 }}>
          <StudentPreview
            title={form.title}
            statement={form.statement}
            visibleTests={visibleTests}
          />
        </div>
      </div>
    </div>
  );
}
