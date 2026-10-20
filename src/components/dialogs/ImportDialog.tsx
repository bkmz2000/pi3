import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../state/useTheme";

type ImportDialogProps = {
  onClose: () => void;
  onImport: (file: File) => void;
};

export default function ImportDialog({ onClose, onImport }: ImportDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [cancelHovered, setCancelHovered] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      onClose();
    }
  };

  const buttonBase: React.CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    minHeight: 40,
    padding: "8px 16px",
    borderRadius: theme.radiusButton,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: theme.fontUI,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        style={{
          width: 384,
          maxWidth: "calc(100vw - 32px)",
          boxSizing: "border-box",
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 10,
          padding: 24,
          boxShadow: theme.shadowWindow,
          color: theme.panelTxt,
          fontFamily: theme.fontUI,
        }}
      >
        <h3
          id="import-dialog-title"
          style={{ margin: "0 0 16px", fontSize: 17, fontWeight: theme.weightHeader }}
        >
          {t("sideMenu.importProjectTitle")}
        </h3>
        <p
          id="import-dialog-instructions"
          style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55, color: theme.panelTxtMute }}
        >
          {t("sideMenu.importProjectInstructions")}
        </p>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          aria-label={t("sideMenu.importProjectTitle")}
          aria-describedby="import-dialog-instructions"
          style={{
            boxSizing: "border-box",
            width: "100%",
            minHeight: 44,
            padding: 8,
            background: theme.editorBg,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: theme.radiusButton,
            fontFamily: theme.fontUI,
            fontSize: 14,
            color: theme.panelTxt,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            style={{
              ...buttonBase,
              background: cancelHovered ? theme.panelHeader : theme.chip,
              color: theme.panelTxt,
            }}
          >
            {t("sideMenu.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
