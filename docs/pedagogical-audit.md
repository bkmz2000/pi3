# Pedagogical Audit of pi³ (2026-08)

**Scope:** API & UI intuitiveness/consistency, asset-sheet mechanism, friendly errors & linter, and
progression for kids of different ages. Based on source at HEAD, PROJECT_KNOWLEDGE §7, the KB, and a
review of all 27 built-in examples. Audience question: is this a good *teaching* tool, or a good
*engine* wearing a teaching coat?

---

## 1. Executive summary

pi³ is an unusually well-engineered teaching IDE with real, evidence-based pedagogical investments:
bilingual en/ru everywhere (parity-tested), a structured friendly-error system with click-to-apply
suggestions, deterministic teacher-authored testing, a teacher dashboard with live sessions, and
zero-install delivery. That part is genuinely above the bar for kid coding tools.

Its structural weakness is a **breadth-vs-scaffolding mismatch**: the API surface (~110 exported
names + actors + tilemaps + camera + lighting + vectors + pixel API + debug visualization) and two
full pixel editors grew faster than the curriculum that would let a 10-year-old navigate them.
The project is unusually honest about its own debt (PROJECT_KNOWLEDGE §7 lists the API warts itself).

Verdicts on the two hypotheses:
1. **Asset-sheet mechanism = overengineering for most tasks — yes, as a *default* path; fine as an
   *optional* path.** The sprite-sheet pipeline (512×512 pixel editor → regions → animation strips →
   `SheetAnimation`/`AnimationController`/`tick()`) is a second skill (pixel art) bolted onto a
   programming course. The median kid task — bouncing ball, snake, catch — needs nothing but shapes.
   The **library-sprite path** (`assets.platformer.hero`, `assets.platformer.coin`) is the right
   cost/benefit: pre-made sprites, zero authoring. Only 6 of 27 examples reference `assets.` at all.
2. **Friendly errors / linter distract and confuse — partly yes.** The *runtime* FriendlyError system
   is a clear win and rarely confuses. The confusers are specific and fixable: style rules that block
   execution (E501 line-too-long, E303 too-many-blank-lines are in the blocking "grammar" category),
   name-heuristic warnings that misfire for the actual audience (W002 flags `data`/`value`/`result` —
   perfectly normal kid names; W003's vowel-ratio test is Latin-only and would flag Cyrillic
   identifiers), migration-shim errors that lecture kids about renames they never performed, and
   teacher-jargon summaries ("3 grammar, 1 naming — fix before running").

---

## 2. API intuitiveness & consistency

### What works
- **The core loop is intuitive:** draw shapes (`circle`/`rect`), make an `Actor`, override
  `update()`/`draw()`, poll `Mouse`/`Keyboard`, call `run(main)`. `from graphics import *` keeps
  typing minimal. A 10-year-old can go from hello_world to a bouncing ball in one session.
- **Angle convention 0° = up, 90° = right, clockwise** matches Scratch — a smart, kid-aligned choice.
- **Sealed actors**: assigning an undeclared attribute raises a friendly error instead of silently
  creating it — this prevents a whole class of invisible bugs.
- **Typo-friendly**: Levenshtein + homoglyph + keyboard-layout suggestions on undefined names and
  unknown kwargs (`naming.actorKwargTypo`). Genuinely better than most kid IDEs.
- **Migration shims** show care for existing student projects (a rare virtue).

### Where it gets inconsistent (ranked by kid impact)
1. **`rect()` vs `Actor.Rect` — same name, opposite anchoring.** `g.rect(x,y,w,h)` anchors
   top-left; `Rect(x,y,width,height)` centers on (x,y). This is the classic beginner trap when
   switching between immediate drawing and actors, and it's the *most common* shape in both worlds.
   PROJECT_KNOWLEDGE §7.5 flags it; the fix (a `center=` option or loud cross-referencing in docs)
   is still open.
2. **`x`/`y` are properties but `pos()`/`vel()` are methods.** `actor.x = 5` works, `actor.pos = (5,6)`
   raises. The getter-method design (computed, mutation-isolated) is defensible, but the asymmetry
   is invisible until it bites. Worse, the `MigrationProxy` shim (still used by anchors,
   `Shape.bounds`, `Timer.done`) **raises on any non-call use** — including `print(actor.center)`
   or `actor.center.x` — so a kid debugging with print gets an error lecturing them about a rename
   they never did. (PROJECT_KNOWLEDGE §7.4; pos/vel were converted to real methods 2026-08-14, anchors
   remain on the shim.)
3. **Three spellings of one concept:** `fill(...)` / `fill(None)` / `no_fill()` are all documented
   as equivalent; `Colors.random` vs `random_color()` overlap (§7.6).
