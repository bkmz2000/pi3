# Audit — 2026-07-12 — pi3 vs. new Safety & Privacy doctrine

Fresh codebase audit against the 8 Safety & Privacy Design Principles added
to `CLAUDE.md` / `AGENTS.md` in commit a769dec. **Findings only** — no
implementation in this pass. Each finding is tagged with the principle it
violates and the phase of the launch plan that will address it.

---

## Legend

- **P1**…**P8** — Safety & Privacy Design Principle number.
- **Phase N** — Which launch-plan phase resolves this finding.
- **Severity**: HIGH = user data leak / policy violation; MED = design
  debt; LOW = staleness / docs.

---

## Findings

### F1 — Persistent teacher role + self-serve upgrade — **HIGH** (P1) — Phase 3

- `POST /api/users/me/upgrade-teacher` (`server/routes/users.ts:162`) —
  any authenticated user can flip their own `users.role` to `teacher`
  permanently. This creates the exact "standing badge" P1 forbids.
- `server/auth-providers/loginus.ts` + `keycloak.ts` — also assign the
  `teacher` role from provider claims (`LOGINUS_TEACHER_ROLE` /
  `KEYCLOAK_TEACHER_ROLE`). Persistent grant.
- `groups` + `group_members` tables (`server/db/migrations/002_teacher_dashboard.sql`)
  + `server/routes/groups.ts` — the entire persistent-group system is
  built on the assumption that `teacher_id` is a durable owner and
  `student_id` is a durable member.
- Scope of migration: `groups.ts` (~450 lines), `help-requests.ts`,
  `teacher/*` frontend pages, the parts of `projects.ts`/`shares.ts`
  that key off role, and the compete-mode scoping added in Phase 1
  (which will need to be re-based onto the new ephemeral model).

**Action (Phase 3):** replace with ephemeral, symmetric,
signed-token-based session mechanism. Keep the persistent group system
running in parallel as a transition-period read path until migration is
complete; do NOT extend it further.

---

### F2 — `POST /api/users/outsider/register` collects `name` from student — **HIGH** (P2) — Phase 3 / 9

- `server/routes/users.ts:30–83` — outsider registration takes a `name`
  string from the request body and stores it as `users.name`.
- Handle is auto-generated (good — matches "auto-generated login"), but
  `name` is user-supplied and required.
- Followup: audit the client-side registration UI
  (`src/components/user/LoginDialog.tsx` etc.) — any form field asking
  the student for a name/nickname violates P2.

**Action (Phase 3):** remove the `name` field from the outsider path
entirely. Handle becomes the sole identifier. Existing user rows keep
their names as legacy internal-only data (never rendered externally).

---

### F3 — `GET /api/users/search` — cross-user discovery — **HIGH** (P3) — Phase 3 / 5

- `server/routes/users.ts:135` — any authenticated user (student or
  teacher) can search all users by name or handle prefix, returning
  `{id, name, handle, role}` for up to 8 matches.
- Direct violation of the tripwire principle (P3): pi3 facilitates
  first-contact between strangers via handle lookup.
- Currently used by (a) the share dialog to grant per-user project
  access, (b) group invite lookups.

**Action:** kill the endpoint. Replace both call sites:
- Project sharing (Phase 5): move to snapshot / unlisted-link model
  where no cross-user lookup is needed.
- Group/session invite (Phase 3): the joiner enters a session code, not
  the starter's handle. The endpoint is not needed.

---

### F4 — `problems.*` responses expose `created_by` — **MED** (P7) — Phase 9

- `server/routes/compete.ts:259` (`GET /api/teacher/problems/:slug`) and
  `server/routes/compete.ts:305` (`POST /api/teacher/problems`) both
  `SELECT *` from `problems`, which includes `created_by`.
- No non-teacher endpoint currently exposes it (verified via
  `grep -rn "SELECT.*created_by" server/routes/` — only writes and the
  two `SELECT *`s remain).
- Frontend: no consumer references `created_by` (verified via
  `grep -rn "created_by\|createdBy" src/`). Silent inclusion, no UI
  render — but the API still ships it in the response body, which is
  the actual P7 violation.

**Action (Phase 9):** enumerate the `SELECT` columns explicitly on both
routes. Add a Phase 9 sweeping test asserting `created_by` never appears
in any response body.

---

### F5 — `submissions.user_id` + `user_name`/`user_handle` join in Phase 1 fix — **MED** (P7) — Phase 5 / 9

