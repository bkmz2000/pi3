# Pre-launch smoke tests

Manual checklist to run against `npm run dev:all` (frontend `:5173` + backend `:3001`)
the day before / morning of launch. Scope is frontend + Pyodide runner; backend
and OAuth flows are covered by `npm run test:server:ci` and are intentionally
out of scope here.

**Estimated time:** ~20 min single-pass, ~10 min if you skip P2.

**Before you start:**
- Clean profile: open in an Incognito window (no SW, no localStorage carryover).
- DevTools open, **Console** + **Performance** tabs visible.
- Set Network throttling to "Fast 3G" for the save-race cases (P1.4, P1.5).
  Reset to "No throttling" for the rest.
- `npm run typecheck && npm test -- --silent` clean on the branch.

A failure of any **P0** case is launch-blocking. **P1** failures should be
triaged: ship-block if user-visible data loss or freeze, otherwise hotfix
within 24h. **P2** is post-launch.

---

## P0 — Launch-blocking smoke

### P0.1 — Cold boot
1. Load `/`. Watch the console.
2. **Pass:** no red errors; Pyodide ready chip / loading screen disappears within ~10s.
3. **Pass:** the default "hello world" example is editable.

### P0.2 — Run user code
1. Click **Run**. Console pane shows the expected output.
2. Edit the file to `print(1/0)`. Click **Run**.
3. **Pass:** `ZeroDivisionError` in console; the editor is still responsive; the
   Run button returns to idle (not stuck on "running").

### P0.3 — Save & dirty-flag basics
1. Modify a file. **Pass:** dirty marker appears on the tab; save chip shows
   "Unsaved changes".
2. Press **Ctrl+S**. **Pass:** chip transitions through "Saving…" → clean
   within 3s.
3. Reload the page. **Pass:** edit persists.

### P0.4 — Sprite editor hot-path (regression for yesterday's freeze)
1. Open the side rail → **Assets** → open the sheet editor.
2. Hold left mouse and paint a continuous stroke across the canvas for **≥10
   seconds** without releasing.
3. While painting, press `b`, `e`, `g`, `[`, `]`, `x` (tool switches +
   palette swap + frame nav).
4. **Pass:** no visible frame drops; brush always tracks the cursor with <100ms
   lag; shortcuts respond on first press.
5. Open Performance tab, record 5s of painting. **Pass:** no long task >100ms
   in the main thread except the initial paint setup.

### P0.5 — Tilemap editor hot-path
1. Open the tilemap editor on a map with **at least 200 painted cells** (use an
   existing example or paint a rectangle).
2. Pan the map by drag for 5s in a continuous motion.
3. Zoom in/out with the wheel 10 times.
4. **Pass:** pan is smooth (no stutter visible to the eye); zoom updates without
   blank frames.

### P0.6 — Error boundary covers editor crash
1. Open DevTools → Sources → set a breakpoint inside `SheetEditor` `renderCanvas`
   and `throw new Error("test")` from the breakpoint (or temporarily edit
   `renderCanvas` to throw on first call).
2. **Pass:** the sprite editor area shows the fallback ("Sprite editor crashed"
   + Try again / Reload buttons).
3. **Pass:** rest of the IDE (file list, code editor, console) is still usable.
4. Click **Try again** with the throw removed. **Pass:** editor recovers.

### P0.7 — Error boundary covers canvas runner crash
1. Run a Python program that calls a deliberately bad graphics API
   (e.g. `graphics.set_color("not a color")` if that throws, or any
   exception in `update()`).
2. **Pass:** error appears in console; canvas window either shows the error
   boundary fallback or returns to idle. App does not white-screen.

### P0.8 — Anonymous stash persistence
1. In Incognito (logged out), open an example (e.g. "asteroids"). Edit the
   `main.py`.
2. Reload the page.
3. **Pass:** your edits survived (stash restored).

---

## P1 — Regression checks for the fixes we just landed

### P1.1 — SheetEditor keydown listener stability
1. Open sprite editor. Paint heavily for 30s (continuous strokes + tool
   switches).
2. Stop painting. Press `Ctrl+Z` 5 times.
3. **Pass:** undo works on the first press each time. (If it took several
   tries, the listener regressed — multiple handlers registered.)

