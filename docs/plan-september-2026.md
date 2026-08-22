# pi³ September 2026 — Polish Sprint (pre-course)

**Goal:** take pi³ from "3 students, some functions scaffolded" to a reasonably polished
product for a 100-student online course starting October 2026.

**Context sources:** `docs/pedagogical-audit.md` (2026-08-20), `PROJECT_KNOWLEDGE.md` §7,
`code-review/07-specific-bugs.md`, `docs/ROADMAP.md`, systems review 2026-08-22 (scaffolding),
UI audit 2026-08-22 (LLM-tells). Status legend: `[ ]` not started · `[~]` in progress · `[x]` done.

---

## Guiding principles

1. **Kids pay for every wart once; teachers pay for every loop gap daily.** Fix kid-visible
   friction first (linter, errors, API traps), classroom loops second (comments), polish third.
2. **The design language already exists — the problem is enforcement, not invention.**
   No raw hex outside `useTheme.ts`; one Modal; ErrorCard on severity tokens; marketing CSS
   from the theme store. Add a lint rule so it never regresses.
3. **Nothing ships without the gate.** `make test` + `validate_graphics.py` + e2e smoke before
   each deploy. The pre-push hook is the contract.
4. **Cut the optional tail explicitly.** Moderation UI, public-listing reviewer UI, onion skin,
   PNG import, inline lint markers, full A-Z docs rebuild are parked — revisit post-launch.

---

## Week 1 — Unblock kids + UI foundation

### Kids-facing API (P0)
- [x] **1. Linter default-on.** `IdeState.ts:85` gates on `pi3_enableLinting === "true"` → fresh
      students get zero hints. Default ON for new students; first-run prompt explains the toggle.
      *(2026-08-22: default flipped to `!== "false"` + first-run toast, en/ru i18n.)*
- [x] **2. Style rules never block.** Move E501 (line>100) and E303 (>4 blank lines) from the
      blocking "grammar" category to warnings. A 10yo's game must not refuse to run over a long line.
      *(2026-08-22: both → severity=warning, new non-blocking "style" category; frontend union + card maps updated.)*
- [x] **3. `say()` accepts (x, y) or raises friendly.** `say("hi", 100, 100)` currently dies with a
      raw AttributeError (`_errors.py` shim path). Accept both forms like `text()`, or friendly error.
      *(2026-08-22: `say(text, x, y)` form added; docs + validate_graphics tests.)*
- [x] **4. `rect()` vs `Rect` anchoring trap.** `g.rect` = top-left, `Rect` actor = center
      (PK §7.5). Add `center=` option to `rect()` (or loud cross-doc), update DocsPanel + examples.
      *(2026-08-22: `center=True` kwarg added; docs + tests.)*

### UI polish (LLM-tell removal)
- [x] **5. ErrorCard redesign** (`ConsolePanel.tsx`). Kill the 7-hue Tailwind rainbow + emoji
      (🔤🔀📝🔍🧮🔧⚙️❗) and `system-ui` hardcode. Map categories to 2 severity axes using tokens
      (`errorLine`, `warnLine`/`tabDirty`, `panelTxtMute`, `accent`); icons via `Icon` component.
      This also fixes the audit's "info density/jargon" complaints.
      *(2026-08-22: 2 severity axes (error→alert octagon/errorLine, warning→warn triangle/warnLine);
      card on chip + severity rail + radiusWindow + fontUI; chips on errorChipTxt. New IconAlert added.)*
- [x] **6. One shared `Modal` component.** Consolidate the 4 hand-rolled copies
      (ThemedDialog, NewProjectDialog, ShareDialog, ImportProblemsModal): theme-aware scrim
      (`canvasOverlay`), `radiusWindow`, ESC + focus trap. Design doc already flags the
      radius-10 "judgment call" — close it.
      *(2026-08-22: new `components/Modal.tsx` — canvasOverlay scrim + blur, radiusWindow, shadowWindow,
      ESC + focus trap + focus restore; all 4 dialogs now wrap it. ThemedDialog kept as thin wrapper.)*
