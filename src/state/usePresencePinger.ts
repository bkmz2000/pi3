import { useEffect, useRef } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { postLivePresence } from './api';
import { isExampleSessionId } from './sessionId';

const PING_INTERVAL_MS = 3000;
const IDLE_AFTER_MS = 60_000; // stop pinging if no keyboard/mouse for 60s

/**
 * Emits a live-presence ping (project id + current file + cursor line) to the
 * server every few seconds so the teacher dashboard can render a live roster.
 *
 * Runs only for real, saved projects (skips example sessions and anon work).
 * Silently no-ops on 401 or transient network failure — presence is best-effort
 * telemetry, never blocking.
 */
export function usePresencePinger(args: {
  projectId: string | null;
  currentFile: string;
  editorRef: React.RefObject<ReactCodeMirrorRef | null>;
  loggedIn: boolean;
}) {
  const { projectId, currentFile, editorRef, loggedIn } = args;
  const lastActivity = useRef(0);

  // Track user activity so we don't spam the server while a tab is idle.
  useEffect(() => {
    lastActivity.current = Date.now();
    const bump = () => { lastActivity.current = Date.now(); };
    window.addEventListener('keydown', bump, { passive: true });
    window.addEventListener('mousemove', bump, { passive: true });
    window.addEventListener('touchstart', bump, { passive: true });
    return () => {
      window.removeEventListener('keydown', bump);
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('touchstart', bump);
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || !projectId || isExampleSessionId(projectId)) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - lastActivity.current > IDLE_AFTER_MS) return;
      const view = editorRef.current?.view;
      if (!view) return;
      const pos = view.state.selection.main.head;
      let line = 1;
      try {
        line = view.state.doc.lineAt(pos).number;
      } catch {
        return;
      }
      try {
        await postLivePresence(projectId, currentFile || 'main.py', line);
      } catch {
        // best-effort; server may be offline or session expired
      }
    };

    // First ping immediately so the roster populates fast, then poll.
    void tick();
    const id = window.setInterval(() => { void tick(); }, PING_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [projectId, currentFile, editorRef, loggedIn]);
}
