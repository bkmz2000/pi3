import { useState } from 'react';
import { useThemeStore } from '../../state/useTheme';
import { shareProject } from '../../state/api';
import { Icon } from '../Icons';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function ShareDialog({ open, onClose, projectId, projectName }: ShareDialogProps) {
  const theme = useThemeStore((s) => s.theme);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await shareProject(projectId, email.trim(), role);
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 8,
          boxShadow: theme.shadowWindow,
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Share Project</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer",
              width: 28, height: 28, borderRadius: 6,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: theme.panelTxtMute,
            }}
          >
            <Icon name="close" size={16} color="currentColor" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 20px" }}>
          <p style={{
            marginBottom: 12, fontSize: 13, color: theme.panelTxtMute,
          }}>
            Share <strong style={{ color: theme.panelTxt }}>{projectName}</strong> with someone
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: "block", marginBottom: 6,
              fontSize: 12.5, fontWeight: 500, color: theme.panelTxt,
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              disabled={loading}
              autoFocus
              style={{
                all: "unset", display: "block", width: "100%",
                padding: "8px 12px", boxSizing: "border-box",
                background: theme.editorBg,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 5,
                fontFamily: theme.fontUI, fontSize: 13,
                color: theme.panelTxt,
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: "block", marginBottom: 6,
              fontSize: 12.5, fontWeight: 500, color: theme.panelTxt,
            }}>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              disabled={loading}
              style={{
                all: "unset", display: "block", width: "100%",
                padding: "8px 12px", boxSizing: "border-box",
                background: theme.editorBg,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 5,
                fontFamily: theme.fontUI, fontSize: 13,
                color: theme.panelTxt,
              }}
            >
              <option value="viewer">Viewer (can view)</option>
              <option value="editor">Editor (can edit)</option>
            </select>
          </div>

          {error && (
            <div style={{
              marginBottom: 12, padding: "8px 12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 5,
              fontSize: 12.5, color: theme.stopBg,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 12, padding: "8px 12px",
              background: "rgba(52,168,83,0.10)",
              border: "1px solid rgba(52,168,83,0.2)",
              borderRadius: 5,
              fontSize: 12.5, color: theme.successPillTxt,
            }}>
              Project shared successfully!
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                all: "unset", cursor: "pointer",
                padding: "7px 14px", borderRadius: 5,
                fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 500,
                color: theme.panelTxtMute,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!email.trim() || loading}
              style={{
                all: "unset", cursor: loading ? "default" : "pointer",
                padding: "7px 16px", borderRadius: 5,
                background: theme.runBg, color: theme.runTxt,
                fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 600,
                opacity: (!email.trim() || loading) ? 0.5 : 1,
              }}
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
