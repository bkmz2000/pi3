# Consolidated pre-launch review — 8 Safety & Privacy Principles

**Date:** 2026-07-13
**Branch:** `feat/phase1-campaign-classroom`
**Method:** read-only. Every row below has a `file:line` reference or an
explicit `not-checked`. No fix in this pass — this doc is the reference
checklist to run before every subsequent PR.

**Status legend:** `verified-clean` / `gap-found` / `not-checked`.
**Severity (only when `gap-found`):** `blocks launch` /
`should fix before launch` / `track post-launch`.

---

## SPP-1 — No persistent roles

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Full-repo grep for `users.role` reads used as authz gates | gap-found | `server/routes/projects.ts:136,167` still filter `AND u.role = 'teacher'` on `/:id/teacher-share` and `/:id/help-request`; `server/routes/groups.ts:436` gates group-invite on `target.role !== 'student'` | should fix before launch |
| `requireTeacher()` / `teacherOnly()` / `isTeacher()` helpers removed | verified-clean | `server/routes/comments.ts:27` comment confirms removal; no remaining definitions found in `server/routes/*.ts` grep | — |
| Self-serve `POST /api/users/me/upgrade-teacher` | verified-clean | `server/routes/users.ts:152` returns 410 Gone | — |
| `GET /api/users/search` cross-user discovery | verified-clean | `server/routes/users.ts:141` returns 410 Gone | — |
| OAuth adapters no longer promote to `teacher` | verified-clean | `server/auth-providers/loginus.ts:62` and `server/auth-providers/keycloak.ts:67` both hard-code `role: 'student'` | — |
| OAuth callback still writes `role` column from userinfo | verified-clean (defused) | `server/routes/auth.ts:177,188` writes `userRole`, but the adapter always yields `'student'` — persisted, not gated on | — |
| Frontend still branches on `user.role === 'teacher'` (residual UI) | gap-found | `src/SideMenu.tsx:367`, `src/components/teacher/TeacherDashboard.tsx:52`, `src/components/projects/ProjectsPage.tsx:68`, `src/components/user/UserMenu.tsx:114,164`, `src/state/useNotifications.ts:16`; `UserMenu.tsx:164-170` still renders a "Become teacher" menu item wired to the now-410 endpoint (`src/state/api.ts:157-158`) | should fix before launch |
| Admin/debug view granting standing visibility | not-checked | no `admin*.ts` route file exists (`ls server/routes/`), no `/admin` or `/debug` UI route (`src/App.tsx`); if any surface exists it is not on the route table — flag as not-checked rather than assume | — |
| Persistent `groups` / `group_members` substrate still live | gap-found (by design, transitional) | `server/routes/groups.ts` still ships full CRUD + snapshot; SPP-1 doctrine calls this out as "scheduled for migration/removal"; still reachable today | track post-launch |

## SPP-2 — No PII collected from students

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Outsider register no longer accepts `name` | verified-clean | `server/routes/users.ts:30-78`, comment on :24-29, insert on :62 passes `null` for `name` | — |
| Outsider login accepts legacy `name` for grandfathered accounts | gap-found (legacy) | `server/routes/users.ts:107` `... OR name = ? LIMIT 1`; only reads, no new-PII collection, but keeps legacy `name` reachable as a login handle | track post-launch |
| Full-repo grep for `u.name` / `student_name` / `teacher_name` / `author_name` in responses | gap-found | `server/routes/groups.ts:158` (`teacher_name`), `groups.ts:293` (`student_name`), `groups.ts:471` (`student_name`); `server/routes/projects.ts:104` (`student_name`), `projects.ts:134,138` (`SELECT u.name` and `res.json(...teachers)`); `server/routes/help-requests.ts:21,37` (`student_name`) | blocks launch (student paths) / should fix (teacher paths) |
| Project comments handle-only | verified-clean | `server/routes/comments.ts:50` comment + `u.handle as author_handle` at :65,74,140 | — |
| Project shares handle-only | verified-clean | `server/routes/shares.ts:198` returns `u.handle as user_handle` only | — |
| Compete submissions handle-only | verified-clean | `server/routes/compete.ts:578` `u.handle as user_handle`, `:575` comment cites SPP-2 | — |
| Group snapshot (teacher polling live student code) handle-only | verified-clean | `server/routes/groups.ts:361` `u.handle AS student_handle`, no `u.name` in projection; comment :335 cites SPP-2 | — |
| Live-session / real-time code-view path distinct from polling snapshot | not-checked | grep for websocket / `ws://` / `socket.io` in `server/` returns no non-test matches; if a separate live path exists it was not located from route file names — flag `not-checked` rather than assume clean | — |
| `/api/users/me` returns legacy `name` field | verified-clean | `server/routes/users.ts:163` SELECT list omits `name`; response body is `{id, handle, role, created_at}` | — |

