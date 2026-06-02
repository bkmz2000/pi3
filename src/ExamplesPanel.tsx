import { useTranslation } from "react-i18next";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";

type Theme = ReturnType<typeof useThemeStore.getState>["theme"];

// NOTE: the rich CATALOG of examples used to live in this file. It was
// removed pre-launch because the full roster isn't shipped yet — see git
// history for the data shape when restoring this panel.

type Props = {
  onClose: () => void;
  // Kept in the signature to avoid touching the SideMenu call site; will be
  // wired back up once the catalog returns.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpen: (name: string) => void;
};

export default function ExamplesPanel({ onClose }: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        height: 40, display: "flex", alignItems: "center", gap: 6,
        padding: "0 8px 0 12px", background: theme.panelHeader,
        borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0,
      }}>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 700,
          color: theme.panelTxt, fontFamily: theme.fontUI,
        }}>
          {t("examples.title", "Examples")}
        </span>
        <button type="button" onClick={onClose} title={t("sideMenu.close")}
          style={{
            all: "unset", cursor: "pointer", width: 28, height: 28, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: theme.panelTxtMute,
          }}>
          <Icon name="close" size={16} color="currentColor" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <ComingSoonPlug theme={theme} message={t("comingSoon.examples")} />
      </div>
    </div>
  );
}

export function ComingSoonPlug({ theme, message }: { theme: Theme; message: string }) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: theme.panelTxt, fontFamily: theme.fontUI,
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {t("comingSoon.title")}
      </div>
      <div style={{
        fontSize: 12, color: theme.panelTxtMute, fontFamily: theme.fontUI,
        maxWidth: 280, lineHeight: 1.4,
      }}>
        {message}
      </div>
    </div>
  );
}
