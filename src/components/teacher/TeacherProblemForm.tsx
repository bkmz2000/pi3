import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { SafeLink } from '../SafeLink';
import { runGenerator, runReference, runChecker } from '../../runner/RunnerProvider';
import CodeMirror from '@uiw/react-codemirror';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { useThemeStore } from '../../state/useTheme';
import { competeProfile } from '../../editor/profiles';
import { IconTrash, IconEye, IconEyeOff } from '../Icons';
import ConsoleView from '../ConsoleView';

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
  generator_py: string;
  // Kept for backward compatibility when loading existing problems; not editable in the form.
  reference_solution_py: string;
  checker_py: string;
}

// Shape for structured generator errors: category label + raw traceback.
interface GeneratorError {
  kind: string;
  details: string;
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
        padding: '8px 12px',
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
      <div style={{ padding: '10px 12px' }}>{children}</div>
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
        padding: '5px 10px',
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
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
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
    generator_py: '',
    reference_solution_py: '',
    checker_py: '',
  });
  const [generatorRunning, setGeneratorRunning] = useState(false);
  const [generatorError, setGeneratorError] = useState<GeneratorError | null>(null);
  const [generatorOutput, setGeneratorOutput] = useState<string | null>(null);
  const [generatorPreview, setGeneratorPreview] = useState<TestDraft[] | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [tab, setTab] = useState<'details' | 'statement' | 'tests' | 'generator'>('details');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);

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
          generator_py: data.generator_py ?? '',
          reference_solution_py: data.reference_solution_py ?? '',
          checker_py: data.checker_py ?? '',
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

  const removeFromPreview = (idx: number) => {
    setGeneratorPreview((prev) => prev ? prev.filter((_, i) => i !== idx) : null);
  };

  const useGeneratedTests = () => {
    if (!generatorPreview || generatorPreview.length === 0) return;
    setForm((f) => ({ ...f, tests: [...generatorPreview] }));
    setGeneratorPreview(null);
    setGeneratorOutput(null);
    setGeneratorError(null);
  };

  const handleRunGenerator = async () => {
    if (!form.generator_py.trim()) return;
    setGeneratorRunning(true);
    setGeneratorError(null);
    setGeneratorOutput(null);
    setGeneratorPreview(null);
    const slug = isNew ? (form.slug || 'preview') : editSlug!;
    try {
      const { stdout, error: genErr } = await runGenerator(form.generator_py, slug);
      setGeneratorOutput(stdout || null);
      if (genErr) {
        setGeneratorError({ kind: t('teacher.generator.errorGeneric'), details: genErr });
        return;
      }
      let parsed: { tests: Array<{ tier: number; visible: boolean; fields: Record<string, unknown> | null; input: string; expected?: string }>; reference_solution_py?: string | null; checker_py?: string | null };
      try {
        parsed = JSON.parse(stdout);
      } catch {
        setGeneratorError({ kind: t('teacher.generator.errorJson'), details: '' });
        return;
      }
      const referencePy = parsed.reference_solution_py ?? '';
      const checkerPy = parsed.checker_py ?? '';
      const preview: TestDraft[] = [];
      let sanityChecked = false;
      for (let i = 0; i < parsed.tests.length; i++) {
        const tc = parsed.tests[i];
        let expected = tc.expected ?? '';
        if (!expected && referencePy && tc.fields) {
          const { expected: ref, error: refErr } = await runReference(referencePy, JSON.stringify(tc.fields));
          if (refErr) {
            setGeneratorError({ kind: t('teacher.generator.errorReference', { n: i + 1 }), details: refErr });
            return;
          }
          expected = ref;
        }
        // Checker sanity check: run checker on first available test to verify it works
        if (!sanityChecked && checkerPy && tc.fields && expected) {
          sanityChecked = true;
          const { passed, error: checkErr } = await runChecker(
            checkerPy,
            tc.fields ? JSON.stringify(tc.fields) : null,
            expected,
            expected,
          );
          if (checkErr) {
            setGeneratorError({ kind: t('teacher.generator.errorChecker'), details: checkErr });
            return;
          }
          if (!passed) {
            setGeneratorError({
              kind: t('teacher.generator.errorChecker'),
              details: t('teacher.generator.errorCheckerRejected', { n: i + 1 }),
            });
            return;
          }
        }
        preview.push({
          tier: Math.min(3, Math.max(1, tc.tier)) as 1 | 2 | 3,
          is_visible: Boolean(tc.visible),
          input: tc.input,
          expected,
        });
      }
      setGeneratorPreview(preview);
    } catch {
      setGeneratorError({ kind: t('teacher.generator.errorFailed'), details: '' });
    } finally {
      setGeneratorRunning(false);
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    const validationError = form.generator_py.trim()
      ? null  // generator mode: tests come from the generator
      : validateForm(form, t);
    if (validationError) {
      setError(validationError);
      if (!form.title.trim() || !/^[a-z][a-z0-9-]{1,40}$/.test(form.slug)) setTab('details');
      else if (!form.statement.trim()) setTab('statement');
      else setTab('tests');
      return;
    }
    setError(null);
    setGeneratorError(null);
    setSaving(true);

    try {
      let testsForSave: TestDraft[] = form.tests;
      // hoisted: generator-derived reference/checker take priority over form values
      let generatorReferencePy: string | null = null;
      let generatorCheckerPy: string | null = null;
      const slug = isNew ? form.slug : editSlug!;

      // If generator source is present, run it to produce tests
      if (form.generator_py.trim()) {
        setGeneratorRunning(true);
        try {
          const { stdout, error: genErr } = await runGenerator(form.generator_py, slug);
          if (genErr) {
            setGeneratorError({ kind: t('teacher.generator.errorGeneric'), details: genErr });
            return;
          }
          let parsed: { tests: Array<{ tier: number; visible: boolean; fields: Record<string, unknown> | null; input: string; expected?: string }>; reference_solution_py?: string | null; checker_py?: string | null };
          try {
            parsed = JSON.parse(stdout);
          } catch {
            setGeneratorError({ kind: t('teacher.generator.errorJsonHint'), details: '' });
            return;
          }
          if (!Array.isArray(parsed.tests) || parsed.tests.length === 0) {
            setGeneratorError({ kind: t('teacher.generator.errorEmpty'), details: '' });
            return;
          }

          // Run reference solution for tests without explicit expected
          const referencePy = parsed.reference_solution_py ?? '';
          const checkerPy = parsed.checker_py ?? '';
          generatorReferencePy = referencePy || null;
          generatorCheckerPy = checkerPy || null;
          const completedTests: TestDraft[] = [];
          let sanityChecked = false;
          for (let i = 0; i < parsed.tests.length; i++) {
            const t2 = parsed.tests[i];
            let expected = t2.expected ?? '';
            if (!expected && referencePy && t2.fields) {
              const { expected: ref, error: refErr } = await runReference(referencePy, JSON.stringify(t2.fields));
              if (refErr) {
                setGeneratorError({ kind: t('teacher.generator.errorReference', { n: i + 1 }), details: refErr });
                return;
              }
              expected = ref;
            }
            // Checker sanity check on first available test
            if (!sanityChecked && checkerPy && t2.fields && expected) {
              sanityChecked = true;
              const { passed, error: checkErr } = await runChecker(
                checkerPy,
                t2.fields ? JSON.stringify(t2.fields) : null,
                expected,
                expected,
              );
              if (checkErr) {
                setGeneratorError({ kind: t('teacher.generator.errorChecker'), details: checkErr });
                return;
              }
              if (!passed) {
                setGeneratorError({
                  kind: t('teacher.generator.errorChecker'),
                  details: t('teacher.generator.errorCheckerRejected', { n: i + 1 }),
                });
                return;
              }
            }
            completedTests.push({
              tier: Math.min(3, Math.max(1, t2.tier)) as 1 | 2 | 3,
              is_visible: Boolean(t2.visible),
              input: t2.input,
              expected,
            });
          }
          testsForSave = completedTests;
        } catch {
          setGeneratorError({ kind: t('teacher.generator.errorFailed'), details: '' });
          return;
        } finally {
          setGeneratorRunning(false);
        }
      }

      const url = isNew ? '/api/teacher/problems' : `/api/teacher/problems/${editSlug}`;
      const method = isNew ? 'POST' : 'PUT';
      const body = {
        ...form,
        slug,
        tests: testsForSave,
        generator_py: form.generator_py || null,
        // Generator-derived values take priority; fall back to form values; else omit
        reference_solution_py: generatorReferencePy ?? (form.reference_solution_py || null),
        checker_py: generatorCheckerPy ?? (form.checker_py || null),
      };
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

  const hasDetailsError = !form.title.trim() || !/^[a-z][a-z0-9-]{1,40}$/.test(form.slug);
  const hasStatementError = !form.statement.trim();
  const hasTestsError = !form.generator_py.trim() && (
    !form.tests.some((tc) => tc.tier === 1) || !form.tests.some((tc) => tc.is_visible)
  );
  const tabErr = { details: hasDetailsError, statement: hasStatementError, tests: hasTestsError, generator: false } as const;

  const tabs: { key: 'details' | 'statement' | 'tests' | 'generator'; label: string }[] = [
    { key: 'details', label: t('teacher.tabDetails') },
    { key: 'statement', label: t('teacher.tabStatement') },
    { key: 'tests', label: t('teacher.tabTests') },
    { key: 'generator', label: t('teacher.tabGenerator') },
  ];

  if (!loaded) {
    return <div style={{ padding: 24, fontFamily: theme.fontUI, color: theme.panelTxtMute }}>Loading…</div>;
  }

  const headerTitle = form.title || (isNew ? t('teacher.newProblem') : t('teacher.editProblem'));

  return (
    <div style={{ minHeight: '100vh', background: theme.appBg, fontFamily: theme.fontUI, color: theme.panelTxt }}>

      {/* Sticky topbar (two rows: actions + tabs) */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: `${theme.appBg}ec`,
        backdropFilter: 'blur(6px)',
        borderBottom: `0.5px solid ${theme.panelBorder}`,
      }}>
        {/* Row 1: actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 20px',
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

        <span style={{
          fontSize: 15,
          fontWeight: 600,
          color: theme.panelTxt,
          maxWidth: 360,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {headerTitle}
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

        {error && (
          <span style={{
            fontSize: 11.5,
            padding: '2px 9px',
            borderRadius: 999,
            background: 'rgba(255,77,77,0.13)',
            color: '#ff7a7a',
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {error}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setPreviewOpen((v) => !v)}
          aria-label={previewOpen ? t('teacher.hidePreview') : t('teacher.showPreview')}
          title={previewOpen ? t('teacher.hidePreview') : t('teacher.showPreview')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 8,
            border: `0.5px solid ${theme.panelBorder}`,
            color: theme.panelTxtMute,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {previewOpen
              ? <path d="M9 6l6 6-6 6" />
              : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </button>

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

        {/* Row 2: tab bar */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '0 20px',
          borderTop: `0.5px solid ${theme.panelBorder}`,
        }}>
          {tabs.map((tb) => {
            const active = tab === tb.key;
            const showDot = submitted && tabErr[tb.key];
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: theme.fontUI,
                  color: active ? theme.panelTxt : theme.panelTxtMute,
                  borderBottom: `2px solid ${active ? theme.primaryBg : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {tb.label}
                {showDot && (
                  <span
                    aria-label={t('teacher.tabHasErrors')}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff7a7a', display: 'inline-block' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-pane body */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '12px 20px 32px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}>

        {/* Left: authoring form */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ display: tab === 'details' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
          <SectionCard icon={<IconDoc />} title={t('teacher.problemTitle')} desc="Title and list position">
            <div style={{ marginBottom: 10 }}>
              <FieldLabel label={t('teacher.problemTitle')} required />
              <FieldInput value={form.title} onChange={handleTitleChange} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
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
          </div>

          <div style={{ display: tab === 'statement' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
          <SectionCard icon={<IconLines />} title={t('teacher.problemStatement')} desc="Markdown">
            <textarea
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              rows={20}
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

          <SectionCard icon={<IconCode />} title={t('teacher.starterCode')} desc="Pre-filled for students">
            <div style={{ border: `0.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
              <CodeMirror
                value={form.starter_code}
                extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
                onChange={(v) => setForm((f) => ({ ...f, starter_code: v }))}
                height="260px"
              />
            </div>
          </SectionCard>
          </div>

          <div style={{ display: tab === 'tests' ? 'block' : 'none' }}>
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

          <div style={{ display: tab === 'generator' ? 'block' : 'none' }}>
          <SectionCard icon={<IconCode />} title={t('teacher.generator.title')} desc={t('teacher.generator.desc')}>
            {/* Console: always visible when there's output or error */}
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
                  onClick={handleRunGenerator}
                  disabled={generatorRunning || !form.generator_py.trim()}
                  style={{
                    all: 'unset', cursor: generatorRunning || !form.generator_py.trim() ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 7,
                    background: theme.primaryBg, color: theme.primaryTxt,
                    opacity: generatorRunning || !form.generator_py.trim() ? 0.5 : 1,
                  }}
                >
                  {generatorRunning ? t('teacher.generator.running') : t('teacher.generator.runButton')}
                </button>
              </div>
              <div style={{ border: `0.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                <CodeMirror
                  value={form.generator_py}
                  extensions={competeProfile({ theme, lang: i18n.language, fontSize, cmTheme })}
                  onChange={(v) => setForm((f) => ({ ...f, generator_py: v }))}
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
                    onClick={useGeneratedTests}
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
                          onClick={() => removeFromPreview(i)}
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
          </div>
        </div>

        {/* Right: sticky student preview (collapsible) */}
        {previewOpen && (
          <div style={{ flexShrink: 0, width: 380, position: 'sticky', top: 92 }}>
            <StudentPreview
              title={form.title}
              statement={form.statement}
              visibleTests={visibleTests}
            />
          </div>
        )}
      </div>
    </div>
  );
}