## SPP-3 — Tripwire (no first contact between strangers)

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| `POST /api/shares` is the only project-share entry point | verified-clean | `server/routes/projects.ts:7` mounts `createSharesRouter()`; no bulk / admin share endpoint found in `server/routes/*.ts` grep | — |
| Share grant precondition (same group) enforced at INSERT | verified-clean | `server/routes/shares.ts:16-35, 109-115` — CTE-based `shareOwnerAndTargetShareAGroup` gate | — |
| Share grant no longer looks target up by legacy `name` | verified-clean | `server/routes/shares.ts:88-93` — accepts `user_id` or `handle` only | — |
| Session join uses code/link only, no discovery | verified-clean | `server/routes/sessions.ts` (grep for `router.` at line 8): endpoints are `/start`, `/join` (by token), `/allowed-emoji`, `/:sid/comments`, `/:sid/comments/list` — no `list` / `browse` / `active` | — |
| Group invite still resolves target by legacy `name` | gap-found | `server/routes/groups.ts:425` `WHERE lower(handle) = lower(?) OR name = ?` — grandfathered accounts still discoverable via known real name | should fix before launch |
| Group-join by invite code | verified-clean | `server/routes/groups.ts:94-152` — 6-char code, rate-limited on failures (10/min), no enumeration path | — |

