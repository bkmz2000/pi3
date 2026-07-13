# Follow-up audit — 2026-07-13 — project_shares access grant + project comment channel

Small, focused follow-up flagged in reviewer feedback on commit
`65f6f3f` (the Phase 1-tail role-gate cleanup). This is **findings only,
no code**. The role-gate cleanup removed the `isTeacher()` predicate
from POST `/api/projects/:id/comments`, which incidentally opened
comment-writing to any account with editor/viewer share access. That
prompted two adjacent questions worth explicit examination:

1. How is `project_shares` access granted? Is there a pre-existing
   relationship guarantee, matching the tripwire principle (P#3)?
2. Does the project-comment channel need the same emoji-only,
   structural-prevention treatment as session comments (P#4)?

Both are examined against the 8 Safety & Privacy Design Principles in
`CLAUDE.md` / `AGENTS.md`. Answers below.

---

## Q1 — How project_shares access is granted

### Grant path (POST /api/projects/:id/shares — `server/routes/shares.ts:33`)

- Caller must be `access.role === 'owner'` on the project
  (`requireOwner` at `shares.ts:16`) — this is legitimate.
- Body accepts either `user_id` (opaque uuid, direct id) OR `username`
  (looked up via `SELECT id FROM users WHERE name = ?`, `shares.ts:53`).
- No `INSERT` predicate requiring the target and the owner to share
  any pre-existing relationship (no common group, no active session,
  no prior handshake, no target-side confirmation).
- Result: a project owner can push a share onto any account whose
  opaque `id` or legacy `name` they happen to know. The recipient sees
  a new "shared with me" entry appear without ever agreeing.

### Does this route around the tripwire principle (P#3)?

**Partially — the front door was closed in the earlier fix, but a
side door remains.**

- Cross-user discovery via `GET /api/users/search` was killed in
  commit `92abf57` (returns 410 Gone). That closes the most obvious
  handle-to-id enumeration path.
- BUT: `SELECT id FROM users WHERE name = ?` at `shares.ts:53` is
  functionally equivalent to a single-name lookup. An owner who knows
  a legacy account's `name` (real name, from any out-of-band source —
  a screenshot, a school roster, a Loginus username, any leak from
  before the Blocker #1 fix) can push a share onto it.
- Fresh signups have `name = NULL` after Blocker #1, so the
  name-lookup path is dead for anyone who registered post-`92abf57`.
  Grandfathered accounts remain exposed.
- The `user_id` path bypasses the name lookup entirely. IDs are UUID
  v4, so unguessable at random — but any authenticated user's UUID
  will appear in JOIN responses across help-requests, groups, and
  shares-listing endpoints. Not enumerable, but any authenticated
  caller could opportunistically collect ids from responses they're
  already authorized to see.

### Delta from P#3 in strict reading

P#3 says: *pi3 never facilitates first contact between strangers.
Every relationship that uses pi3 (a class, a study pair) must
pre-exist it.* A unilateral share-push where the target had no
existing relationship with the owner is a first-contact facilitation:
the target now has a persistent, owner-linked entry in their "shared
with me" list, which is a low-bandwidth handle for the owner to
attach subsequent free-text comments to (see Q2).

### Findings

| # | Severity | Finding | Suggested action |
|---|----------|---------|------------------|
| S1 | MED | Share grant by legacy `name` still works for grandfathered accounts | Remove the `WHERE name = ?` branch at `shares.ts:53`; require `user_id` only. Consistent with the Blocker #1 direction (handle is the identifier, name is legacy). |
| S2 | MED | No relationship precondition on share grant | Require target to have a pre-existing link — same group, or accepted a session invite from the owner within N days. Enforce at INSERT time. |
| S3 | LOW | Owner-side share list still projects `u.name as user_name` (`shares.ts:146`) | Drop `u.name` from the projection; return `user_handle` only. Same shape as the compete-mode fix in Phase 1. |
| S4 | LOW | No target-side "accept share" gate | Optional but P#3-aligned: shares land in a pending state; the target sees them but the owner cannot comment / see live code until the target confirms. |

---

## Q2 — Does the project-comment channel need P#4 treatment?

### Current shape (POST /api/projects/:id/comments — `comments.ts:63`)

- Auth requires editor/viewer share access on the project.
- Body: `{ file_path, line_number, anchor_text, text }` where `text`
  is free-form, min 1 char (`text.trim()` at `comments.ts:80`), no
  upper cap enforced at the route level.
- Stored as `text TEXT NOT NULL` in `002_teacher_dashboard.sql:22`.
- No scanner invocation. `scanSnapshot` (Phase 6) runs on project
  publishing and compete-mode problem authoring, but not on
  per-comment writes.
- No rate limit. No character-class filter.

### Comparison to P#4

P#4 as written: *In-session communication is emoji-only, from a fixed
small set, never free text — structural prevention of disclosure, not
a filter.*

The literal scope in the doctrine is "in-session" — the emoji-only
mechanism is `server/sessions/comments.ts`, keyed off ephemeral
session tokens. Project comments are async, not session-scoped, and
predate the doctrine (migration 002).

**But the risk shape is the same.** The point of P#4 is not "sessions
are special" — it's "any cross-user text channel is a disclosure
surface, and structural prevention is the design posture." A
free-text comment thread between two users who happen to share a
project is materially the same disclosure risk as a free-text session
chat: a low-friction back-channel where identifying info can be
posted, anchored to a specific line of code that both users can see.

The design question is whether the project-comment channel is doing
enough work as a *teaching tool* to justify the exception, or whether
it should be brought under the same rule. That's a product call, not
a security call — flagging it here for explicit consideration rather
than resolving it inline.

### Findings

| # | Severity | Finding | Suggested action |
|---|----------|---------|------------------|
| C1 | HIGH (if scope of P#4 is broadened to cover project comments) | Comment `text` is free-form, no whitelist, no scanner | Option A: switch to emoji-whitelist, same shape as session comments — mirrors doctrine, breaks the teaching-comment UX. Option B: keep free text but run `scanSnapshot` on every POST and hold flagged comments for review — mirrors the Phase 6 snapshot pipeline. Option C: cap length (~200 chars), rate-limit per author-project, and scan. |
| C2 | MED | GET response projects `u.name as author_name` (`comments.ts:45, 53, 93`) | Drop `u.name`; return `author_handle` only. Same shape as S3 and the Blocker #1 direction. |
| C3 | LOW | No character cap on `text` | Even without a scanner, a 10-char cap would materially reduce the disclosure bandwidth without changing the teaching-signal use case. |
| C4 | LOW | Comment `anchor_text` is also free-form and is passed through unchanged | Included in any scan/cap if C1 lands. |

---

## Recommendation

- Findings S1 and S2 are the concrete P#3 alignment gaps and are
  small, scoped fixes suitable for a dedicated follow-up PR.
- Findings C1 through C4 need a product decision *before* the
  engineering change: is the project-comment channel a teaching tool
  worth defending as free-form-with-a-scanner (Option B), or does
  bringing it under the same emoji rule as session comments (Option
  A) actually simplify the doctrine? Not resolvable inside a role-
  gate cleanup — flag to product owner.
- S3 and C2 are the same `u.name`-projection leak as compete-mode
  submissions (Blocker #1). Same one-line fix pattern; safe to bundle
  with S1/S2 when those land.

Total: 4 finds under Q1, 4 under Q2. None urgent. All independently
scopable.
