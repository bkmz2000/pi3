import { useRef, useState } from 'react';
import { useThemeStore } from '../../state/useTheme';

interface ImportTestRow {
  tier: number;
  subtask?: string;
  input: string | null;
  answer: string | null;
}

interface ImportProblem {
  id: string;
  title_ru?: string;
  title_en?: string;
  statement_tex?: string;
  tests?: ImportTestRow[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { id: string; reason: string }[];
}

type Lang = 'ru' | 'en';

function usableTestCount(p: ImportProblem): number {
  return (p.tests ?? []).filter((t) => t.input !== null && t.answer !== null).length;
}

function problemTitle(p: ImportProblem, lang: Lang): string {
  return (lang === 'en' ? p.title_en : p.title_ru) || p.title_ru || p.title_en || p.id;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportProblemsModal({ onClose, onImported }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const fileRef = useRef<HTMLInputElement>(null);

  const [problems, setProblems] = useState<ImportProblem[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const parseFile = (text: string) => {
    try {
      const json = JSON.parse(text);
      const arr: ImportProblem[] = Array.isArray(json) ? json : [json];
      if (!arr.every((p) => typeof p.id === 'string')) {
        setParseError('Each problem must have a string "id" field.');
        return;
      }
      setProblems(arr);
      setParseError(null);
      setResult(null);
    } catch {
      setParseError('Invalid JSON.');
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => parseFile(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!problems) return;
    setImporting(true);
    try {
      const res = await fetch('/api/teacher/problems/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problems, lang, overwrite }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) onImported();
    } catch {
      setResult({ imported: 0, skipped: 0, errors: [{ id: '*', reason: 'Network error' }] });
    } finally {
      setImporting(false);
    }
  };

  const card: React.CSSProperties = {
    background: theme.surfacePanel,
    border: `0.5px solid ${theme.panelBorder}`,
    borderRadius: 12,
    overflow: 'hidden',
    width: 560,
    maxWidth: '95vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  };

  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({
    all: 'unset' as const,
    cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: theme.fontUI,
    background: disabled ? theme.chip : primary ? theme.primaryBg : theme.chip,
    color: disabled ? theme.panelTxtMute : primary ? theme.primaryTxt : theme.panelTxt,
    opacity: disabled ? 0.6 : 1,
  });

  const totalTests = problems ? problems.reduce((s, p) => s + usableTestCount(p), 0) : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={card}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: `0.5px solid ${theme.panelBorder}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.panelTxt }}>Import problems from JSON</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6,
              color: theme.panelTxtMute, fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? theme.primaryBg : theme.panelBorder}`,
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? `${theme.primaryBg}11` : theme.surface,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={theme.panelTxtMute} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <div style={{ fontSize: 13.5, color: theme.panelTxt, marginBottom: 4 }}>
                {problems ? 'Drop another file to replace' : 'Drop JSON file or click to browse'}
              </div>
              <div style={{ fontSize: 12, color: theme.panelTxtMute }}>
                Array of problem objects or a single problem
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {parseError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,77,77,0.12)', border: '0.5px solid rgba(255,100,100,0.3)', color: '#ff7a7a', fontSize: 13 }}>
              {parseError}
            </div>
          )}

          {/* Problem preview list */}
          {problems && !result && (
            <div>
              <div style={{ fontSize: 12, color: theme.panelTxtMute, marginBottom: 10 }}>
                Found <strong style={{ color: theme.panelTxt }}>{problems.length}</strong> problem{problems.length !== 1 ? 's' : ''} · <strong style={{ color: theme.panelTxt }}>{totalTests}</strong> usable tests
              </div>
              <div style={{
                border: `0.5px solid ${theme.panelBorder}`,
                borderRadius: 8,
                overflow: 'hidden',
                maxHeight: 220,
                overflowY: 'auto',
              }}>
                {problems.map((p, i) => (
                  <div key={p.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 12px',
                    borderBottom: i < problems.length - 1 ? `0.5px solid ${theme.panelBorder}` : 'none',
                    fontSize: 13,
                  }}>
                    <span style={{ color: theme.panelTxtMute, fontSize: 11, flexShrink: 0, width: 22, textAlign: 'right' }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, color: theme.panelTxt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {problemTitle(p, lang)}
                    </span>
                    <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute, flexShrink: 0 }}>
                      {p.id}
                    </span>
                    <span style={{ fontSize: 11, color: theme.panelTxtMute, flexShrink: 0 }}>
                      {usableTestCount(p)}t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          {problems && !result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 2 }}>Options</div>

              {/* Lang toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: theme.panelTxt, width: 130 }}>Title language</span>
                <div style={{ display: 'flex', gap: 0 }}>
                  {(['ru', 'en'] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: theme.fontUI,
                        background: lang === l ? theme.primaryBg : theme.chip,
                        color: lang === l ? theme.primaryTxt : theme.panelTxtMute,
                        borderRadius: l === 'ru' ? '6px 0 0 6px' : '0 6px 6px 0',
                        border: `0.5px solid ${theme.panelBorder}`,
                        borderRight: l === 'ru' ? 'none' : undefined,
                      }}
                    >
                      {l === 'ru' ? 'Russian' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overwrite toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: theme.primaryBg }}
                />
                <span style={{ fontSize: 13, color: theme.panelTxt }}>
                  Overwrite existing problems (same slug)
                </span>
              </label>

              <div style={{ fontSize: 11.5, color: theme.panelTxtMute, marginTop: 2 }}>
                Statements are imported as raw LaTeX and may need editing in the problem form.
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  flex: 1, padding: '12px 14px', borderRadius: 8, textAlign: 'center',
                  background: result.imported > 0 ? 'rgba(52,211,153,0.12)' : theme.surface,
                  border: `0.5px solid ${result.imported > 0 ? 'rgba(52,211,153,0.3)' : theme.panelBorder}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: result.imported > 0 ? '#5fd6a0' : theme.panelTxtMute }}>
                    {result.imported}
                  </div>
                  <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>imported</div>
                </div>
                <div style={{
                  flex: 1, padding: '12px 14px', borderRadius: 8, textAlign: 'center',
                  background: result.skipped > 0 ? 'rgba(240,180,41,0.10)' : theme.surface,
                  border: `0.5px solid ${result.skipped > 0 ? 'rgba(240,180,41,0.25)' : theme.panelBorder}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: result.skipped > 0 ? '#f0b429' : theme.panelTxtMute }}>
                    {result.skipped}
                  </div>
                  <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>skipped (exists)</div>
                </div>
                <div style={{
                  flex: 1, padding: '12px 14px', borderRadius: 8, textAlign: 'center',
                  background: result.errors.length > 0 ? 'rgba(255,77,77,0.10)' : theme.surface,
                  border: `0.5px solid ${result.errors.length > 0 ? 'rgba(255,100,100,0.25)' : theme.panelBorder}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: result.errors.length > 0 ? '#ff7a7a' : theme.panelTxtMute }}>
                    {result.errors.length}
                  </div>
                  <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 2 }}>errors</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div style={{
                  background: theme.surface,
                  border: `0.5px solid ${theme.panelBorder}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      gap: 10,
                      padding: '6px 12px',
                      borderBottom: i < result.errors.length - 1 ? `0.5px solid ${theme.panelBorder}` : 'none',
                      fontSize: 12,
                    }}>
                      <span style={{ fontFamily: theme.fontMono, color: '#ff7a7a', flexShrink: 0 }}>{e.id}</span>
                      <span style={{ color: theme.panelTxtMute }}>{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '12px 18px',
          borderTop: `0.5px solid ${theme.panelBorder}`,
          flexShrink: 0,
        }}>
          {!result ? (
            <>
              <button style={btn(false)} onClick={onClose}>Cancel</button>
              <button
                style={btn(true, !problems || importing)}
                onClick={handleImport}
                disabled={!problems || importing}
              >
                {importing ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Importing…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Import {problems ? `${problems.length} problem${problems.length !== 1 ? 's' : ''}` : ''}
                  </>
                )}
              </button>
            </>
          ) : (
            <button style={btn(true)} onClick={onClose}>Done</button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
