import { useThemeStore } from '../../state/useTheme';
import { useUser } from '../../state/useUser';

export default function TeacherDashboard() {
  const theme = useThemeStore((s) => s.theme);
  const { user } = useUser();

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: theme.surface,
      fontFamily: theme.fontUI,
      color: theme.panelTxt,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, flex: "none",
        display: "flex", alignItems: "center",
        padding: "0 20px",
        background: theme.railBg,
        color: theme.railIcon,
        borderBottom: `1px solid ${theme.panelBorder}`,
      }}>
        <span style={{
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: 700, fontSize: 18,
          color: theme.railLogo,
        }}>
          pi<span style={{ fontSize: 12 }}>3</span>
        </span>
        <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 500, color: theme.railIconActive }}>
          Teacher Dashboard
        </span>
        <div style={{ flex: 1 }} />
        <a
          href="/"
          style={{
            color: theme.railIcon, textDecoration: "none",
            fontSize: 12.5, fontWeight: 500,
          }}
        >
          Back to IDE
        </a>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, padding: 32, overflow: "auto",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.panelTxtMute }}>
          Teacher Dashboard
        </div>
        <div style={{ fontSize: 13, color: theme.panelTxtMute, textAlign: "center", maxWidth: 400 }}>
          {user
            ? `Signed in as ${user.name} (${user.role})`
            : "Sign in to access the teacher dashboard."}
        </div>
      </div>
    </div>
  );
}
