import { useTranslation } from "react-i18next";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { Examples } from "./state/exampleProjects";

type Theme = ReturnType<typeof useThemeStore.getState>["theme"];

type Props = {
  onClose: () => void;
  onOpen: (name: string) => void;
};

const STARTER_EXAMPLES = ["hello world", "input", "bouncing actor"];
const GAME_EXAMPLES = [
  "snake", "sokoban", "asteroids", "catch", "platformer", "slime runner", "coin hop",
];
const FEATURED_EXAMPLES = new Set([...STARTER_EXAMPLES, ...GAME_EXAMPLES]);

function displayName(name: string): string {
  return name
    .split(" ")
    .map((word) => word === "p5" ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function ExampleButton({ name, theme, onOpen }: { name: string; theme: Theme; onOpen: () => void }) {
  const { t } = useTranslation();
  const title = displayName(name);

  return (
    <button
      type="button"
      aria-label={t("examples.open", { name: title })}
      onClick={onOpen}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        width: "100%",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 12px",
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: theme.radiusCard,
        background: theme.surface,
        color: theme.panelTxt,
        fontFamily: theme.fontUI,
        fontSize: 14,
        fontWeight: 600,
        textAlign: "left",
      }}
    >
      <span>{title}</span>
      <span style={{ color: theme.linkTxt, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
        {t("examples.openAction")} →
      </span>
    </button>
  );
}

export default function ExamplesPanel({ onClose, onOpen }: Props) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const moreExamples = Object.keys(Examples).filter((name) => !FEATURED_EXAMPLES.has(name));
  const sections = [
    { label: t("examples.startHere"), names: STARTER_EXAMPLES },
    { label: t("examples.games"), names: GAME_EXAMPLES },
    { label: t("examples.more"), names: moreExamples },
  ].filter((section) => section.names.length > 0);

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
        <button
          type="button"
          onClick={onClose}
          title={t("sideMenu.close")}
          aria-label={t("sideMenu.close")}
          style={{
            all: "unset", cursor: "pointer", width: 28, height: 28, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: theme.panelTxtMute,
          }}
        >
          <Icon name="close" size={16} color="currentColor" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px 20px" }}>
        <p style={{
          margin: "0 2px 16px", fontSize: 14, lineHeight: 1.5,
          color: theme.panelTxtMute, fontFamily: theme.fontUI,
        }}>
          {t("examples.intro")}
        </p>
        {sections.map((section) => (
          <section key={section.label} style={{ marginBottom: 18 }}>
            <h2 style={{
              margin: "0 2px 8px", fontSize: 12, fontWeight: 700,
              color: theme.panelTxtMute, fontFamily: theme.fontUI,
            }}>
              {section.label}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.names.map((name) => (
                <ExampleButton key={name} name={name} theme={theme} onOpen={() => onOpen(name)} />
              ))}
            </div>
          </section>
        ))}
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
