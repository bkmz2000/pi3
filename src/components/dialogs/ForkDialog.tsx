import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../state/useTheme";

type ForkDialogProps = {
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export default function ForkDialog({ onClose, onSave }: ForkDialogProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelHovered, setCancelHovered] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === "Unauthorized" ? "Sign in to save your project" : msg);
    } finally {
      setSaving(false);
    }
  };

  const isAuthError = error === "Sign in to save your project";
  const dialogStyle: React.CSSProperties = {
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
    transition: "background 0.15s, opacity 0.15s",
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
        aria-labelledby="fork-dialog-title"
        aria-busy={saving}
        style={dialogStyle}
      >
        <h3
          id="fork-dialog-title"
          style={{ margin: "0 0 8px", fontSize: 17, fontWeight: theme.weightHeader }}
        >
          {t("fork.saveAsNewProject")}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55, color: theme.panelTxtMute }}>
          {t("fork.saveExampleAsProject")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              htmlFor="fork-project-name"
              style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600 }}
            >
              {t("sideMenu.projectName")}
            </label>
            <input
              id="fork-project-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") onClose();
              }}
              placeholder={t("sideMenu.projectNamePlaceholder")}
              autoFocus
              disabled={saving}
              aria-describedby={error ? "fork-dialog-error" : undefined}
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: 44,
                padding: "10px 12px",
                background: theme.editorBg,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: theme.radiusButton,
                fontFamily: theme.fontUI,
                fontSize: 14,
                color: theme.panelTxt,
              }}
            />
          </div>

          {error && (
            <div
              id="fork-dialog-error"
              role="alert"
              style={{
                padding: "8px 12px",
                background: `${theme.stopBg}22`,
                border: `1px solid ${theme.stopBg}66`,
                borderRadius: theme.radiusCard + 4,
                fontSize: 14,
                lineHeight: 1.45,
                color: theme.stopBg,
              }}
            >
              {error}
              {isAuthError && (
                <a
                  href="/api/auth/login"
                  style={{ display: "block", marginTop: 4, color: theme.accent, textDecoration: "underline" }}
                >
                  Sign in
                </a>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              onMouseEnter={() => setCancelHovered(true)}
              onMouseLeave={() => setCancelHovered(false)}
              style={{
                ...buttonBase,
                cursor: saving ? "not-allowed" : "pointer",
                background: cancelHovered && !saving ? theme.panelHeader : theme.chip,
                color: theme.panelTxt,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {t("sideMenu.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              onMouseEnter={() => setSaveHovered(true)}
              onMouseLeave={() => setSaveHovered(false)}
              style={{
                ...buttonBase,
                cursor: !name.trim() || saving ? "not-allowed" : "pointer",
                background: theme.actionBg,
                color: theme.actionTxt,
                opacity: !name.trim() || saving ? 0.5 : saveHovered ? 0.9 : 1,
              }}
            >
              {saving ? t("fork.saving") : t("fork.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