### P1.2 — TileEditor pan offset via Group
1. Paint cells at columns 0, 50, 100 in a tilemap (so they're far apart).
2. Pan such that each cell crosses the viewport edge.
3. **Pass:** cells appear/disappear smoothly at the viewport edge; their
   relative spacing stays exactly consistent under pan. (Watching for a
   pan-offset bug from the Group refactor.)

### P1.3 — Auto-save race: edit during in-flight save
1. Throttle network to Fast 3G in DevTools.
2. Type a character in a file. Wait 3s for the debounced save to fire (chip
   shows "Saving…").
3. **While the save is in flight**, type another character.
4. **Pass:** when the save chip clears to "Saved", the file is still marked
   dirty (chip says "Unsaved" or similar) — the second character is *not*
   silently marked clean.
5. Wait another 3s. **Pass:** second save fires, clears the dirty flag for
   real.

### P1.4 — Ctrl+S race
Same as P1.3 but the trigger is Ctrl+S instead of debounce. Type during
the in-flight save; second edit must remain dirty.

### P1.5 — anonStash quota error chip
1. In Incognito, open an example.
2. In DevTools console, run:
   ```js
   const blob = "x".repeat(2_500_000);
   for (let i = 0; i < 5; i++) localStorage.setItem("pad" + i, blob);
   ```
   to fill localStorage to near-quota.
3. Edit the file. Wait for autosave (or Ctrl+S).
4. **Pass:** save chip shows "Local storage full — sign in to save your work"
   (red). No silent failure.
5. Clear with `localStorage.clear()`. **Pass:** next save succeeds and the
   chip clears.

### P1.6 — Multi-editor error isolation
1. Open the sprite editor. Force a crash in it (P0.6).
2. Without reloading, close the sprite editor modal, then open the **tilemap**
   editor on a different asset.
3. **Pass:** tilemap editor opens normally — the sprite-editor boundary's
   error state does not leak across.

---

## P2 — Polish / can-fix-after-launch

### P2.1 — Theme switch
1. Settings panel → switch theme. **Pass:** all panels re-skin; no flash of
   unstyled content; sprite editor + tilemap editor pick up new theme.

### P2.2 — Docs panel
1. Open Docs panel. Switch language. **Pass:** content swaps; search still
   works.

### P2.3 — Examples list
1. Open Projects → built-in examples. Open each one. **Pass:** each runs
   without import errors. (If pressed for time, just smoke 3-4.)

### P2.4 — Console behaviors
1. Long stdout (loop `print` 100 times). **Pass:** console scrolls; copy
   button copies all output.
2. `input()` prompt. **Pass:** input field appears; submitting resumes
   execution.

### P2.5 — Beforeunload prompt
1. Make an unsaved edit on a real (named) project.
2. Try to close the tab.
3. **Pass:** browser prompts to confirm.

### P2.6 — Multi-tab project edit
1. Open the same project in 2 tabs. Edit different files in each.
2. Save both. **Pass:** last-save-wins; no crash; no infinite reload loop
   from anonStash. (Document any inconsistency — multi-tab conflict is a
   known limitation, not a blocker.)

### P2.7 — Service worker check
1. DevTools → Application → Service Workers.
2. **Pass:** no SW registered (current intended state). If you see one,
   investigate before launch — the `public/sw.js` file ships but no code
   registers it; if a registration sneaked in, it could pin users to a stale
   cache.

---

## Sign-off

| Pass set | Required? | Verifier | Date |
|----------|-----------|----------|------|
| P0       | Yes       |          |      |
| P1       | Yes for non-cosmetic |  |      |
| P2       | No        |          |      |

Report each P0/P1 failure as a GitHub issue tagged `launch-blocker` before
deploying.

---

## Automation roadmap (post-launch)

The Puppeteer skeleton at `tests/puppeteer/ide-smoke-test.js` implements the
deterministic subset (P0.1–P0.3, P0.8, P1.5). Cases requiring visual judgment
of smoothness (P0.4, P0.5, P1.2) or breakpoint manipulation (P0.6, P0.7) stay
manual or move to dedicated performance benchmarks.

Run with:
```bash
npm run dev:all   # in one terminal
npm run test:smoke  # in another
```
