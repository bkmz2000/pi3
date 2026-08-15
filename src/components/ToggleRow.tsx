import type { Theme } from '../state/useTheme';

export function ToggleRow({
  label,
  hint,
  on: checked,
  theme,
  accent,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  theme: Theme;
  accent?: string;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) onChange?.(!checked); }}
      style={{
        all: "unset",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        marginBottom: 6,
        background: theme.chip,
        borderRadius: theme.radiusCard,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            color: theme.panelTxt,
            fontSize: 14,
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: theme.fontUI,
              fontSize: 12,
              color: theme.panelTxtMute,
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <span
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: checked ? (accent || theme.runBg) : theme.panelBorder,
          position: "relative",
          transition: "background 0.18s",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 0.18s",
          }}
        />
      </span>
    </button>
  );
}
