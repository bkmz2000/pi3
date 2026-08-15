import { useRef, type PointerEvent } from "react";

/**
 * Drag-to-scrub-a-track behavior: converts a pointer's x position within a
 * ref'd element into a 0..total-1 frame index and reports it via onChange.
 * Shared by DebugPanel's flipbook timeline and the WelcomePage marketing
 * demo's timeline — same interaction, different rendered markup.
 */
export function usePointerScrub<T extends HTMLElement>(total: number, onChange: (idx: number) => void) {
  const trackRef = useRef<T>(null);
  const dragging = useRef(false);

  const posToFrame = (clientX: number): number => {
    const el = trackRef.current;
    if (!el || total <= 1) return 0;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(frac * (total - 1));
  };

  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onChange(posToFrame(e.clientX));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    onChange(posToFrame(e.clientX));
  };
  const onPointerUp = (e: PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
  };

  return { trackRef, onPointerDown, onPointerMove, onPointerUp };
}
