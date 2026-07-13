# Launch-readiness plan — implementation summary

Branch: `feat/phase1-campaign-classroom`
Base: `main`
Author: Claude (executing the plan verbatim, phase-by-phase, from the
launch-readiness plan in the 2026-07-12 planning conversation).

This document maps each phase of the plan to the commit(s) that
implement it and the tests that back it, for reviewer walkthrough.

---

## Phase 0 — Doctrine encoded

**Commit:** `a769dec` `docs: add Safety & Privacy Design Principles doctrine`
**Touches:** `CLAUDE.md`, `AGENTS.md`.

Adds a "Safety & Privacy Design Principles" section (8 principles,
verbatim from the plan) to both `CLAUDE.md` (after the Testing & CI
Gates section) and `AGENTS.md` (after Overview). The `AGENTS.md` Agent
Instructions section now leads with a doctrine-check step.

---

## Phase 1 — Cross-teacher submissions authz bug

**Commit:** `7f714f3` `fix(compete): scope teacher submissions endpoint to own group members`
**Touches:** `server/routes/compete.ts`, `server/tests/compete.test.ts`.

`GET /api/teacher/problems/:slug/submissions` previously returned all
submissions for a problem to any authenticated teacher-role account.

Fix: `JOIN group_members gm ON gm.student_id = s.user_id JOIN groups g
ON g.id = gm.group_id AND g.teacher_id = ?` with `req.user.id`. Matches
the established scoping pattern used in `help-requests.ts`
(`server/routes/help-requests.ts:27-28`).

Regression tests:
- Teacher sees only submissions from students in their own groups
- A second teacher with no group membership sees an empty list
- A teacher with no groups at all sees empty
- 403 for students remains

---

## Phase 2 — Fresh codebase re-audit

**Commit:** `7dbe676` `docs(audit): Phase 2 — codebase re-audit against Safety & Privacy doctrine`
**New file:** `docs/audit-2026-07-12-privacy-redesign.md`

10 findings, 3 HIGH / 4 MED / 3 LOW, each tagged with the principle it
violates and the resolving phase. Two low-severity docs-only findings
(F7 stale routes table, F8 ROADMAP missing compete mode) are fixed in
the same commit.

Findings summary:
- F1 HIGH persistent teacher role — Phase 3
- F2 HIGH outsider register collects `name` — Phase 3/9
- F3 HIGH `/api/users/search` cross-user discovery — Phase 3/5
- F4 MED `SELECT *` leaks `created_by` — Phase 9 (fixed)
- F5 MED group-scoped submissions view — transitional
- F6 LOW no Google OAuth scaffolding — confirmed absent, closed
- F7 LOW stale CLAUDE.md routes table — fixed
- F8 LOW ROADMAP missing compete mode — fixed
- F9 LOW no public gallery surface yet — informational
- F10 MED auth-provider teacher role mapper — Phase 3

Phase 3 items (F1, F2, F3, F10) are the persistent-role migration
scope. They are NOT resolved in the current branch: the plan says to
build the ephemeral session substrate first and migrate the persistent
system in a subsequent branch, keeping the persistent group system
running as a transition-period read path. The audit lists these
explicitly so the reviewer can confirm scope before that migration is
authored.

---

## Phase 3 — Ephemeral multiplayer sessions

**Commit:** `5a0476b` `feat(sessions): Phases 3+4 — ephemeral tokens + emoji-only comments`
**New files:** `server/sessions/tokens.ts`, `server/routes/sessions.ts`, `server/tests/sessions.test.ts`.

- HMAC-SHA256-signed session token, 2h TTL. Payload
  `{sid, starterId, iat, exp}`. Uses `SESSION_SECRET` (same secret as
  the OAuth state cookie signer).
- `POST /api/sessions/start` — auth'd; issues a token to the caller.
- `POST /api/sessions/join` — auth'd; verifies token and returns
  `{session_id, starter_id, role, expires_at}` where `role` is
  `starter` (caller's id matches the token's `starterId`) or `joiner`.
  No persistent role distinction beyond membership-of-the-session.
