import { useEffect, useRef } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { postLivePresence } from './api';
import { isExampleSessionId } from './sessionId';
import { useLiveSession } from './useLiveSession';

const PING_INTERVAL_MS = 1000;
const IDLE_AFTER_MS = 60_000; // stop pinging if no keyboard/mouse for 60s

// Cheap, dependency-free string hash (FNV-1a). Only used to detect whether the
// buffer changed since the last ping so we can skip re-sending unchanged code.
function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Emits a live-presence ping (project id + current file + cursor line) to the
 * server about once a second so the teacher dashboard and the session roster
 * read as live. The buffer itself rides along only when it changed.
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
  const lastSentHash = useRef<string | null>(null);
  const lastLine = useRef(1);

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

  // Reactive session id so joining/leaving a session re-runs the effect (a
  // session must broadcast even from an unsaved/example buffer).
  const sid = useLiveSession((s) => s.sid);
  const sessionToken = useLiveSession((s) => s.token);

  useEffect(() => {
    if (!loggedIn) return;
    // Presence key: a real saved project id, or — while in a session — a
    // synthetic per-session id so peers still see the buffer without a save.
    const hasRealProject = !!projectId && !isExampleSessionId(projectId);
    const presenceProjectId = hasRealProject ? projectId! : (sid ? `session:${sid}` : null);
    if (!presenceProjectId) return;

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
      lastLine.current = line;
      // Send the current buffer only when it changed since the last ping
      // (skip-unchanged); the roster stays cheap and the server keeps the last
      // known content via COALESCE. session_id is always sent (null clears it).
      const text = view.state.doc.toString();
      const hash = hashText(text);
      const changed = hash !== lastSentHash.current;
      // Mark as sent synchronously (before the await) so a fast follow-up tick
      // sees the updated hash and doesn't re-send the same unchanged buffer.
      lastSentHash.current = hash;
      try {
        await postLivePresence(presenceProjectId, currentFile || 'main.py', line, {
          ...(changed ? { content: text, contentHash: hash } : {}),
          sessionId: sid,
          sessionToken,
        });
      } catch {
        // best-effort; server may be offline or session expired
      }
    };

    // First ping immediately so the roster populates fast, then poll.
    void tick();
    const id = window.setInterval(() => { void tick(); }, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      // Leaving a session has to clear the stamp explicitly. The synthetic
      // `session:<sid>` row is never pinged again once sid goes away (the next
      // effect run bails at `presenceProjectId`), so without this the leaver
      // keeps showing up on their peers' roster until the row goes stale.
      if (sid && presenceProjectId.startsWith('session:') && useLiveSession.getState().sid !== sid) {
        void postLivePresence(presenceProjectId, currentFile || 'main.py', lastLine.current, { sessionId: null })
          .catch(() => { /* best-effort */ });
      }
    };
  }, [projectId, currentFile, editorRef, loggedIn, sid, sessionToken]);
}
