# Phase 0 findings — full inventory of role='teacher' gates

Repo-wide sweep of every code path that reads `users.role` and gates
behavior on the value being `teacher`. Every one of these is a
dead-end for freshly-registered accounts after 92abf57 (no live path
creates a teacher-role account anymore).

## Direct role checks

| File | Line | Gate | Phase |
|------|------|------|-------|
| `server/routes/groups.ts` | 77 | `requireTeacher()` — function definition | 1 |
| `server/routes/groups.ts` | 174 | POST /api/groups (create group) | 1 |
| `server/routes/groups.ts` | 192 | POST /api/groups/:id/invite | 1 |
| `server/routes/groups.ts` | 231 | POST /api/groups/:id/rotate-code | 1 |
| `server/routes/groups.ts` | 266 | POST /api/groups/:id/archive | 1 |
| `server/routes/groups.ts` | 318 | POST /api/groups/:id/session/start | 1 |
| `server/routes/groups.ts` | 345 | GET /api/groups/:id/snapshot | 1 |
| `server/routes/groups.ts` | 405 | GET /api/groups/:id (view group) | 1 |
| `server/routes/groups.ts` | 422 | DELETE /api/groups/:id/members/:userId | 1 |
| `server/routes/groups.ts` | 487 | DELETE /api/groups/:id | 1 |
| `server/routes/compete.ts` | 115 | `teacherOnly()` — function definition | 2 |
| `server/routes/compete.ts` | 279 | GET /api/teacher/problems | 2 |
| `server/routes/compete.ts` | 294 | GET /api/teacher/problems/:slug | 2 |
| `server/routes/compete.ts` | 311 | POST /api/teacher/problems | 2 |
| `server/routes/compete.ts` | 357 | PUT /api/teacher/problems/:slug | 2 |
| `server/routes/compete.ts` | 408 | POST /api/teacher/problems/import | 2 |
| `server/routes/compete.ts` | 501 | POST /api/teacher/problems/:slug/archive | 2 |
| `server/routes/compete.ts` | 534 | GET /api/teacher/problems/:slug/submissions | 2 |
| `server/routes/projects.ts` | 96 | `req.user!.role !== 'teacher'` — teacher-projects listing | 1-tail |
| `server/routes/help-requests.ts` | 11 | GET /api/help-requests (list) | 1-tail |
| `server/routes/help-requests.ts` | 55 | PATCH /api/help-requests/:id | 1-tail |
| `server/routes/comments.ts` | 23 | `isTeacher()` helper — used inside project comments authz | 1-tail |

Total: **22 gate sites** in 5 files. Plan named 2 files (`groups.ts`,
`compete.ts`) plus a general "grep the full server tree" instruction.
Full sweep found three more files (`projects.ts`, `help-requests.ts`,
`comments.ts`) also role-gated — these are the "1-tail" items above
and need the same treatment.

## Not role checks (informational)

- `server/routes/compete.ts` scan-status enums include the literal
  string `'teacher'` in no context; verified via grep — none.
- `server/routes/users.ts` `SELECT * FROM users` still returns `role`
  in `/me` response; this is a read, not a gate. Left alone — the
  frontend may still branch on it for transitional UI, and the column
  itself stays (Phase 3 cleanup).

## Phase mapping

- **Phase 1** = `groups.ts` (9 endpoint gates + `requireTeacher` def).
- **Phase 1-tail** = the three related files that share the same
  substrate. Ownership checks stay; role checks go. Bundled with
  Phase 1 rather than a separate phase because they are the *same
  regression* — every one is a dead-end for a fresh account, not just
  the two the plan named. Splitting them would leave known dead-ends
  live in prod between commits.
- **Phase 2** = `compete.ts` (7 endpoint gates + `teacherOnly` def).
  Kept separate per plan directive.
- **Phase 3 (deferred)** = drop `role` column + `CHECK` constraint
  once Phase 1 + 2 have been stable in prod.
