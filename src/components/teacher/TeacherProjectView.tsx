import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';
import { getProject, getComments, addComment, deleteComment, type Project } from '../../state/api';
import { indentationGuideField, indentationGuides } from '../../editor/theme';
import { commentExtension, setCommentsEffect, type ResolvedComment } from '../../editor/comments';
import { Icon } from '../Icons';

function CommentPopover({
  comments, selectedLine, anchorY, onAdd, onDelete, canAdd, theme,
}: {
  comments: ResolvedComment[];
  selectedLine: number | null;
  anchorY: number | null;
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canAdd: boolean;
  theme: ReturnType<typeof useThemeStore.getState>['theme'];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (selectedLine === null || anchorY === null) return null;

  const lineComments = comments.filter(c => c.resolvedLine === selectedLine);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    await onAdd(draft.trim());
    setDraft('');
    setSubmitting(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 320,
        top: Math.max(8, Math.min(anchorY - 60, window.innerHeight - 300)),
        width: 280,
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        zIndex: 50,
        padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {lineComments.length === 0 && !canAdd && (
        <div style={{ fontSize: 12, color: theme.panelTxtMute }}>{t('teacher.noComments')}</div>
      )}

      {lineComments.map(c => (
        <div key={c.id} style={{
          background: theme.surface, borderRadius: 6, padding: '8px 10px',
          border: `1px solid ${theme.panelBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: theme.panelTxt }}>{c.author_name}</span>
            <span style={{ fontSize: 10.5, color: theme.panelTxtMute }}>
              {new Date(c.created_at).toLocaleDateString()}
            </span>
            {canAdd && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 8, color: theme.panelTxtMute }}
                title={t('teacher.deleteComment')}
              >
                <Icon name="trash" size={12} />
              </button>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: theme.panelTxt, whiteSpace: 'pre-wrap' }}>{c.text}</div>
        </div>
      ))}

      {canAdd && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd(); }}
            placeholder={t('teacher.commentPlaceholder')}
            rows={2}
            style={{
              all: 'unset', resize: 'none', width: '100%', boxSizing: 'border-box',
              padding: '6px 8px', borderRadius: 5, fontSize: 12.5,
              border: `1px solid ${theme.panelBorder}`,
              background: theme.surface, color: theme.panelTxt,
              fontFamily: theme.fontUI,
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting || !draft.trim()}
            style={{
              all: 'unset', cursor: draft.trim() ? 'pointer' : 'default',
              padding: '5px 12px', borderRadius: 5, fontSize: 12,
              background: draft.trim() ? theme.runBg : theme.railActiveBg,
              color: draft.trim() ? theme.runTxt : theme.panelTxtMute,
              fontWeight: 600, textAlign: 'center',
            }}
          >
            {submitting ? '…' : t('teacher.addComment')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TeacherProjectView() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const cmTheme = theme.name === 'Midnight' ? githubDark : githubLight;
  const { user } = useUser();

  const [project, setProject] = useState<Project | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [comments, setComments] = useState<ResolvedComment[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [anchorY, setAnchorY] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Load project
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProject(projectId)
      .then(p => {
        setProject(p);
        const first = p.current_file || Object.keys(p.files)[0] || 'main.py';
        setCurrentFile(first);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Load comments for current file
  useEffect(() => {
    if (!projectId || !currentFile) return;
    getComments(projectId, currentFile)
      .then(rows => {
        const mapped: ResolvedComment[] = rows.map(r => ({ ...r, resolvedLine: r.line_number }));
        setComments(mapped);
        // Push into CodeMirror
        editorRef.current?.view?.dispatch({ effects: setCommentsEffect.of(mapped) });
      })
      .catch(() => {});
  }, [projectId, currentFile]);

  const handleLineSelect = useCallback((lineNum: number | null, y: number | null) => {
    setSelectedLine(lineNum);
    setAnchorY(y);
  }, []);

  const handleAddComment = async (text: string) => {
    if (!projectId || !currentFile || selectedLine === null || !project) return;
    const doc = editorRef.current?.view?.state.doc;
    const anchorText = doc && selectedLine <= doc.lines ? doc.line(selectedLine).text.trim() : '';
    const created = await addComment(projectId, {
      file_path: currentFile,
      line_number: selectedLine,
      anchor_text: anchorText,
      text,
    });
    const newComment: ResolvedComment = { ...created, resolvedLine: selectedLine };
    const updated = [...comments, newComment];
    setComments(updated);
    editorRef.current?.view?.dispatch({ effects: setCommentsEffect.of(updated) });
  };

  const handleDeleteComment = async (id: string) => {
    if (!projectId) return;
    await deleteComment(projectId, id);
    const updated = comments.filter(c => c.id !== id);
    setComments(updated);
    editorRef.current?.view?.dispatch({ effects: setCommentsEffect.of(updated) });
  };

  const isTeacher = user?.role === 'teacher';
  const canAdd = isTeacher;

  const cmExtensions = [
    python(),
    EditorState.tabSize.of(4),
    indentUnit.of('    '),
    lineNumbers(),
    indentationGuideField,
    indentationGuides,
    EditorView.theme({ '&': { fontSize: fontSize + 'px' } }),
    EditorView.lineWrapping,
    EditorState.readOnly.of(true),
    commentExtension({ canAdd, onLineSelect: handleLineSelect }),
  ];

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: theme.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: theme.panelTxtMute, fontFamily: theme.fontUI, fontSize: 13,
      }}>
        {t('sideMenu.loading')}
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: theme.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: theme.panelTxtMute, fontFamily: theme.fontUI, fontSize: 13,
      }}>
        {error || 'Project not found'}
      </div>
    );
  }

  const files = Object.keys(project.files);
  const fileCommentCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f] = comments.filter(c => c.file_path === f).length;
    return acc;
  }, {});

  return (
    <div style={{
      position: 'fixed', inset: 0, background: theme.surface,
      fontFamily: theme.fontUI, display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, flex: 'none',
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: theme.railBg,
        borderBottom: `1px solid ${theme.panelBorder}`,
        gap: 12,
      }}>
        <a
          href="/teacher"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: theme.railIcon, textDecoration: 'none',
            fontSize: 12.5, fontWeight: 500,
          }}
        >
          <Icon name="close" size={14} color="currentColor" />
          {t('teacher.backToDashboard')}
        </a>
        <span style={{ color: theme.panelBorder }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.panelTxt }}>{project.name}</span>
        <span style={{ fontSize: 12, color: theme.panelTxtMute }}>— {t('teacher.readOnly')}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontWeight: 700, fontSize: 18, color: theme.railLogo }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list */}
        <div style={{
          width: 200, flex: 'none',
          background: theme.surfacePanel,
          borderRight: `1px solid ${theme.panelBorder}`,
          padding: '8px 0',
          overflowY: 'auto',
        }}>
          {files.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => { setCurrentFile(f); setSelectedLine(null); setAnchorY(null); }}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', boxSizing: 'border-box',
                padding: '7px 14px', fontSize: 12.5,
                background: f === currentFile ? theme.railActiveBg : 'transparent',
                color: f === currentFile ? theme.railIconActive : theme.panelTxt,
                fontWeight: f === currentFile ? 600 : 400,
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
              {fileCommentCounts[f] > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, background: '#e05560', color: '#fff',
                  borderRadius: 99, padding: '1px 5px', flexShrink: 0,
                }}>
                  {fileCommentCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Editor area */}
        <div
          style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}
          onClick={e => {
            // Close popover when clicking outside the gutter
            const target = e.target as HTMLElement;
            if (!target.closest('.cm-comment-gutter') && !target.closest('[data-comment-popover]')) {
              setSelectedLine(null);
              setAnchorY(null);
            }
          }}
        >
          <div style={{
            height: '100%',
            '--cm-bg': theme.editorBg,
          } as React.CSSProperties}>
            <CodeMirror
              ref={editorRef}
              key={`${currentFile}-${theme.editorBg}`}
              value={project.files[currentFile] ?? ''}
              extensions={cmExtensions}
              theme={cmTheme}
              height="100%"
              width="100%"
              editable={false}
            />
          </div>

          {selectedLine !== null && (
            <div data-comment-popover>
              <CommentPopover
                comments={comments}
                selectedLine={selectedLine}
                anchorY={anchorY}
                onAdd={handleAddComment}
                onDelete={handleDeleteComment}
                canAdd={canAdd}
                theme={theme}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
