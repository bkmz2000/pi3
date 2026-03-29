import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

type SidePanelProps = {
  id: string;
  title: string;
  open: boolean;
  side?: "left" | "right";
  onClose: () => void;
  children: React.ReactNode;
};

export default function SidePanel({
  id,
  title,
  open,
  side = "left",
  onClose,
  children,
}: SidePanelProps) {
  const { t } = useTranslation();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => prevFocusRef.current?.focus?.(), 0);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const base =
    "fixed top-0 z-40 h-screen w-[20rem] max-w-[85vw] bg-cyan-800 text-white shadow-xl border-white/10 " +
    "transform transition-transform duration-300 ease-out flex flex-col";
  const sideCls =
    side === "left"
      ? `left-15 border-r ${open ? "translate-x-0" : "-translate-x-full"}`
      : `right-0 border-l ${open ? "translate-x-0" : "translate-x-full"}`;

  return (
    <aside
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className={`${base} ${sideCls} ${!open ? "hidden" : ""}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 id={`${id}-title`} className="text-sm font-semibold">
          {title}
        </h2>
        <button
          ref={closeBtnRef}
          onClick={handleClose}
          className="px-2 py-1 text-xs rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {t('sideMenu.close')}
        </button>
      </div>
      <div className="flex-1 min-h-0 p-3 overflow-auto text-sm">{children}</div>
    </aside>
  );
}