- [x] **7. No-raw-hex lint rule + sweep.** ESLint rule banning hex literals outside `useTheme.ts`;
      fix existing violations (grep list: `#7ec98f`, `#ff7a7a`, `#f0b429`, `#ec4899`…).
      *(2026-08-22: `eslint-rules/no-raw-hex.mjs` (flat config, allowlist for pixel-data/editor
      files + tests + welcome CSS pending #16); 52 chrome violations fixed to tokens across 20 files;
      RuleTester test; full-repo lint clean. Welcome marketing CSS deferred to #16.)*

### Known bugs (verified open)
- [x] **8.** `canvasActive` resets before worker ack → canvas flash on stop (`RunnerProvider.tsx:111`)
      *(already fixed in code — `interrupt()` waits for `interrupt_ack` before `stop()`, 500ms hard-kill fallback; plan ref stale.)*
- [x] **9.** `lint()` worker `message` listener leak (`RunnerProvider.tsx:~372`)
      *(already fixed in code — `settled` guard + `removeEventListener` in `finish()` + 10s timeout.)*
- [x] **10.** `showHitboxes` uses `defaultChecked` — toggle does nothing (`SideMenu.tsx:524`)
      *(already fixed in code — controlled `ToggleRow` (`on`/`onChange`) since `a29efb7`.)*
- [x] **11.** `db_version` rows accumulate — `REPLACE` instead of `INSERT` (`server/db/index.ts`)
      *(already fixed — table is now `schema_migrations` with `filename TEXT PRIMARY KEY` + guard SELECT before insert.)*

**Week-1 exit:** gate green; ErrorCard + Modal merged; linter on for new students.
*(2026-08-22: all 11 Week-1 items done — 1-4 implemented today; 8-11 verified already-fixed in code;
5-7 merged. Gate: eslint clean, tsc clean, 89 frontend suites (921 tests), 28 server suites (376 tests),
validate_graphics + validate_linter green.)*

---

## Week 2 — Classroom loop + progression

- [ ] **12. Student comment view.** Teacher→student comments exist server-side + teacher UI
      (`comments.ts`, `TeacherProjectView.tsx`); students cannot see them. Ship the student view —
      for a 100-student course, teacher feedback is the core loop. (Roadmap: "planned/medium".)
- [ ] **13. Difficulty/age tags on examples + gallery ordering.** Add `difficulty` to
      `examplesCatalog.ts` entries, order within topics as a progression, default the gallery to
      the 10-year-old path, add "start here". (Audit §5.1.)
- [ ] **14. Finish example set v1.** ~7 planned examples unwritten, sokoban needs fixing (ROADMAP).
      Prioritize non-game entries (turtle, math visualization) to balance the all-games set.
- [ ] **15. Linter strictness modes.** Teacher setting for age band: style rules + W002–W004 off
      for younger; fix W003 Latin-only vowel ratio (Cyrillic idents score 0 in a bilingual product).
- [ ] **16. Marketing CSS from the theme store.** `welcome/shared.tsx` + gallery inject a parallel
      hardcoded palette (`#7ec98f`, `#d97a5a`, `#7ba5d4`, green `#34a853` Open CTAs). Generate
      `WELCOME_CSS` from tokens; CTA → `accent`; tokenize LivePanel/LiveRoster online dots.

**Week-2 exit:** students can see teacher comments; gallery is navigable by difficulty.

---

## Week 3 — Consistency + docs

- [ ] **17. Teacher UI componentization.** `TeacherProblemForm.tsx` (17× radius≥8), 
      `ImportProblemsModal.tsx` (9×) + raw hex → `Field`/`StatusPill`/`Stat` over tokens
      (amber → `tabDirty`, red → `errorLine`). LoginDialog is the token-compliant model.
- [ ] **18. Kill the MigrationProxy.** Anchors, `Shape.bounds`, `Timer.done` still raise on benign
      reads (`print(actor.center)`, `actor.center.x`) and lecture about renames kids never did
      (PK §7.4). Convert to real properties; reword remaining shims to "did you mean `center()`?".
- [ ] **19. API warts batch** (PK §7.6): `watch('score')` quote keys; `Group.__len__` dead-actor
      count; `fill`/`fill(None)`/`no_fill` docs; `Colors.random` vs `random_color()` merge;
      `text()` docstring + padding kwargs.
- [ ] **20. Single source of truth for the API surface.** Generate `docs/api-v1.md` from
      `_manifest.py`; CI test that every DocsPanel entry resolves against `EXPORTED_NAMES`
      (PK §7.7 — the last big docs-drift item).
- [ ] **21. CSP decision + headers.** No CSP today; CDN + user-code execution. Decide policy,
      add headers (institutional profile). Must be a documented decision, not drift.
- [ ] **22. Type scale + gallery typography.** `fontWeight: 800` → 700 (design language is
      500/600/700); 28px h1s → the established scale.

**Week-3 exit:** gate green; no raw hex in new code; docs CI in place.

---

## Week 4 — Launch prep

- [ ] **23. Concurrency smoke.** ~30 simultaneous live sessions (1s presence cadence) + rapid
      saves on the VPS; rate-limit sanity (per-user limiter). 100 students is the target.
- [ ] **24. i18n sweep + parity re-check.** All new strings en/ru; parity test green.
- [ ] **25. Pre-launch smoke checklist** (`docs/pre-launch-smoke.md`) executed end-to-end.
- [ ] **26. Deploy + version freeze.** `make deploy`; confirm freeze-updates toggle + billing caps
      so the class's pinned version doesn't drift mid-term.
- [ ] **27. (Stretch) Guided missions lite.** 3–5 step missions per topic — only if weeks ran ahead.

### Parked (explicit cuts)
Moderation UI (route exists, no surface — doctrine CORE-4 on paper only), public-listing reviewer
UI (CORE-7, intentionally parked), sprite-editor onion skin + PNG import, inline CodeMirror lint
markers, full A-Z docs rebuild. Revisit after course start.

---

## Verification per item

| Gate | Command |
|------|---------|
| Python API | `python3 tests/unit/validate_graphics.py` (PYTHONPATH=src/assets/python) |
| Full gate | `make test` (lint + typecheck + 88 frontend suites + server suites) |
| API surface | `npx jest tests/unit/apiSurfaceSnapshot.test.ts` (+ graphicsDocs/graphicsPython) |
| E2E smoke | `make e2e-smoke` (Puppeteer) before each deploy |
| Deploy | `make deploy` → health check + digest confirm on VPS |

## Definition of done (October)

1. Fresh student opens the IDE and gets lint hints immediately; no style rule blocks a run.
2. `say()` never shows a raw traceback; `rect()` trap documented/softened.
3. Teacher comments are visible to students; gallery has a clear progression path.
4. No raw hex outside `useTheme.ts`; one Modal; ErrorCard on severity tokens.
5. Full gate green at every deploy; version frozen for the course.
