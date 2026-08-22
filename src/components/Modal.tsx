import { useEffect, useRef } from "react";
import { useThemeStore } from "../state/useTheme";
import { Icon } from "./Icons";

/**
 * The single modal shell — theme-aware scrim (canvasOverlay), window
 * (radiusWindow + shadowWindow), ESC to close, click-outside to close,
 * and a focus trap so Tab stays inside the dialog. Header (title + close)
 * is optional; the body is the caller's children.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 440,
  minWidth,
  zIndex = 100,
  closeOnScrim = true,
}: {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  minWidth?: number;
  zIndex?: number;
  closeOnScrim?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // ESC to close (capture phase so nested handlers can't swallow it) +
  // remember what had focus so we can restore it on close.
  useEffect(() => {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      lastFocusRef.current?.focus?.();
    };
  }, [onClose]);

  // Move focus into the dialog on open.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Focus trap: keep Tab within the panel.
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      onClick={
        closeOnScrim
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
      style={{
        position: "fixed",
        inset: 0,
        background: theme.canvasOverlay,
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        style={{
          width,
          minWidth,
          maxWidth: "95vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: theme.surfacePanel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: theme.radiusWindow,
          boxShadow: theme.shadowWindow,
          fontFamily: theme.fontUI,
          color: theme.panelTxt,
        }}
      >
        {title !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              borderBottom: `1px solid ${theme.panelBorder}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.panelTxt }}>
              {title}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
                color: theme.panelTxtMute,
              }}
            >
              <Icon name="close" size={15} color="currentColor" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
