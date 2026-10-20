import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { runGenerator, runReference, runChecker } from '../../runner/RunnerProvider';
import { useThemeStore } from '../../state/useTheme';
import ProblemDetailsSection from './problem-form/ProblemDetailsSection';
import StatementSection from './problem-form/StatementSection';
import StarterCodeSection from './problem-form/StarterCodeSection';
import GeneratorSection from './problem-form/GeneratorSection';
import TestBuilderToolbar from './problem-form/TestBuilder/TestBuilderToolbar';
import TestBuilderCanvas from './problem-form/TestBuilder/TestBuilderCanvas';
import PreviewDrawer from './problem-form/PreviewDrawer';

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
  reference_solution_py: string;
  checker_py: string;
}

interface GeneratorError {
  kind: string;
  details: string;
}

function emptyTest(tier: 1 | 2 | 3): TestDraft {
  return { tier, is_visible: tier === 1, input: '', expected: '' };
}

function validateForm(f: FormState, t: (k: string) => string): string | null {
  if (!f.title.trim()) return t('teacher.validationTitle');
  if (!f.statement.trim()) return t('teacher.validationStatement');
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(f.slug)) return t('teacher.validationBadSlug');
  if (!f.tests.some((tc) => tc.tier === 1)) return t('teacher.validationNoTier1');
  if (!f.tests.some((tc) => tc.is_visible)) return t('teacher.validationNoVisible');
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

  // Test Builder state
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragoverTier, setDragoverTier] = useState<1 | 2 | 3 | null>(null);

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
    if (expandedIndex === idx) setExpandedIndex(null);
  };

  // Drag-and-drop: change tier
  const handleChangeTier = (testIndex: number, newTier: 1 | 2 | 3, insertIndex: number) => {
    setForm((f) => {
      const tests = [...f.tests];
      const test = tests[testIndex];
      if (!test) return f;
      // Get global insertion position
      const targetTierIndices: number[] = [];
      tests.forEach((t, i) => { if (i !== testIndex && t.tier === newTier) targetTierIndices.push(i); });
      // Remove from current position
      const [moved] = tests.splice(testIndex, 1);
      moved.tier = newTier;
      // Insert at the right position among target tier tests
      if (targetTierIndices.length === 0) {
        // No tests in target tier — just append at end
        tests.push(moved);
      } else if (insertIndex >= targetTierIndices.length) {
        // Insert after last target tier test
        const lastIdx = targetTierIndices[targetTierIndices.length - 1];
        // Adjust: the array has changed since removal
        const adjusted = tests.findIndex((_, i) => i >= lastIdx);
        tests.splice(adjusted + 1, 0, moved);
      } else {
        const insertBeforeGlobal = targetTierIndices[insertIndex];
        const adjustedIdx = tests.findIndex((_, i) => i >= insertBeforeGlobal);
        tests.splice(adjustedIdx, 0, moved);
      }
      return { ...f, tests };
    });
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
    const validationError = form.generator_py.trim()
      ? null
      : validateForm(form, t);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setGeneratorError(null);
    setSaving(true);

    try {
      let testsForSave: TestDraft[] = form.tests;
      let generatorReferencePy: string | null = null;
      let generatorCheckerPy: string | null = null;
      const slug = isNew ? form.slug : editSlug!;

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
            background: saving ? theme.chip : theme.actionBg,
            color: saving ? theme.panelTxtMute : theme.actionTxt,
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

      {/* Single-column body */}
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '18px 20px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxSizing: 'border-box',
      }}>
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

        {/* Problem Details */}
        <ProblemDetailsSection
          title={form.title}
          slug={form.slug}
          orderIndex={form.order_index}
          slugTouched={slugTouched}
          isNew={isNew}
          onTitleChange={(v) => setForm((f) => ({ ...f, title: v }))}
          onSlugChange={(v) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: v })); }}
          onOrderIndexChange={(v) => setForm((f) => ({ ...f, order_index: Number(v) || 0 }))}
        />

        {/* Statement */}
        <StatementSection
          value={form.statement}
          onChange={(v) => setForm((f) => ({ ...f, statement: v }))}
        />

        {/* Starter Code */}
        <StarterCodeSection
          value={form.starter_code}
          onChange={(v) => setForm((f) => ({ ...f, starter_code: v }))}
        />

        {/* Test Builder */}
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
            <span style={{ color: theme.primaryBg, flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>
              {t('teacher.testCases', 'Test cases')}
            </span>
            <span style={{ fontSize: 11.5, color: theme.panelTxtMute, marginLeft: 'auto' }}>
              {form.tests.length} tests
            </span>
          </div>

          <div style={{ padding: '6px 15px 0' }}>
            <TestBuilderToolbar
              visibleCount={visibleTests.length}
              onPreviewClick={() => setPreviewOpen(true)}
              onShowAll={() => setForm((f) => ({
                ...f,
                tests: f.tests.map((t) => ({ ...t, is_visible: true })),
              }))}
              onHideAll={() => setForm((f) => ({
                ...f,
                tests: f.tests.map((t) => ({ ...t, is_visible: false })),
              }))}
            />
          </div>

          <div style={{ padding: '0 15px 15px' }}>
            <TestBuilderCanvas
              tests={form.tests}
              expandedIndex={expandedIndex}
              onSetExpanded={setExpandedIndex}
              onSetTest={setTest}
              onRemoveTest={removeTest}
              onAddTest={addTest}
              onChangeTier={handleChangeTier}
              dragoverTier={dragoverTier}
              setDragoverTier={setDragoverTier}
              onDragEnd={() => setDragoverTier(null)}
            />
          </div>
        </div>

        {/* Generator */}
        <GeneratorSection
          generatorPy={form.generator_py}
          onChangeGenerator={(v) => setForm((f) => ({ ...f, generator_py: v }))}
          generatorRunning={generatorRunning}
          generatorError={generatorError}
          generatorOutput={generatorOutput}
          generatorPreview={generatorPreview}
          onRunGenerator={handleRunGenerator}
          onUseGeneratedTests={useGeneratedTests}
          onRemoveFromPreview={removeFromPreview}
          problemSlug={isNew ? (form.slug || 'preview') : editSlug!}
        />
      </div>

      {/* Slide-out preview drawer */}
      {previewOpen && (
        <PreviewDrawer
          title={form.title}
          statement={form.statement}
          visibleTests={visibleTests}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
