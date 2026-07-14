# Audit — `main` branch core invariants

Audit target: `main` (Систематика / Keycloak institutional deployment).
Auditor viewpoint: universal correctness bugs only. Anything that is a
legitimate profile-difference vs the `feat/phase1-campaign-classroom`
posture (persistent teacher roles, real names, no ephemeral sessions,
no anon signup path, etc.) is **not** reported.

All file:line references are against `main` HEAD (`git show main:<path>`).

## Findings

| Surface | Status | Evidence (file:line on main) | Severity | Why-Core-Invariant |
| --- | --- | --- | --- | --- |
| `GET /api/compete/problems/:slug/tests-for-submit` | **Accepted, not a bug** | `server/routes/compete.ts:178-196` | — | Hidden-test response-shaping was never intended as an anti-cheat boundary. A determined student has easier paths to cheating (copying a solution, asking an LLM) than reverse-engineering request/response shapes — arguably easier for a 10-14-year-old than the alternative. The student owns their own learning; this isn't a security boundary pi3 is responsible for enforcing. |
| `GET /api/compete/teacher/problems/:slug/submissions` | **BROKEN** — cross-teacher submission read | `server/routes/compete.ts:459-480` (only `teacherOnly` gate; no scoping to teacher's students, groups, or problems the teacher owns) | **High** | Any teacher can pull every student's submission (code + stars + verdict) for any problem, keyed by real name. Even accepting persistent teacher roles as a profile choice, "any teacher sees every teacher's students' code" is not a legitimate design — it violates least-privilege on identifiable student work regardless of whether identities are anon or real. Contrast with `GET /api/projects/shared-with-me` (`projects.ts:134-157`) which correctly joins through `groups.teacher_id = ?`. |
| `PUT /api/compete/teacher/problems/:slug` | **BROKEN** — any teacher edits any problem | `server/routes/compete.ts:309-351` (only `teacherOnly`; no `created_by = req.user.id` check) | **High** | `problems.created_by` is captured on insert (`compete.ts:293`) but never enforced on update. Any teacher can rewrite another teacher's problem statement, starter code, checker, generator, and — critically — the test set (line 336 `DELETE FROM problem_tests` then re-insert). This is a data-integrity bug independent of the identity model. |
| `POST /api/compete/teacher/problems/:slug/archive` | **BROKEN** — any teacher archives any problem | `server/routes/compete.ts:446-457` (no ownership check) | **High** | Same class as above: `created_by` exists in schema but is unused. Universal authz bug. |
| `POST /api/compete/teacher/problems/import` with `overwrite=true` | **BROKEN** — any teacher can bulk-overwrite by slug | `server/routes/compete.ts:353-444` (overwrite path at 408-419 has no `created_by` check on the existing row) | **High** | A teacher can call import with `overwrite: true` and clobber another teacher's problem + tests by picking the same slug. Universal authz bug. |
| `GET /api/users/search` | Suspect — global name/handle enumeration | `server/routes/users.ts:165-189` (LIKE across full `users` table, no role/group scoping, requires only auth) | Medium | Any authenticated user (including any student) can enumerate the entire user directory of the institution by two-letter prefixes, returning `{id, name, handle, role}`. Even in a real-name deployment, exposing the full teacher+student roster with roles to every student is not a legitimate design choice — the search is used only by share-dialog and teacher-invite flows, both of which could be scoped (share: to teachers only; invite: teachers-only endpoint already). Handle enumeration also enables account-takeover phishing prep. |
| `POST /api/projects/:id/share` — target lookup by `name` | Suspect — same enumeration surface | `server/routes/shares.ts:50-55` (`SELECT id FROM users WHERE name = ?`) | Low | Exact-match lookup, so weaker enumeration than `/users/search`, but returns a `404 Not Found` vs `409 Conflict`/success, which is a name-existence oracle. Universal issue. |
| `POST /api/groups/:id/invite` — target lookup by `handle` or `name` | Suspect — same enumeration surface (teacher-only) | `server/routes/groups.ts:302-305` | Low | Teacher role required, so lower blast radius; but returns 404/400/409 depending on whether the handle exists, is self, or is already in group — that's a directory oracle for anyone with the teacher role. Not a profile-specific issue. |
| `GET /api/groups/:id` — member roster visible to members | **Accepted, deployment-appropriate** | `server/routes/groups.ts:239-268` | — | Classmates seeing each other within their own class is intended for this institutional deployment, not an oversight. |
| `GET /api/projects/:id/comments` — author name visible to viewers | Fine (probably) | `server/routes/comments.ts:32-64` (returns `author_name`, `author_handle` to anyone with `viewer` role) | Info | In a persistent-teacher deployment, showing that teacher X wrote a review comment is expected. Only flagging as data-shape info. |
| `POST /api/projects/:id/comments` — teacher-only write gate | Correct | `server/routes/comments.ts:66-121` (owner OR teacher-with-share) | — | Correctly scoped. |
| `GET /api/projects/:id` / `PUT /:id/save` — role checks | Correct | `server/routes/projects.ts:236-257, 359-428` via `getProjectAccess` | — | Correctly scoped by owner-or-share-role. |
| `GET /api/projects/shared-with-me` — teacher list | Correct | `server/routes/projects.ts:134-157` (joins through `groups.teacher_id = ?`) | — | Correctly scoped to the requesting teacher's own groups. Contrast with the compete-submissions endpoint above — same author, different discipline. |
| `GET /api/help-requests` — teacher help queue | Correct | `server/routes/help-requests.ts:10-51` (joins through `project_shares.user_id = ?` AND `groups.teacher_id = ?`) | — | Correctly double-scoped: teacher must both be the share target AND own the group the student is in. |
| `PATCH /api/help-requests/:id` — teacher status update | Correct | `server/routes/help-requests.ts:54-95` (WHERE joins `project_shares.user_id = ?`) | — | Correctly scoped. |
| `GET /api/groups` (teacher list) / `PATCH` / `DELETE` / `POST /:id/regenerate` | Correct | `server/routes/groups.ts:122-137, 180-236, 271-285` via `checkGroupOwnership` | — | Correctly scoped to `teacher_id = req.user.id`. |
| `POST /api/groups/join` (student) | Correct | `server/routes/groups.ts:71-104` | — | Invite-code gated; blocks teacher-joins-own-group. |
| Rate limits on write endpoints (publish/share/comment/problem-create/edit/archive/import/save/thumbnail/help-request/group-create) | **MISSING** | `server/middleware/rateLimit.ts:1-35` defines only `authOauthLimiter`, `outsiderSignupLimiter`, `outsiderLoginLimiter`. Nothing applied to `POST /projects`, `PUT /projects/:id/save`, `PUT /projects/:id/thumbnail` (1MB PNG upload!), `POST /projects/:id/share`, `POST /projects/:id/comments`, `POST /projects/:id/help-request`, `POST /compete/teacher/problems`, `PUT /compete/teacher/problems/:slug`, `POST /compete/teacher/problems/import`, `POST /compete/problems/:slug/submit`, `POST /groups`, `POST /groups/:id/invite`. | High | Universal DoS + abuse-cost issue. Especially the 1MB raw PNG thumbnail PUT with no throttle (`projects.ts:454-480`) and the `/compete/problems/:slug/submit` write that stores arbitrary code with no throttle (`compete.ts:199-224`) are unbounded write amplifiers. Not a profile choice. |
| Content scanner on published/shared/commented content | **MISSING** | No scanner module in `server/`. `grep -iE "scanner\|moderation\|takedown"` under `server/` returns zero hits in routes. | Medium | Main allows `is_public = 1` on projects (`projects.ts:33-46, 309-312`) with no scanner and no author-unlinking snapshot. Even in a real-name school setting, a student can publish a project with arbitrary text/code content that appears on the public `/api/projects/public` list keyed by owner name+handle. This is a universal moderation-hygiene bug — the absence of any pattern scan on submitted content means the platform has no automated defense against accidental disclosure of anything (contact info, slurs, etc.) that a real-name school would still want caught. |
| Moderation / report mechanism | **MISSING** | No `POST /api/report`, no moderation queue, no takedown surface. `grep -iE "report\|takedown\|moderat"` in routes: only unrelated hits. | Medium | Institutional deployments still need a way for a student or teacher to report a public project. No such endpoint exists. Universal gap. |
| `is_public` toggle on projects | Suspect — no snapshot, no scan, no unlisted-by-default | `server/routes/projects.ts:309-312` (owner sets `is_public = 1` on `PUT /:id`, live project row is then reachable via `GET /api/projects/public`) | Medium | Making the *live editable project row* publicly readable (as opposed to an immutable snapshot) means: (a) any subsequent edit is instantly public with no re-scan opportunity; (b) the owner's `user_id` / name / handle is joined into the public response (`projects.ts:33-46`). Universal issue: publish-as-live-pointer conflates the private working copy with the public artifact. This is orthogonal to identity model. |
| CSRF middleware | Correct | `server/middleware/auth.ts:83-115` | — | JSON / XHR / Bearer / safe-method paths; combined with SameSite=lax, reasonable. |
| Session regeneration on login | Correct | `auth.ts:274-277`, `users.ts:88-89, 148-150` | — | `regenerateSession` called before setting `userId`. |
| OAuth PKCE + nonce + state | Correct | `server/routes/auth.ts:64-206` | — | All three verified with HMAC-signed cookies and timing-safe compare. |
| `SESSION_SECRET` production guard | Correct | `server/index.ts:31-39` (throws if unset or default in prod) | — | |
| Optimistic-concurrency on project save | Correct | `server/routes/projects.ts:374-411` (`If-Match` → 409 with `current_version`) | — | Good pattern, though falls back to last-write-wins if header absent. |

## Summary by severity

**Critical (0):**
- ~~`GET /compete/problems/:slug/tests-for-submit`~~ — reclassified as **accepted, not a bug**. See table. Not a security boundary pi3 enforces.

**High (4):**
- `GET /compete/teacher/problems/:slug/submissions` — any teacher reads any student's code across the whole institution.
- `PUT /compete/teacher/problems/:slug` — any teacher rewrites any other teacher's problem + tests.
- `POST /compete/teacher/problems/:slug/archive` — same class.
- `POST /compete/teacher/problems/import` (overwrite=true) — same class.
- Write endpoints have zero rate limiting (only auth/signup/login are throttled). 1MB thumbnail PUT and submission POST are unbounded.

**Medium (3):**
- No content scanner on any submitted text (project public toggle, comments, problem statements, submitted code).
- No report/moderation endpoint or queue.
- `is_public` publishes the live editable row (not a snapshot) joined to owner identity.
- `/api/users/search` returns the full institutional directory with `role` to any authenticated user (including students).

**Low (2):**
- Name-existence oracles in `POST /projects/:id/share` and `POST /groups/:id/invite` via distinguishable 404 vs 409/400 responses.

**Accepted / deployment-appropriate (1):**
- `GET /groups/:id` roster visibility — intended for institutional deployment.

## Server-lightness principle

The deployment server should never become the bottleneck. Any computation
that can correctly and safely happen client-side should happen there —
this keeps hosting costs low and predictable as usage scales. **This
principle does not extend to authorization decisions.** Trust
boundaries — who can read or modify what — must always be enforced
server-side, full stop; "keep it light" is about where computation
happens, never about where access control is decided. The four fixes
below are exactly the kind of thing this principle does *not* apply to.

## Root-cause pattern

The compete-mode `/teacher/*` endpoints (`server/routes/compete.ts`) were
written with only the coarse `teacherOnly` gate and never got a
`created_by = req.user.id` (or equivalent group-scoped) filter. The
non-compete teacher endpoints (`projects.ts`, `groups.ts`, `help-requests.ts`)
consistently do scope by ownership — so this is a localized gap in one
file, not a systemic design issue.
