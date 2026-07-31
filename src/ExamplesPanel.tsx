import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { EXAMPLES_CATALOG } from "./data/examplesCatalog";

type Theme = ReturnType<typeof useThemeStore.getState>["theme"];

type Props = {
  onClose: () => void;
  onOpen: (name: string) => void;
};

export default function ExamplesPanel({ onClose, onOpen }: Props) {
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

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {EXAMPLES_CATALOG.map((topic) => (
          <div key={topic.i18nKey} style={{ marginBottom: 14 }}>
            <div style={{
              padding: "4px 16px", fontSize: 10, fontWeight: 700,
              color: theme.panelTxtMute, textTransform: "uppercase",
              letterSpacing: "0.06em", fontFamily: theme.fontUI,
            }}>
              {t(`examplesGallery.topics.${topic.i18nKey}.title`)}
            </div>
            {topic.entries.map((entry) => (
              <ExampleRow
                key={entry.key}
                theme={theme}
                label={t(`examplesGallery.entries.${entry.i18nKey}.name`)}
                blurb={t(`examplesGallery.entries.${entry.i18nKey}.blurb`)}
                onClick={() => onOpen(entry.key)}
              />
            ))}
          </div>
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

function ExampleRow({ theme, label, blurb, onClick }: {
  theme: Theme; label: string; blurb: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      title={blurb}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
        cursor: "pointer", background: hover ? theme.chip : "transparent",
        borderRadius: 4, margin: "0 6px",
      }}
    >
      <Icon name="play" size={13} color={theme.panelTxtMute} />
      <span style={{
        flex: 1, fontSize: 12, fontFamily: theme.fontUI, color: theme.panelTxt,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}