## SPP-4 — Structural prevention: emoji-only in-session comms

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Server-side emoji whitelist for session comments | verified-clean | `server/sessions/comments.ts:9-20` — frozen array of 8 emoji, `ALLOWED_SET = new Set(...)`, `isAllowedEmoji()` at :32; route enforces at `server/routes/sessions.ts:72-75` before token verification | — |
| Current whitelist, verbatim | verified-clean | `👍` `👎` `⁉️` `🥶` `☠️` `🔥` `🐢` `1️⃣` (`server/sessions/comments.ts:10-17`) | — |
| Token↔session binding on comment POST | verified-clean | `server/routes/sessions.ts:81-84` — `verified.sid !== req.params.sid` → 403 | — |
| Project comments (async, share-scoped, not "in-session") | gap-found (design, doc'd) | `server/routes/comments.ts:85-145` is free text with `text.trim().length <= 200` cap + `scanSnapshot` scan + review-gate (author-only reads flagged rows, `:68,77`); this is Option B/C from the C1/C3 finding, not SPP-4 structural-prevention. Product decision to broaden SPP-4 remains open. | track post-launch |

## SPP-5 — Publish/share is an immutable snapshot

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Project snapshot is a full row-copy, not a live pointer | verified-clean | `server/routes/snapshots.ts:101-109` INSERT copies `files_json`, `assets_json`, `title` at moment of share; test `server/tests/snapshots.test.ts` asserts frozen values | — |
| Snapshot public projection strips `owner_id` + internal state | verified-clean | `server/routes/snapshots.ts:37-47` `projectPublic` returns only `share_link`, `title`, `files`, `assets`, `created_at`, `public_status`, `fork_count` | — |
| Compete-mode problem authoring — immutable snapshot pipeline | gap-found | `server/routes/compete.ts:378-428` `PUT /teacher/problems/:slug` mutates the same row in place, re-runs scanner, resets `scan_status`. No snapshot table, no share-link, no view-count gate, no immutable copy. | should fix before launch |
| Compete-mode `is_public` / unlisted-by-default | gap-found | grep of `compete.ts` for `public_status` / `unlisted` returns nothing — problems become listable on `GET /problems` (`compete.ts:203-212`) immediately after author writes them, gated only by `archived = 0`. No view-count gate. No human review before listing. | blocks launch (violates SPP-5 pipeline claim) |

## SPP-6 — Full-text scan at every private→share boundary

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Project snapshot boundary | verified-clean | `server/routes/snapshots.ts:96` `scanSnapshot({title, files, assets})` invoked before insert; result persisted | — |
| Project comments boundary (both `text` and `anchor_text`) | verified-clean | `server/routes/comments.ts:122-128` calls `scanSnapshot` with both fields as pseudo-files; result persisted at :137 | — |
| Compete-mode problem boundary (statement + starter + generator + reference + checker + tests) | verified-clean | `server/routes/compete.ts:19-45` `scanProblemPayload` composes all fields; invoked at `:350` (POST) and `:399` (PUT); persisted via `scan_status`, `scan_findings` at :360, :410 | — |
| Compete-mode `/teacher/problems/import` boundary | gap-found | `server/routes/compete.ts:430-521` — `scanProblemPayload` NOT invoked on import; imported problems reach the public `/problems` listing directly | should fix before launch |
| README support | verified-clean (absent) | grep for `readme` in `server/routes/` returns nothing; feature not started, per plan | — |

## SPP-7 — Internal-only author linkage

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| `problems.created_by` never in response bodies | verified-clean | `server/routes/compete.ts:9-13` `PROBLEM_PUBLIC_COLUMNS` omits it | — |
| Snapshot `owner_id` never in public response | verified-clean | `server/routes/snapshots.ts:37-47` `projectPublic` omits `owner_id`; owner endpoints use `projectOwner` | — |
| Full-repo grep for `owner_id` in `res.json(...)` | gap-found | `server/routes/projects.ts:36` `p.user_id as owner_id` projected in `GET /api/projects` list, returned in `res.json(result.rows)` at :46 — visible to any account the project is shared with, not owner-only | should fix before launch |
| Full-repo grep for `student_id`/`author_id`/`user_id` in shared responses | gap-found | `server/routes/help-requests.ts:21,37` `u.id as student_id`; `server/routes/projects.ts:104` `u.id as student_id` in `/shared-with-me`; `server/routes/shares.ts:198` `ps.user_id` in owner share list (owner-only, less severe); `server/routes/comments.ts:65,74,140` `SELECT c.*` returns `author_id` to any share-holder | should fix before launch (help-requests + shared-with-me); track post-launch (comments author_id) |
| Compete-mode submissions view leaks `user_id` to teacher | gap-found (transitional, doc'd as F5) | `server/routes/compete.ts:578` `SELECT DISTINCT s.*` includes `submissions.user_id`; scoped to teacher's own group members | track post-launch |
| No endpoint enumerates forks of a snapshot | verified-clean | grep for `forks` / `forker` returns only test file | — |

## SPP-8 — Layered, honest moderation

| Surface | Status | Evidence | Severity |
|---|---|---|---|
| Snapshot pattern scan runs on write | verified-clean | see SPP-6 rows | — |
| Comment pattern scan + author-only visibility of flagged rows | verified-clean | `server/routes/comments.ts:53-60,68,77` — flagged rows only returned to their own author until human clear | — |
| Human-review UI / endpoint for `scan_status='flagged'` | gap-found | grep for `reviewer` / `review.*queue` / `moderator` in `server/routes/` returns only inline comments describing the intent; no endpoint exposes flagged rows to any reviewer; no admin surface; flagged rows accumulate silently | should fix before launch |
| Public report/takedown mechanism | gap-found | grep for `report` / `takedown` / `abuse` returns nothing operational in `server/routes/` | should fix before launch |
| Rate limit on publish / share / comment cycles | gap-found | Only rate limit is `server/routes/groups.ts:14-35` — invalid group-join attempts (10/min). No limit on `POST /api/snapshots/projects/:projectId/snapshot`, `POST /api/projects/:id/comments`, `POST /api/projects/:id/shares`, `POST /api/teacher/problems` | should fix before launch |
| `noindex` header on unlisted snapshot | verified-clean | `server/routes/snapshots.ts:221` sets `X-Robots-Tag: noindex, nofollow` | — |
| `robots.txt` present | gap-found | no `public/robots.txt` file (verified via `ls`) | should fix before launch |

---

## Findings by severity

**Blocks launch (2)**

- SPP-2 student-name leaks in `groups.ts:293,471`, `projects.ts:104`, `help-requests.ts:21,37`.
- SPP-5 compete-mode publish has no unlisted / view-gate / human-review pipeline.

**Should fix before launch (10)**

- SPP-1 residual role gates in `projects.ts:136,167` and `groups.ts:436`.
- SPP-1 frontend still renders "Become teacher" wired to a 410 endpoint.
- SPP-2 teacher-name leaks (`teacher_name` in `groups.ts:158`, `teachers` array in `projects.ts:145`).
- SPP-3 group invite still resolves by legacy `name` (`groups.ts:425`).
- SPP-6 compete-mode `POST /teacher/problems/import` bypasses the scanner.
- SPP-7 `owner_id` leaked in `GET /api/projects` response.
- SPP-7 `student_id` leaked in `help-requests.ts` and `projects.ts:/shared-with-me`.
- SPP-8 no human-review endpoint for flagged rows.
- SPP-8 no report/takedown endpoint.
- SPP-8 no publish/comment/share rate limits.
- SPP-8 no `public/robots.txt`.

**Track post-launch (5)**

- SPP-1 persistent groups substrate (transitional by design).
- SPP-2 outsider-login `... OR name = ?` for grandfathered accounts.
- SPP-4 broadening to project comments (product decision).
- SPP-7 `author_id` in comment rows (scope limited to share-holders).
- SPP-7 `submissions.user_id` to teacher (F5 transitional).
