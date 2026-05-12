import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { Icon } from '../Icons';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

type View = 'default' | 'outsider-login' | 'outsider-signup';

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { initiateOAuthLogin, outsiderLogin, outsiderSignup } = useUser();

  const [view, setView] = useState<View>('default');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = (next: View) => {
    setView(next);
    setError(null);
    setName('');
    setPassword('');
  };

  const handleOutsiderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (view === 'outsider-login') {
        await outsiderLogin(name.trim(), password);
      } else {
        await outsiderSignup(name.trim(), password, role);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    all: 'unset', display: 'block', width: '100%',
    padding: '8px 12px', boxSizing: 'border-box',
    background: theme.editorBg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 5,
    fontFamily: theme.fontUI, fontSize: 13,
    color: theme.panelTxt,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: 12.5, fontWeight: 500, color: theme.panelTxt,
  };

  const isOutsider = view !== 'default';
  const isSignup = view === 'outsider-signup';
  const canSubmit = name.trim().length > 0 && password.length >= (isSignup ? 4 : 1);

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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {isOutsider
              ? (isSignup ? t('auth.signUp') : t('auth.signIn'))
              : t('auth.signIn')}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: 'unset', cursor: 'pointer',
              width: 28, height: 28, borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: theme.panelTxtMute,
            }}
          >
            <Icon name="close" size={16} color="currentColor" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {view === 'default' && (
            <>
              {/* Primary OAuth button */}
              <button
                type="button"
                onClick={initiateOAuthLogin}
                style={{
                  all: 'unset', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 0', borderRadius: 6,
                  background: theme.runBg,
                  color: theme.runTxt,
                  fontFamily: theme.fontUI, fontSize: 13.5, fontWeight: 600,
                }}
              >
                {t('auth.signInWithSchool')}
              </button>

              {/* Outsider link */}
              <button
                type="button"
                onClick={() => reset('outsider-login')}
                style={{
                  all: 'unset', cursor: 'pointer',
                  textAlign: 'center', fontSize: 12,
                  color: theme.panelTxtMute, textDecoration: 'underline',
                }}
              >
                {t('auth.outsiderAccount')}
              </button>
            </>
          )}

          {isOutsider && (
            <form onSubmit={handleOutsiderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t('auth.yourName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.enterYourName')}
                  disabled={loading}
                  autoFocus
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{t('auth.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? t('auth.createPassword') : t('auth.enterPassword')}
                  disabled={loading}
                  style={inputStyle}
                />
              </div>

              {isSignup && (
                <div>
                  <label style={labelStyle}>{t('auth.role')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['student', 'teacher'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        style={{
                          all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
                          padding: '7px 0', borderRadius: 5, fontSize: 12.5, fontWeight: 600,
                          border: `1px solid ${role === r ? theme.accent : theme.panelBorder}`,
                          background: role === r ? theme.accent + '22' : 'transparent',
                          color: role === r ? theme.accent : theme.panelTxtMute,
                          transition: 'all 0.12s',
                        }}
                      >
                        {r === 'student' ? t('auth.roleStudent') : t('auth.roleTeacher')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 5,
                  fontSize: 12.5, color: theme.stopBg,
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => reset(isSignup ? 'outsider-login' : 'outsider-signup')}
                  style={{
                    all: 'unset', cursor: 'pointer', flex: 1,
                    fontSize: 12, color: theme.panelTxtMute,
                    textDecoration: 'underline',
                  }}
                >
                  {isSignup ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
                </button>
                <button
                  type="button"
                  onClick={() => reset('default')}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    fontSize: 12, color: theme.panelTxtMute,
                    textDecoration: 'underline',
                  }}
                >
                  ← {t('auth.back')}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  style={{
                    all: 'unset', cursor: canSubmit && !loading ? 'pointer' : 'default',
                    padding: '7px 18px', borderRadius: 5,
                    background: theme.runBg,
                    color: theme.runTxt,
                    fontFamily: theme.fontUI, fontSize: 12.5, fontWeight: 600,
                    opacity: (!canSubmit || loading) ? 0.5 : 1,
                  }}
                >
                  {loading
                    ? (isSignup ? t('auth.signingUp') : t('auth.signingIn'))
                    : (isSignup ? t('auth.signUp') : t('auth.signIn'))}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