4. **`say()` vs `text()` asymmetry:** `say` only accepts an `AnchorPoint` — `say("hi", 100, 100)`
   dies with a *raw* AttributeError, not a friendly error (§7.6). Inconsistent with `text()`'s
   two forms.
5. **Churn is still visible:** `Timer.done()` → `is_done()`, `Light.radius/flicker/shade` were
   methods → attributes. Each rename is friendly-error-covered, but the surface itself is still
   settling, and kids' muscle memory pays the cost.
6. **`watch('score')` one-arg form keys on `repr(label)`** → shows quotes; two-arg form doesn't (§7.6).
7. **`Group.__len__` counts dead actors** until the next iteration (§7.6).

### Documentation consistency
Five sources of truth (graphicsDocs.ts, api-v1.md, _manifest.py, snapshot JSONs, AGENTS.md) have
been drifting; §7.1 documented AGENTS.md advertising decorators (`@g.on_key_press`), auto-velocity,
and `actor.pos =` that never existed, and api-v1.md claiming radians while everything is degrees.
Most was reconciled 2026-08-14 (facing-tick bug fixed, range/set/random/inspect renamed,
docs swept), but §7.7's "generate api-v1.md from the manifest" CI check is still not in place, and
the docs taxonomy rewrite is in progress (ROADMAP).

**Net:** intuitive core, inconsistent high-traffic corners, honest docs that still need a single
source of truth. For a *teaching* product this is the single highest-leverage consistency debt:
each trap above costs a kid a confused 10 minutes, and traps 1–2 are hit within the first few lessons.

---

## 3. The asset-sheet mechanism (Q1)

### What the mechanism is
- **Authoring:** `SheetEditor.tsx` — a full 512×512 pixel editor (11 tools incl. wand/region/tile
  stamp, brush sizes 1/2/4/8, undo/redo, grid to 128, horizontal animation strips) plus
  `TileEditor.tsx` (layer-based tilemaps, areas, undo/redo).
- **Data model:** sheet → sprites → named animations → frames (`x/y/frameW/frameH/frameCount`).
- **Runtime API:** `SheetNamespace`, `SpriteEntry`, `SheetAnimation`, `AnimationController`,
  `actor.<anim>.tick()`, plus the whole Tilemap API (layers/areas/groups/collisions).
- **Pitfalls attached:** `actor.image.walk.tick()` vs `actor.walk.tick()` (the CLAUDE.md common
  pitfalls list has to carry this); ZIP export **loses sheet/tilemap/sound/animation data**.

### The evidence that it's overkill for most tasks
- Of 27 examples, only **6 reference `assets.`** (and some only in a comment); **19 use plain
  shapes**. The curated gallery's two sprite-sheet examples (slime_runner 131 lines, coin_hop 121)
  are the *longest* in the set.
- The median kid task — variable/loop/condition practice, bouncing ball, snake, sokoban — needs zero
  assets. `bouncing_actor` (50 lines), `snake` (106), `sokoban` (90) are shape-only.
- Sheet authoring is **pixel art, not programming**: a kid who wants their game to look good spends
  the lesson in a drawing tool, and the concepts (regions, strips, frame counts) have zero
  transfer to programming.
- The API adds 4 exported types + `tick()` semantics + the image-vs-anim naming trap — real
  cognitive load for a feature most tasks don't touch.
- Data-loss edges: the sheet can't round-trip through ZIP export, and PNG import is only "low"
  priority on the roadmap — so the authoring pipeline is the one with the weakest import/export story.

### Where it IS justified
- Game-genre projects where the sprite is the point (platformer look-and-feel, slime runner).
- Creative expression and art-integrated lessons (teachers often want this).
- The **library path** — `assets.platformer.hero`, `.tile_grass`, `.coin`, plus a built-in demo
  sheet (hero idle/run/jump, slime, coin) — is the sweet spot: pre-made art, one line of code,
  instant payoff. Platformer (70 lines) uses it beautifully.

### Recommendation
Make the **default** asset experience library sprites + shapes. Demote the sheet editor to an
explicit "draw your own sprite" secondary action; add a simple single-sprite editor (one canvas,
auto-generated frames) before exposing the 512×512 animation-strip studio; raise PNG import priority
and fix ZIP round-trip for sheet/tilemap/sound. The mechanism is worth keeping — it's the wrong
thing to put in front of a 10-year-old on day 3.

---

## 4. Friendly errors & the linter (Q2)

### What's genuinely good (keep)
- **Structured runtime errors:** every library error is a `{messageKey, messageArgs, titleKey}`
  rendered bilingually — no raw English prose from the Python side; a classifier
  (`error_hook.py` + shared `syntax_hints.py`) parses real operators, not-iterable/not-subscriptable
  cases, smart quotes, homoglyphs, keyboard layouts.
