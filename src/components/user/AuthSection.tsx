import { useUser } from '../../state/useUser';
import { useThemeStore } from '../../state/useTheme';
import { LoginButton } from './LoginButton';
import { UserMenu } from './UserMenu';

export function AuthSection() {
  const { authState } = useUser();
  const theme = useThemeStore((s) => s.theme);

  if (authState === 'loading') {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32,
      }}>
        <div style={{
          width: 16, height: 16,
          border: `2px solid ${theme.panelBorder}`,
          borderTopColor: theme.accent,
          borderRadius: 999,
          animation: "pi3blink 1s ease-in-out infinite",
        }} />
      </div>
    );
  }

  if (authState === 'logged_in') {
    return <UserMenu />;
  }

  return <LoginButton />;
}