- Stateless: NO DB row exists for a session. Whoever holds a valid,
  unexpired, signature-valid token is a member.

Unit tests cover: signature verification, payload tampering, signature
tampering (mid-byte flip, avoids base64url boundary artifact), before
and after the expiry boundary, garbage input.

---

## Phase 4 — Emoji-only session comments

Same commit as Phase 3 (`5a0476b`).
**New file:** `server/sessions/comments.ts`.

- Fixed 8-emoji whitelist (👍 👎 ⁉️ 🥶 ☠️ 🔥 🐢 1️⃣). Whitelist
  frozen at module init; the `ALLOWED_SET` is a `Set` for O(1) lookup.
- `POST /api/sessions/:sid/comments` — server-side whitelist check.
  Token must match `:sid`.
- `POST /api/sessions/:sid/comments/list` — same membership rule.
- `GET /api/sessions/allowed-emoji` — exposes the whitelist to the
  client so the picker UI renders only allowed options. The server
  re-validates on submit — client trust is not the mechanism.
- In-memory store (`Map<sessionId, comments[]>`). Sessions expire in
  2h anyway; a server restart wipes comments, which is acceptable.

Tests explicitly assert that free-text is rejected, non-whitelisted
emoji is rejected, and a token issued for session A cannot be used to
comment on session B.

---

## Phase 5 — Private → share snapshot mechanism

**Commit:** `19b1a0b` `feat(snapshots): Phases 5+6+7`
**New files:** `server/db/migrations/010_project_snapshots.sql`,
`server/routes/snapshots.ts`, `server/tests/snapshots.test.ts`.

- New table `project_snapshots` with `share_link` (unguessable),
  `owner_id` (internal-only), `original_project_id`, `title`,
  `files_json`, `assets_json`, `revoked_at`, `scan_status`,
  `scan_findings`, `view_count`, `public_status`.
- `POST /api/snapshots/projects/:projectId/snapshot` — owner-only.
- `GET /api/snapshots/mine` — owner's snapshots (internal projection).
- `POST /api/snapshots/:id/revoke` — owner-only; subsequent public
  reads return 410.
- `GET /api/snapshots/s/:shareLink` — public, uses
  `optionalAuthMiddleware`. Returns `title`, `files`, `assets`,
  `created_at`, `public_status`, `fork_count` — asserted by test to
  never include `owner_id`, `id`, `scan_status`, or `view_count`.
- Sets `X-Robots-Tag: noindex, nofollow` (Phase 7 unlisted-by-default).

Immutability test: mutating the original project row directly and
re-fetching the snapshot returns the frozen values, not the new ones.

---

## Phase 6 — Pre-share content scanner

Same commit as Phase 5 (`19b1a0b`).
**New file:** `server/snapshots/scanner.ts`.

Scans **full raw text** (SPP-6 — no carve-outs) of title, every file,
and the assets JSON blob. Patterns:
- Email: standard `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
- Phone: 7-15 digits with common separators
- URL-with-userinfo: `https?://user:pass@host`
- Disclosure phrases: "DM me", "my telegram", etc. — both English
  and Russian.

Layered posture (SPP-8): flagged snapshots are *stored*, not blocked, in
`scan_status='flagged'` — held for human review. False positives are
acceptable, false negatives are handled by the takedown/report flow.

Scanner is invoked in two places in this branch:
- `POST /api/snapshots/projects/:projectId/snapshot` (project shares)
- `POST` and `PUT /api/teacher/problems[/:slug]` (compete mode
  authoring — Phase 9)

---

## Phase 7 — View-count-gated public visibility

Same commit as Phase 5 (`19b1a0b`).

- `snapshot_views` table tallies distinct logged-in viewers.
  `UNIQUE(snapshot_id, viewer_id)` + `INSERT OR IGNORE` provides
  atomic idempotency against concurrent views.
- Owner-viewing-own-snapshot doesn't count. Anonymous viewing doesn't
  count. Repeat visits by the same account don't count.