- The Phase 1 fix (commit 7f714f3) still returns `s.user_id`, `user_name`,
  `user_handle` to the requesting teacher. This is scoped correctly
  (only students in the teacher's own groups), so it is not a
  cross-teacher leak.
- However, once Phase 3 (ephemeral sessions) lands, the concept "student
  in my group" goes away. The submissions view then needs to be
  re-based onto either (a) session-scoped ephemeral visibility or (b) a
  snapshot/aggregate model.

**Action (Phase 9):** re-scope this endpoint when the persistent-group
substrate is removed. In the interim it is not a data leak.

---

### F6 — No Google-OAuth-for-teachers scaffolding exists — **LOW** (P1) — Phase 2 (this doc)

- `grep -rn "google\|Google\|GOOGLE" server/ --include="*.ts"` returns
  no results.
- `server/auth-providers/` contains only `loginus.ts`, `keycloak.ts`,
  `types.ts`, `index.ts`. No Google adapter, no Google env vars in
  `CLAUDE.md`.

**Action:** nothing to remove. The launch plan notes this scaffolding
was discussed but is now moot given P1 — this audit confirms it was
never started. Item can be formally dropped.

---

### F7 — Stale routes table in `CLAUDE.md` — **LOW** — Phase 0 follow-up

Live routes in `src/App.tsx:492–501`:
- `/projects`
- `/teacher`
- `/teacher/projects/:projectId`
- `/teacher/problems`
- `/teacher/problems/new`
- `/teacher/problems/:slug/edit`
- `/compete/:slug`
- `/welcome`
- `/ide/:projectId`
- `/`

`CLAUDE.md` routes table only lists `/`, `/ide/:projectId`, `/projects`,
`/teacher`. Missing: `/teacher/projects/:projectId`, all
`/teacher/problems/*`, `/compete/:slug`, `/welcome`.

**Action (Phase 2):** update `CLAUDE.md` routes table now. Small tack-on
to Phase 0 doctrine commit — safe to bundle here since it's docs-only.

---

### F8 — `docs/ROADMAP.md` doesn't mention compete mode at all — **LOW** — Phase 2 follow-up

- `grep -c "compete\|Compete" docs/ROADMAP.md` returns 0.
- Compete mode (problems, submissions, teacher problem authoring) is
  shipped and has a route + backend routes + tests, but the roadmap
  neither lists it as "shipped" nor "in progress".

**Action (Phase 2):** add compete mode to `ROADMAP.md` shipped table.

---

### F9 — No public gallery / discovery / leaderboard UI exists yet — **LOW** — informational

- `grep -rn "public\|discover\|gallery\|explore" src/ --include="*.tsx"`
  returned nothing meaningful.
- No open-leaderboard or cross-user discovery UI currently exists.
- Confirmed: the only cross-user surfaces today are (a) `/api/users/search`
  (finding F3) and (b) group-membership plumbing (finding F1).

**Action:** informational. Phases 5–8 add snapshot publishing, view-count
gating, and fork mechanics — all must be built against P3/P7/P8, not
retrofitted onto an existing public surface.

---

### F10 — Auth provider role mapper for teacher — **MED** (P1) — Phase 3

- `server/auth-providers/loginus.ts` and `keycloak.ts` promote users to
  the `teacher` role based on a provider claim
  (`LOGINUS_TEACHER_ROLE`, `KEYCLOAK_TEACHER_ROLE`).
- This is the source of the durable role Loginus/school SSO users get.
- Under P1 there is no persistent teacher role, so this branch of the
  provider adapter becomes dead code.

**Action (Phase 3):** remove the role-elevation branch from both
adapters as part of the ephemeral-session migration. Note that the
Keycloak-migration project memory (2026-06-15) references role mapper
config — flag to Ilya that this becomes moot.

---

## Summary matrix

| Finding | Principle | Severity | Phase |
|---------|-----------|----------|-------|
| F1 persistent teacher role + groups | P1 | HIGH | 3 |
| F2 outsider register collects `name` | P2 | HIGH | 3 / 9 |
| F3 `/api/users/search` cross-user discovery | P3 | HIGH | 3 / 5 |
| F4 `SELECT *` leaks `created_by` in teacher endpoints | P7 | MED | 9 |
| F5 group-scoped submissions view (transitional) | P7 | MED | 5 / 9 |
| F6 no Google OAuth scaffolding | P1 | LOW | closed |
| F7 stale CLAUDE.md routes table | — | LOW | 2 |
| F8 ROADMAP missing compete mode | — | LOW | 2 |
| F9 no public gallery surface yet | P3 | LOW | informational |
| F10 auth-provider teacher role mapper | P1 | MED | 3 |

Total: **3 HIGH**, **4 MED**, **3 LOW**.
