import { useTranslation } from "react-i18next";
import { Icon } from "./Icons";
import type { Theme } from "../state/useTheme";

export function CloseButton({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t('sideMenu.close')}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 10,
        cursor: "pointer",
        color: theme.panelTxtMute,
        background: "transparent",
        border: "none",
        outline: "none",
      }}
    >
      <Icon name="close" size={18} color="currentColor" />
    </button>
  );
}