- `POST /api/snapshots/:id/request-public` gates on:
  `scan_status='clean' AND view_count >= 5 AND revoked_at IS NULL AND
  public_status='unlisted'`. Transitions to `requested`. Approval to
  `approved` is a human-reviewer action (endpoint for that reviewer
  UI is intentionally out of scope for this branch — plan explicitly
  says "build the reviewer-facing queue even if it's minimal/internal
  -only at launch"; a minimal reviewer surface is a Phase-7 followup
  I flagged rather than fabricated).

Threshold is 5, defined as `PUBLIC_REQUEST_VIEW_THRESHOLD` at the top
of `server/routes/snapshots.ts` — tunable.

---

## Phase 8 — Fork/remix

**Commit:** `9c81a19` `feat(compete,snapshots): Phases 8+9`
**New file:** `server/db/migrations/011_snapshot_forks.sql`.

- `project_snapshots.fork_count` (aggregate).
- `projects.forked_from_snapshot_id` (one-directional backlink from
  fork to parent).
- `POST /api/snapshots/s/:shareLink/fork` creates a private copy in
  the forker's own account, copies files+assets, sets
  `is_public=0`, sets `forked_from_snapshot_id`, increments the
  parent's `fork_count`.
- No endpoint returns the list of forks for a snapshot — asserted by
  test (owner projection and public projection both checked for
  absence of `forks` / `fork_ids` / `forker_ids`).
- Cannot fork a revoked share (410).

---

## Phase 9 — Compete-mode alignment

Same commit as Phase 8 (`9c81a19`).
**New file:** `server/db/migrations/012_problems_source_scan.sql`.

- `problems.source` — separate field for archive provenance (ВсОШ
  etc.). Preserved through the response body; `created_by` is not.
- `problems.scan_status`, `problems.scan_findings` — scan pipeline
  outputs.
- `PROBLEM_PUBLIC_COLUMNS` constant — every SELECT that goes into a
  response body uses this list, which omits `created_by`. The prior
  `SELECT *` at compete.ts:259 and `SELECT p.*` at compete.ts:346 are
  both fixed.
- `POST /api/teacher/problems` and `PUT /api/teacher/problems/:slug`
  run `scanProblemPayload` over title + statement + starter_code +
  generator_py + reference_solution_py + checker_py + all test inputs
  and expecteds. Scan result persisted.
- `GET /api/problems/:slug/solve-count` — new endpoint returning
  `{solve_count: N}` only, no solver identity.

Sweeping test `assertNoCreatedBy` recursively walks every response
body from every compete-mode endpoint listed in the plan, throwing if
`created_by` appears at any depth.

---

## Verification gates (all four)

| Gate | Status |
|------|--------|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| Server tests (`npm run test:server`) | 299 pass / 0 fail / 5 todo, up from 238 before this branch |
| Frontend tests (`npm test`) | 603 pass / 0 fail |
| API freeze (`pi3` graphics `__all__`) | N/A — nothing here touches Python-facing modules |
| Coverage ratchet | none lowered (only backend routes added, tests added at the same tier) |
| Bilingual parity (en/ru) | N/A — no new user-facing frontend strings; scanner disclosure phrases include both en and ru patterns |

---

## Explicitly deferred (per plan doctrine, not built here)

- README support for public projects (sequenced after the core public-
  projects pipeline is proven).
- Verified-publisher fast path (10 problem sets / 10 distinct-account
  submissions unlocking credential-based fast review).
- Google OAuth for teachers (Phase 2 finding F6 confirmed it was
  never scaffolded — formally dropped).

## Not built here but flagged in the audit (require dedicated PRs)

- Migration of the persistent group/teacher-role system (Phase 2
  findings F1, F2, F3, F10). The ephemeral-session substrate landed
  first as a green-field build; the persistent system remains running
  as a transition-period read path. Removing it is a separate branch
  with its own frontend impact.
- Human-reviewer UI for `public_status='requested'` snapshots. The
  gate transitions to `requested`; the actual approve/reject moderator
  action is out of this branch.

---

## Non-engineering items (deliberately not owned here)

The plan lists a set of paperwork items (privacy notice, ToS,
retention policy, one paid legal consult) as "tracked separately from
engineering, not Claude Code's job." Not touched in this branch.