- **Error cards** with category icon/color, code snippet with line number, click-to-apply suggestion
  chips, a "blocks running" chip, crash frame + watches, and raw traceback hidden behind
  "Show details". This is a better error UX than most adult IDEs.
- **W_MethodNotCalled** (`apple.draw` without `()`) is exactly the kind of hint kids need.

### Where it distracts or confuses (all fixable)
1. **Style rules that block execution.** Only the "grammar" category blocks, and it includes
   **E501 (line > 100 chars)** and **E303 (> 4 blank lines)**. A kid whose game doesn't run because
   of a long line is learning the wrong lesson. Style must never block at this age → move E501/E303
   to warnings.
2. **Name-heuristic noise.** W002 flags `data`, `value`, `temp`, `result`, `thing`, `stuff` —
   all completely normal kid names. W003's "looks like a random name" test uses a **Latin-only vowel
   ratio** (`_vowel_ratio`: "aeiou") — a Cyrillic identifier (valid Python 3, and this is a
   bilingual en/ru product!) like `игрок` would score 0 vowels and get "use a descriptive name".
   W004 (Levenshtein-1 similarity) can fire on intentional pairs.
3. **Migration-shim errors mis-frame the mistake.** `print(actor.center)` → "center was renamed
   to center()" — the kid never used the old spelling; the real lesson is "methods need parens".
   `MigrationProxy` raises even on `actor.center.x` (attribute access), so legitimate debugging
   becomes an error. Reword to "did you mean `center()`?" and let non-call reads degrade gracefully.
4. **Teacher jargon in summaries.** Batch cards read "3 issue(s) (3 grammar) — fix before running"
   and the category labels are bare ids (`naming`, `types`, `grammar`). `errorCategory` in en.json
   is literally `naming => naming`. A 10-year-old doesn't know what a "naming" error is.
5. **Two error systems, slightly different words.** The linter says "Unsupported operand types for
   +: 'int' and 'str'"; the runtime classifier says "Can't use + on a int and a str". Same bug,
   two phrasings — mild but real confusion. Unify templates.
6. **Feedback is console-only and delayed.** Lint runs only on Run click (not while typing), results
   live only in the console — no inline editor markers — so the kid must map a snippet back to the
   editor line. Inline underlines (CodeMirror) would fix the loop.
7. **Info density:** multi-error cards with per-error lists + chips + collapse + raw toggle is a lot
   of moving parts; five W-warnings at once is noise even for an adult.
8. **Notable: the linter is off by default.** `enableLinting: localStorage.getItem("pi3_enableLinting") === "true"`
   → a fresh student gets no E999 hints (missing colon, smart quotes) at all until a teacher turns
   "Check for errors" on; the runtime classifier always covers them, but the linter's smart syntax
   hints are the best part of the system and they're hidden by default. Either default it on, or
   surface the toggle at first run.

**Net:** the *runtime* error system helps far more than it hurts — it's the product's most
impressive pedagogical feature. The *linter* is where "distract and confuse" is real: style-as-
blocker, Latin-biased heuristics, shim mis-framing, jargon, and console-only delivery. All are
small, high-ROI fixes.

---

## 5. Progression & age fit

### What exists
- A **curated gallery** (`EXAMPLES_CATALOG` → ExamplesGalleryPage + in-editor panel): topics
  Basics → Color → Input → Actors & Collision → Classic Games → Procedural Generation → Tilemaps →
  Sprite Sheets. Example length ramps cleanly: 1 line (hello) → 2 (input) → 17 (p5) → 50 (bouncing
  actor) → 60–70 (catch, aim trainer, platformer) → 90–106 (sokoban, snake) → 121–131 (sheet games).
  Eight pre-v1 showcase relics (p5, platformer, sprite_painter, …) are deliberately excluded from
  the gallery — good editorial judgment.
- **Compete mode** with tiers Example/Easy/Medium/Hard, deterministic seeded tests
  (`pi3.testing`), teacher problem authoring — a real, structured progression device.
- **Docs:** bilingual reference with categories + runnable examples + "Advanced" collapsibles +
  recipe-style sections (collision/camera/tilemaps/lighting planned, taxonomy rewrite in progress).
- **Extra depth for the top end:** camera, lighting, tilemaps, procedural generation, pixel API,
  `pi3.debug` algorithm visualization (binary search demo in docs), `pi3.turtle`.

### What's missing for age differentiation
- The gallery is grouped **"by the API it showcases"** (its own lead text), **not by difficulty or
  age**. No per-example difficulty tag, no "start here", no milestones, no guided missions, no
  completion tracking. A 10-year-old opening the gallery sees "Cave Diver (procedural generation)"
  next to "Bouncing Actor".
- The **surface area is high-school+**: ~110 exported names, tilemaps, lighting, vectors, geometry
  shapes (`Spline` texture, `bounce_of`), pixel editing. Depth is opt-in — a 10yo can ignore it —
  but the UI doesn't help them ignore it (docs and autocomplete show everything).
