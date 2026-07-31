import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { getConfig, type Config } from '../../state/api';
import { Icon } from '../Icons';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'signin' | 'signup';

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { initiateOAuthLogin, outsiderLogin, outsiderSignup } = useUser();

  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    if (open) {
      getConfig().then(setConfig).catch(() => setConfig({ allowPasswordAuth: false }));
    }
  }, [open]);

  if (!open) return null;

  const allowPasswordAuth = config?.allowPasswordAuth ?? false;

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setName('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'signin') {
        await outsiderLogin(name.trim(), password);
      } else {
        await outsiderSignup(name.trim(), password, role);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const isSignUp = tab === 'signup';
  const canSubmit = name.trim().length > 0 && password.length >= (isSignUp ? 4 : 1);

  const inputStyle: React.CSSProperties = {
    all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: theme.editorBg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: theme.radiusButton,
    fontFamily: theme.fontUI, fontSize: 13.5,
    color: theme.panelTxt,
  };

  const roleColors = {
    student: { bg: theme.accent, soft: `${theme.accent}20`, line: `${theme.accent}70` },
    teacher: { bg: theme.runBg,  soft: `${theme.runBg}20`,  line: `${theme.runBg}70`  },
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusWindow + 4,
          boxShadow: theme.shadowWindow,
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
          overflow: 'hidden',
        }}
      >
        {/* Brand header */}
        <div style={{
          padding: '20px 22px 16px',
          background: theme.panelHeader,
          borderBottom: `1px solid ${theme.panelBorder}`,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              fontFamily: theme.fontUI, fontWeight: 800, fontSize: 20,
              color: theme.panelTxt, letterSpacing: -0.5, lineHeight: 1,
            }}>
              pi<sup style={{ fontSize: 13, verticalAlign: '0.15em' }}>3</sup>
            </span>
            <span style={{ width: 1, height: 16, background: theme.panelBorder, display: 'block' }} />
            <span style={{ fontSize: 12.5, color: theme.panelTxtMute, fontWeight: 500 }}>
              {isSignUp ? t('auth.createYourAccount') : t('auth.welcomeBack')}
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>
            {isSignUp ? t('auth.joinClass') : t('auth.signInTagline')}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: 'unset', cursor: 'pointer',
              position: 'absolute', top: 14, right: 14,
              width: 28, height: 28, borderRadius: theme.radiusButton,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: theme.panelTxtMute,
            }}
          >
            <Icon name="close" size={14} color="currentColor" />
          </button>
        </div>

        {/* Tab bar */}
        {allowPasswordAuth && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            padding: '10px 12px 0',
            gap: 4,
            borderBottom: `1px solid ${theme.panelBorder}`,
          }}>
            {([
              { id: 'signin' as Tab, label: t('auth.signIn') },
              { id: 'signup' as Tab, label: t('auth.signUp') },
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => switchTab(m.id)}
                style={{
                  all: 'unset', cursor: 'pointer', textAlign: 'center',
                  padding: '8px 0', fontSize: 13, fontWeight: 600,
                  color: tab === m.id ? theme.panelTxt : theme.panelTxtMute,
                  borderBottom: `2px solid ${tab === m.id ? theme.accent : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Form body */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Role chooser (signup only) */}
          {allowPasswordAuth && isSignUp && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.panelTxtMute, marginBottom: 8 }}>
                {t('auth.role')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  { id: 'student' as const, icon: 'folder' as const, title: t('auth.roleStudent'), sub: t('auth.studentSub') },
                ]).map((r) => {
                  const on = role === r.id;
                  const c = roleColors[r.id];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      style={{
                        all: 'unset', cursor: 'pointer',
                        padding: '10px 12px',
                        borderRadius: theme.radiusCard + 4,
                        border: `1.5px solid ${on ? c.line : theme.panelBorder}`,
                        background: on ? c.soft : theme.editorBg,
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: 999,
                          background: c.bg, color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon name={r.icon} size={13} color="#fff" />
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: theme.panelTxt }}>{r.title}</div>
                          <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 1 }}>{r.sub}</div>
                        </div>
                        {on && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            width: 16, height: 16, borderRadius: 999,
                            background: c.bg, color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon name="check" size={9} color="#fff" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* School OAuth link */}
          {!isSignUp && (
            <button
              type="button"
              onClick={initiateOAuthLogin}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '9px 12px', borderRadius: theme.radiusButton,
                border: `1px solid ${theme.panelBorder}`,
                background: theme.chip,
                fontFamily: theme.fontUI, fontSize: 13, fontWeight: 600,
                color: theme.panelTxt, textAlign: 'center',
              }}
            >
              {t('auth.signInWithSchool')}
            </button>
          )}

          {/* Username */}
          {allowPasswordAuth && (
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
                {t('auth.yourName')}
              </label>
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
          )}

          {/* Password */}
          {allowPasswordAuth && (
            <div>
              <div style={{ marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxtMute }}>
                  {t('auth.password')}
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? t('auth.createPassword') : t('auth.enterPassword')}
                disabled={loading}
                style={inputStyle}
              />
              {isSignUp && (
                <div style={{ fontSize: 11, color: theme.panelTxtMute, marginTop: 5 }}>
                  {t('auth.passwordHint')}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '7px 10px',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: theme.radiusButton,
              fontSize: 12.5, color: theme.stopBg,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              all: 'unset', cursor: canSubmit && !loading ? 'pointer' : 'default',
              marginTop: 2, padding: '11px 16px',
              borderRadius: theme.radiusButton,
              background: theme.runBg,
              color: theme.runTxt,
              fontFamily: theme.fontUI, fontSize: 13.5, fontWeight: 700,
              textAlign: 'center',
              opacity: (!canSubmit || loading) ? 0.5 : 1,
              boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset',
            }}
          >
            {loading
              ? (isSignUp ? t('auth.signingUp') : t('auth.signingIn'))
              : (isSignUp ? t('auth.signUp') : t('auth.signIn'))}
          </button>

          {/* Switch link */}
          <div style={{ textAlign: 'center', fontSize: 12, color: theme.panelTxtMute }}>
            {isSignUp ? (
              <>
                {t('auth.switchToSignInQuestion')}{' '}
                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  style={{ all: 'unset', cursor: 'pointer', color: theme.accent, fontWeight: 600 }}
                >
                  {t('auth.signIn')}
                </button>
              </>
            ) : (
              <>
                {t('auth.switchToSignUpQuestion')}{' '}
                <button
                  type="button"
                  onClick={() => switchTab('signup')}
                  style={{ all: 'unset', cursor: 'pointer', color: theme.accent, fontWeight: 600 }}
                >
                  {t('auth.signUp')}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
