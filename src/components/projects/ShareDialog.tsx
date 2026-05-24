import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../state/useTheme';
import { searchUsers, shareProjectWithUser, type UserSearchResult } from '../../state/api';
import { Icon } from '../Icons';
import { HandleAvatar } from '../user/HandleAvatar';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function ShareDialog({ open, onClose, projectId, projectName }: ShareDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<UserSearchResult | null>(null);
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setPicked(null);
      setRole('editor'); setError(null); setSuccess(null);
    }
  }, [open]);

  // Debounced search; aborts stale queries
  const seqRef = useRef(0);
  useEffect(() => {
    if (picked) return; // don't search while a person is selected
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const mySeq = ++seqRef.current;
    const handle = setTimeout(async () => {
      try {
        const rows = await searchUsers(q);
        if (mySeq === seqRef.current) setResults(rows);
      } catch {
        if (mySeq === seqRef.current) setResults([]);
      } finally {
        if (mySeq === seqRef.current) setSearching(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query, picked]);

  if (!open) return null;

  const handleShare = async () => {
    if (!picked) return;
    setLoading(true); setError(null);
    try {
      await shareProjectWithUser(projectId, picked.id, role);
      setSuccess(t('projects.shareSuccess', { name: picked.name }));
      setTimeout(() => { onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  const roleColor = (r: string) => r === 'teacher' ? theme.runBg : theme.accent;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 8,
          boxShadow: theme.shadowWindow,
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t('projects.shareTitle')}</span>
          <button
            type="button" onClick={onClose}
            style={{
              all: 'unset', cursor: 'pointer',
              width: 26, height: 26, borderRadius: 5,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: theme.panelTxtMute,
            }}
          >
            <Icon name="close" size={15} color="currentColor" />
          </button>
        </div>

        <div style={{ padding: '14px 18px' }}>
          <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12.5, color: theme.panelTxtMute }}>
            {t('projects.shareSubtitle', { name: '' })}
            <strong style={{ color: theme.panelTxt }}>{projectName}</strong>
          </p>

          {/* Person picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>
              {t('projects.sharePerson')}
            </label>

            {picked ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                background: theme.editorBg,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 6,
              }}>
                <HandleAvatar seed={picked.handle ?? picked.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {picked.name}
                  </div>
                  {picked.handle && (
                    <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.accent, marginTop: 1 }}>
                      @{picked.handle}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setPicked(null); setQuery(''); }}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 4,
                    color: theme.panelTxtMute, fontSize: 12,
                  }}
                >
                  <Icon name="close" size={13} color="currentColor" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('projects.sharePersonPlaceholder')}
                  disabled={loading}
                  style={{
                    all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '8px 12px',
                    background: theme.editorBg,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 5,
                    fontSize: 13, color: theme.panelTxt,
                  }}
                />
                {/* Result list */}
                {query.trim().length >= 2 && (
                  <div style={{
                    marginTop: 6,
                    maxHeight: 220, overflowY: 'auto',
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 5,
                    background: theme.editorBg,
                  }}>
                    {searching && (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: theme.panelTxtMute }}>
                        {t('projects.shareSearching')}
                      </div>
                    )}
                    {!searching && results.length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: theme.panelTxtMute }}>
                        {t('projects.shareNoMatches')}
                      </div>
                    )}
                    {!searching && results.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setPicked(u)}
                        style={{
                          all: 'unset', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', boxSizing: 'border-box',
                          padding: '8px 10px',
                          borderBottom: `1px solid ${theme.panelBorder}`,
                        }}
                      >
                        <HandleAvatar seed={u.handle ?? u.name} size={24} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.panelTxt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.name}
                          </div>
                          {u.handle && (
                            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxtMute, marginTop: 1 }}>
                              @{u.handle}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                          padding: '2px 7px', borderRadius: 999,
                          background: `${roleColor(u.role)}20`, color: roleColor(u.role),
                        }}>
                          {u.role === 'teacher' ? t('auth.roleTeacher') : t('auth.roleStudent')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {query.trim().length > 0 && query.trim().length < 2 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: theme.panelTxtMute }}>
                    {t('projects.shareHintMinChars')}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Role */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>
              {t('projects.shareRoleLabel')}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              disabled={loading}
              style={{
                all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
                padding: '8px 12px',
                background: theme.editorBg,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 5,
                fontSize: 13, color: theme.panelTxt,
              }}
            >
              <option value="editor">{t('projects.roleEditor')} — {t('projects.shareRoleEditorDesc')}</option>
              <option value="viewer">{t('projects.roleViewer')} — {t('projects.shareRoleViewerDesc')}</option>
            </select>
          </div>

          {error && (
            <div style={{
              marginBottom: 10, padding: '8px 12px',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 5,
              fontSize: 12.5, color: theme.stopBg,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 10, padding: '8px 12px',
              background: 'rgba(52,168,83,0.10)',
              border: '1px solid rgba(52,168,83,0.2)',
              borderRadius: 5,
              fontSize: 12.5, color: theme.successPillTxt,
            }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '7px 14px', borderRadius: 5,
                fontSize: 12.5, fontWeight: 500,
                color: theme.panelTxtMute,
              }}
            >
              {t('projects.shareCancel')}
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={!picked || loading}
              style={{
                all: 'unset', cursor: !picked || loading ? 'default' : 'pointer',
                padding: '7px 16px', borderRadius: 5,
                background: theme.runBg, color: theme.runTxt,
                fontSize: 12.5, fontWeight: 600,
                opacity: !picked || loading ? 0.5 : 1,
              }}
            >
              {loading ? t('projects.shareSharing') : t('projects.shareConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
