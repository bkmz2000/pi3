import { Icon } from "./Icons";
import type { Theme } from "../state/useTheme";

export function CloseButton({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
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