- The linter/errors don't adapt to age (see §4); the sheet editor is front-and-center (see §3).

### Fit by age band (honest read)
- **7–9 (Scratch age): not a fit.** Syntax-first, no block mode; the linter even enforces 4-space
  indentation (E111). Wrong tool — state this clearly in marketing.
- **10 (target floor): works, with a teacher or parent.** Basics → color → input → bouncing
  actor/catch is a viable first-session arc. Needs: quiet linter (or its smart hints on but W-rules
  off), shapes/library-sprites default, sheet editor hidden, difficulty tags so the gallery doesn't
  overwhelm.
- **11–12 (the sweet spot): excellent fit.** Snake, sokoban, asteroids, platformer with library
  sprites, compete Easy/Medium problems, live sessions with the teacher. The game-loop + collision +
  `State` pattern is a genuinely good curriculum at this age.
- **13–14: genuinely capable.** Procedural generation, tilemaps, camera/lighting, pixel API,
  `pi3.debug` for algorithms, Hard compete problems. This is where the breadth pays off.
- **The gap:** 10 and 13 need different tools inside the same product, and today there's no layer
  (tags, modes, guided path, linter strictness) that differentiates them.

### Recommendations
1. Add **difficulty/age tags** to catalog entries and order within topics by difficulty; default the
   gallery to the 10-year-old path.
2. Add a small **guided missions layer** (3–5 step missions per topic: "make the ball bounce twice as
   fast" → "add a score") — the cheapest way to turn examples into curriculum.
3. **Linter strictness by age band** (teacher setting): style rules and W002–W004 off for younger.
4. Add **non-game examples** to balance the game-only set (turtle, text adventure, math/algorithm
   visualizations) — the roadmap explicitly targets "all games," which is motivating but narrow for
   classroom curricula.
5. Surface `pi3.debug` and `pi3.turtle` in the gallery (they're documented but have no example
   entries).

---

## 6. What's genuinely excellent (keep investing here)

- Zero-install browser delivery, local Pyodide, PWA caching — removes the #1 classroom barrier.
- Bilingual en/ru everywhere with parity tests — rare and right for the audience.
- Structured friendly runtime errors with click-to-apply suggestions — best-in-class for kid IDEs.
- Teacher dashboard, live sessions (roster, help queue, emoji), compete mode with deterministic
  seeded tests — real classroom value, not bolt-ons.
- API freeze via snapshot tests + coverage ratchet — engineering discipline that protects the
  teaching product.
- Auto-save/offline stash/interrupt — resilience kids and teachers can rely on.
- `pi3.debug` (algorithm visualization) and `pi3.testing` (teacher generators) are differentiated
  features few competitors have.

---

## 7. Prioritized action list

| Priority | Action | Why |
|----------|--------|-----|
| P0 | Move E501 (line>100) and E303 (>4 blanks) to warnings | Style must never block a 10yo's run |
| P0 | Fix `rect()` vs `Actor.Rect` anchoring (or cross-document loudly) | Most-hit inconsistency, first-lesson trap |
| P0 | `say()` non-AnchorPoint args → friendly error, not raw AttributeError | Raw tracebacks are the one place the error system leaks |
| P0 | ZIP round-trip for sheet/tilemap/sound | Asset authoring currently has a data-loss edge |
| P1 | Difficulty/age tags on examples; order gallery as a progression | The missing scaffolding layer |
| P1 | Reword migration-shim errors ("did you mean center()?") and stop raising on benign reads | Mis-framed lessons; punishes debugging |
| P1 | Linter strictness modes (teacher setting) + drop W002/W003 defaults; Cyrillic-aware naming checks | Heuristics misfire for the actual audience |
| P1 | Inline editor lint markers (CodeMirror) + lint while typing | Faster, less abstract feedback |
| P1 | Single-sprite editor + raise PNG import priority; demote 512×512 studio | Right-sized asset path for median tasks |
| P2 | Unify linter/runtime wording; friendlier category labels | Two systems, two phrasings |
| P2 | Guided missions; hide advanced docs by default; non-game example set | Age differentiation |
| P2 | Single source of truth for the API surface (generate api-v1.md from manifest, CI-check docs vs EXPORTED_NAMES) | §7.7 still open; docs drift is a teaching product's worst bug |

---

*Sources: source at HEAD (linter.py, _errors.py, useRunButton.ts, IdeState.ts, ConsolePanel.tsx,
DocsPanel.tsx, exampleProjects.ts, examplesCatalog.ts, examples/, docs/), PROJECT_KNOWLEDGE.md §7,
docs/reference/04-graphics-module.md, ROADMAP.md, KB queries.*
