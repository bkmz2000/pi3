import { useState, useEffect, useRef } from 'react';
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

// ---- Sub-components ----

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <fieldset style={{
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 10,
      padding: '0 20px 20px',
      marginBottom: 20,
      background: theme.surfacePanel,
      minWidth: 0,
    }}>
      <legend style={{
        padding: '0 8px',
        fontSize: 11,
        fontWeight: 700,
        color: theme.panelTxtMute,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        fontFamily: theme.fontUI,
      }}>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 4 }}>
      {label}
      {required && <span style={{ color: '#e05c5c', marginLeft: 3 }}>*</span>}
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
  const inputStyle = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box' as const,
    background: theme.surface,
    color: theme.panelTxt,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 6,
    padding: '7px 10px',
    fontFamily: mono ? theme.fontMono : theme.fontUI,
    fontSize: 13,
    outline: 'none',
  };

  if (prefix) {
    return (
      <div style={{
        display: 'flex', alignItems: 'stretch',
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 6, overflow: 'hidden',
        background: theme.surface,
      }}>
        <span style={{
          display: 'flex', alignItems: 'center',
          padding: '7px 10px',
          background: theme.chip,
          color: theme.panelTxtMute,
          fontFamily: theme.fontMono,
          fontSize: 12,
          borderRight: `1px solid ${theme.panelBorder}`,
          whiteSpace: 'nowrap' as const,
          userSelect: 'none' as const,
        }}>
          {prefix}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }}
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
      style={inputStyle}
    />
  );
}

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
        gap: 4,
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: theme.fontUI,
        background: visible ? theme.successPill : theme.chip,
        color: visible ? theme.successPillTxt : theme.panelTxtMute,
        border: `1px solid ${visible ? 'rgba(52,168,83,0.3)' : theme.panelBorder}`,
        flexShrink: 0,
      }}
    >
      {visible
        ? <IconEye size={11} color="currentColor" />
        : <IconEyeOff size={11} color="currentColor" />
      }
      {label}
    </button>
  );
}

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

  const cellStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  };
  const textareaStyle = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box' as const,
    background: theme.surface,
    color: theme.panelTxt,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 5,
    padding: '6px 8px',
    fontFamily: theme.fontMono,
    fontSize: 12,
    resize: 'vertical' as const,
    flex: 1,
    minHeight: 64,
  };

  return (
    <div style={{
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 8,
      marginBottom: 8,
      background: theme.surface,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: theme.chip,
        borderBottom: `1px solid ${theme.panelBorder}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute, flex: 1 }}>
          {t('teacher.tier')} {test.tier} · #{localIdx + 1}
        </span>
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
            color: hoverRemove ? '#e05c5c' : theme.panelTxtMute,
            background: hoverRemove ? 'rgba(224,92,92,0.10)' : 'transparent',
          }}
        >
          <IconTrash size={14} color="currentColor" />
        </button>
      </div>

      {/* Input → Output body */}
      <div style={{ display: 'flex', gap: 0, padding: 12, alignItems: 'stretch' }}>
        <div style={cellStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 4 }}>
            {t('teacher.testInput')}
          </div>
          <textarea
            value={test.input}
            onChange={(e) => onSetTest({ input: e.target.value })}
            rows={3}
            style={textareaStyle}
          />
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          color: theme.primaryBg,
          fontSize: 16,
          fontWeight: 700,
          alignSelf: 'center',
          marginTop: 16,
        }}>
          →
        </div>
        <div style={cellStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 4 }}>
            {t('teacher.testExpected')}
          </div>
          <textarea
            value={test.expected}
            onChange={(e) => onSetTest({ expected: e.target.value })}
            rows={3}
            style={textareaStyle}
          />
        </div>
      </div>
    </div>
  );
}

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

  const filledStars = '★'.repeat(tier);
  const emptyStars = '☆'.repeat(3 - tier);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Tier header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 16, letterSpacing: 1, lineHeight: 1 }}>
          <span style={{ color: theme.primaryBg }}>{filledStars}</span>
          <span style={{ color: theme.panelBorder }}>{emptyStars}</span>
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.panelTxt }}>
            {t(`teacher.tier${tier}`)}
          </div>
          <div style={{ fontSize: 11, color: theme.panelTxtMute }}>
            {t(tierMeaningKey)}
          </div>
        </div>
      </div>

      {/* Tests list or empty placeholder */}
      {tests.length === 0 ? (
        <div style={{
          border: `2px dashed ${theme.panelBorder}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 8,
          color: theme.panelTxtMute,
          fontSize: 12,
          textAlign: 'center' as const,
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

      {/* Per-tier add button */}
      <button
        onClick={onAddTest}
        style={{
          all: 'unset',
          cursor: 'pointer',
          fontSize: 12,
          color: theme.primaryBg,
          padding: '4px 0',
          fontFamily: theme.fontUI,
          fontWeight: 600,
        }}
      >
        + {t('teacher.addTestToTier', { tier })}
      </button>
    </div>
  );
}

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
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  // Dirty tracking: snapshot form after load
  const snapshotRef = useRef<string>(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== snapshotRef.current;

  // Load existing problem for edit mode
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

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
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

  const handleCancel = () => {
    navigate('/teacher/problems');
  };

  const cmTheme = themeId === 'midnight' ? githubDark : githubLight;

  const tierTests = (tier: 1 | 2 | 3) =>
    form.tests.map((test, idx) => ({ test, idx })).filter(({ test }) => test.tier === tier);

  if (!loaded) {
    return <div style={{ padding: 24, fontFamily: theme.fontUI, color: theme.panelTxtMute }}>Loading…</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.appBg,
      fontFamily: theme.fontUI,
      color: theme.panelTxt,
    }}>
      {/* Sticky action bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: theme.surfacePanel,
        borderBottom: `1px solid ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 24px',
      }}>
        <button
          onClick={handleCancel}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
        >
          ← {t('teacher.problems')}
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.panelTxt }}>
          {isNew ? t('teacher.newProblem') : t('teacher.editProblem')}
        </span>
        {dirty && (
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 20,
            background: 'rgba(245,158,11,0.15)',
            color: theme.tabDirty,
            fontWeight: 600,
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
            padding: '7px 16px',
            borderRadius: 6,
            background: theme.chip,
            color: theme.panelTxt,
            fontSize: 13,
            fontWeight: 600,
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
            padding: '7px 18px',
            borderRadius: 6,
            background: saving ? theme.chip : theme.primaryBg,
            color: saving ? theme.panelTxtMute : theme.primaryTxt,
            fontSize: 13,
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? t('teacher.savingProblem') : t('teacher.saveProblem')}
        </button>
      </div>

      {/* Form body */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px', boxSizing: 'border-box' as const }}>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 16,
            background: '#ff4d4d22', border: '1px solid #ff4d4d44',
            borderRadius: 6, color: '#ff6b6b', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Problem details */}
        <FormSection title={t('teacher.problemTitle')}>
          <div style={{ marginTop: 12 }}>
            <FieldLabel label={t('teacher.problemTitle')} required />
            <FieldInput
              value={form.title}
              onChange={handleTitleChange}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <div style={{ flex: 2 }}>
              <FieldLabel label={t('teacher.problemSlug')} required />
              <FieldInput
                value={form.slug}
                prefix="/compete/"
                mono
                onChange={(v) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: v })); }}
              />
              <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 4 }}>
                {t('teacher.problemSlugHint')}
              </div>
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
        </FormSection>

        {/* Statement */}
        <FormSection title={t('teacher.problemStatement')}>
          {/* Write / Preview segmented control */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, marginBottom: 10 }}>
            {(['write', 'preview'] as const).map((tab) => {
              const active = tab === (preview ? 'preview' : 'write');
              return (
                <button
                  key={tab}
                  onClick={() => setPreview(tab === 'preview')}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '5px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: theme.fontUI,
                    background: active ? theme.primaryBg : theme.chip,
                    color: active ? theme.primaryTxt : theme.panelTxtMute,
                    borderRadius: tab === 'write' ? '6px 0 0 6px' : '0 6px 6px 0',
                    border: `1px solid ${theme.panelBorder}`,
                    borderRight: tab === 'write' ? 'none' : undefined,
                  }}
                >
                  {tab === 'write' ? t('teacher.write') : t('teacher.problemPreview')}
                </button>
              );
            })}
          </div>
          {preview ? (
            <div style={{
              minHeight: 120, padding: 12,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 6, background: theme.surface,
              color: theme.panelTxt, fontSize: 14,
              lineHeight: 1.6,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {form.statement || '_No content yet_'}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              rows={10}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box' as const,
                background: theme.surface, color: theme.panelTxt,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 6, padding: '8px 10px',
                fontFamily: theme.fontMono, fontSize: 13, resize: 'vertical' as const,
              }}
            />
          )}
        </FormSection>

        {/* Starter code */}
        <FormSection title={t('teacher.starterCode')}>
          <div style={{ marginTop: 12, border: `1px solid ${theme.panelBorder}`, borderRadius: 6, overflow: 'hidden' }}>
            <CodeMirror
              value={form.starter_code}
              extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
              onChange={(v) => setForm((f) => ({ ...f, starter_code: v }))}
              height="200px"
            />
          </div>
        </FormSection>

        {/* Test cases */}
        <FormSection title={t('teacher.tier').toUpperCase() + 'S'}>
          <div style={{ marginTop: 12 }}>
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
          </div>
        </FormSection>
      </div>
    </div>
  );
}
