import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView } from '@codemirror/view';
import { githubDark } from '@uiw/codemirror-theme-github';
import { useThemeStore } from '../../state/useTheme';

const CM_EXTENSIONS = [python(), EditorView.lineWrapping];

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
  if (!f.tests.some((t) => t.tier === 1)) return t('teacher.validationNoTier1');
  if (!f.tests.some((t) => t.is_visible)) return t('teacher.validationNoVisible');
  return null;
}

export default function TeacherProblemForm() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
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

  // Load existing problem for edit mode
  useEffect(() => {
    if (isNew) return;
    fetch(`/api/teacher/problems/${editSlug}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setForm({
          slug: data.slug,
          title: data.title,
          statement: data.statement,
          starter_code: data.starter_code,
          order_index: data.order_index,
          tests: data.tests.map((t: { tier: number; is_visible: number; input: string; expected: string }) => ({
            tier: t.tier as 1 | 2 | 3,
            is_visible: Boolean(t.is_visible),
            input: t.input,
            expected: t.expected,
          })),
        });
        setSlugTouched(true);
        setLoaded(true);
      })
      .catch(() => setError('Failed to load problem.'));
  }, [editSlug, isNew]);

  // Auto-suggest slug from title (new mode, slug not manually edited)
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
      navigate('/teacher/problems');
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const input = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { mono?: boolean; hint?: string; onBlur?: () => void },
  ) => (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 4 }}>
        {label}
        {opts?.hint && <span style={{ marginLeft: 6, fontWeight: 400 }}>{opts.hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={opts?.onBlur}
        style={{
          display: 'block', width: '100%', boxSizing: 'border-box',
          background: theme.surface, color: theme.panelTxt,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 5, padding: '7px 10px',
          fontFamily: opts?.mono ? theme.fontMono : theme.fontUI,
          fontSize: 13,
        }}
      />
    </label>
  );

  const tierLabel = (tier: 1 | 2 | 3) =>
    tier === 1 ? t('teacher.tier1') : tier === 2 ? t('teacher.tier2') : t('teacher.tier3');

  const renderTestSection = (tier: 1 | 2 | 3) => {
    const tierTests = form.tests
      .map((test, idx) => ({ test, idx }))
      .filter(({ test }) => test.tier === tier);

    return (
      <div key={tier} style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: theme.panelTxt,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {tierLabel(tier)}
        </div>
        {tierTests.map(({ test, idx }, localIdx) => (
          <div key={idx} style={{
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 6, padding: 12, marginBottom: 8,
            background: theme.surfacePanel,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 3 }}>
                  {t('teacher.testInput')}
                </div>
                <textarea
                  value={test.input}
                  onChange={(e) => setTest(idx, { input: e.target.value })}
                  rows={3}
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    background: theme.surface, color: theme.panelTxt,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 4, padding: '6px 8px',
                    fontFamily: theme.fontMono, fontSize: 12, resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 3 }}>
                  {t('teacher.testExpected')}
                </div>
                <textarea
                  value={test.expected}
                  onChange={(e) => setTest(idx, { expected: e.target.value })}
                  rows={3}
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    background: theme.surface, color: theme.panelTxt,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 4, padding: '6px 8px',
                    fontFamily: theme.fontMono, fontSize: 12, resize: 'vertical',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: theme.panelTxtMute, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={test.is_visible}
                  onChange={(e) => setTest(idx, { is_visible: e.target.checked })}
                />
                {t('teacher.testVisible')}
              </label>
              <div style={{ fontSize: 12, color: theme.panelTxtMute }}>
                {t('teacher.tier')} {tier}, #{localIdx + 1}
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => removeTest(idx)}
                style={{
                  all: 'unset', cursor: 'pointer',
                  fontSize: 12, color: theme.panelTxtMute,
                }}
              >
                {t('teacher.removeTest')}
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => addTest(tier)}
          style={{
            all: 'unset', cursor: 'pointer',
            fontSize: 12, color: theme.accent,
            padding: '4px 0',
          }}
        >
          + {t('teacher.addTest')}
        </button>
      </div>
    );
  };

  if (!loaded) {
    return <div style={{ padding: 24, fontFamily: theme.fontUI, color: theme.panelTxtMute }}>Loading…</div>;
  }

  return (
    <div style={{
      padding: '20px 24px', fontFamily: theme.fontUI, color: theme.panelTxt,
      maxWidth: 900,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <button
          onClick={() => navigate('/teacher/problems')}
          style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: theme.panelTxtMute }}
        >
          ← {t('teacher.problems')}
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {isNew ? t('teacher.newProblem') : t('teacher.editProblem')}
        </h2>
      </div>

      {input(t('teacher.problemTitle'), form.title, handleTitleChange)}

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          {input(
            t('teacher.problemSlug'),
            form.slug,
            (v) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: v })); },
            { mono: true, hint: t('teacher.problemSlugHint') },
          )}
        </div>
        <div style={{ flex: 1 }}>
          {input(
            t('teacher.orderIndex'),
            String(form.order_index),
            (v) => setForm((f) => ({ ...f, order_index: Number(v) || 0 })),
          )}
        </div>
      </div>

      {/* Statement editor + preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
            {t('teacher.problemStatement')}
          </span>
          <button
            onClick={() => setPreview((v) => !v)}
            style={{
              all: 'unset', cursor: 'pointer',
              fontSize: 11, color: theme.accent, padding: '2px 8px',
              borderRadius: 4, border: `1px solid ${theme.accent}`,
            }}
          >
            {preview ? '✎ Edit' : t('teacher.problemPreview')}
          </button>
        </div>
        {preview ? (
          <div style={{
            minHeight: 120, padding: 12,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 5, background: theme.surface,
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
              display: 'block', width: '100%', boxSizing: 'border-box',
              background: theme.surface, color: theme.panelTxt,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 5, padding: '8px 10px',
              fontFamily: theme.fontMono, fontSize: 13, resize: 'vertical',
            }}
          />
        )}
      </div>

      {/* Starter code */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 4 }}>
          {t('teacher.starterCode')}
        </div>
        <div style={{ border: `1px solid ${theme.panelBorder}`, borderRadius: 5, overflow: 'hidden' }}>
          <CodeMirror
            value={form.starter_code}
            extensions={CM_EXTENSIONS}
            theme={githubDark}
            onChange={(v) => setForm((f) => ({ ...f, starter_code: v }))}
            style={{ fontSize: 13 }}
            basicSetup={{ lineNumbers: true }}
          />
        </div>
      </div>

      {/* Tests */}
      <div style={{ marginBottom: 20 }}>
        {([1, 2, 3] as (1 | 2 | 3)[]).map(renderTestSection)}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px', marginBottom: 12,
          background: '#ff4d4d22', border: '1px solid #ff4d4d44',
          borderRadius: 5, color: '#ff6b6b', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          all: 'unset', cursor: saving ? 'default' : 'pointer',
          padding: '9px 20px', borderRadius: 7,
          background: saving ? theme.chip : theme.accent,
          color: saving ? theme.panelTxtMute : '#fff',
          fontSize: 14, fontWeight: 600,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? t('teacher.savingProblem') : t('teacher.saveProblem')}
      </button>
    </div>
  );
}
