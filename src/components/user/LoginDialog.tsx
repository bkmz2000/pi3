import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { Icon } from '../Icons';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useUser();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login(name.trim());
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          width: 380,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 8,
          boxShadow: theme.shadowWindow,
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('auth.signIn')}</span>
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

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "16px 20px" }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: "block", marginBottom: 6,
              fontSize: 12.5, fontWeight: 500, color: theme.panelTxt,
            }}>
              {t('auth.yourName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.enterYourName')}
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

          {error && (
            <div style={{
              marginBottom: 12, padding: "8px 12px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 5,
              fontSize: 12.5, color: theme.stopBg,
            }}>
              {error}
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
              {t('auth.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              style={{
                all: "unset", cursor: loading ? "default" : "pointer",
                padding: "7px 16px", borderRadius: 5,
                background: theme.runBg,
                color: theme.runTxt,
                fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 600,
                opacity: (!name.trim() || loading) ? 0.5 : 1,
              }}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
