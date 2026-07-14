# Phase 0 — Reconciliation Findings

Common ancestor: `54505db5` (pre-divergence).

Ahead counts:
- `feat/phase1-campaign-classroom` ahead of `main`: 30 commits
- `main` ahead of `feat/phase1-campaign-classroom`: 16 commits

Neither branch is a superset. Both moved.

---

## 1. Migration lineage

Shared 001–008 (identical filenames). Divergence at **009**.

| # | main | campaign-classroom | Note |
|---|------|--------------------|------|
| 009 | `009_project_version.sql` | `009_projects_user_updated_idx.sql` | **collision** — same slot, different files |
| 010 | — | `010_project_snapshots.sql` | campaign only |
| 011 | — | `011_snapshot_forks.sql` | campaign only |
| 012 | — | `012_problems_source_scan.sql` | campaign only |
| 013 | — | `013_users_name_nullable.sql` | campaign only — enables anon handles |
| 014 | — | `014_project_comments_scan.sql` | campaign only |
| 015 | — | `015_moderation.sql` | campaign only |
| 016 | — | `016_problem_publish_pipeline.sql` | campaign only |

**Phase 4 implication:** the 009 collision must be resolved by renumbering (campaign's items shift by one, or main's `project_version` is folded into a later renamed migration). Both migration runners will already treat "server/db/migrations tolerates already-applied schema" (see main `6788466`) — but the numeric collision itself still requires human resolution before either branch's runner can see both files.

---

## 2. Server module inventory (server/routes, server/middleware, server/auth-providers)

### Present on both
`auth-providers/{index,keycloak,loginus,types}.ts`, `middleware/{auth,decompress,projectAuth,rateLimit}.ts`, `routes/{auth,comments,compete,groups,help-requests,projects,shares,users}.ts`.

### Present only on campaign-classroom
- `routes/moderation.ts` — reviewer queue + report endpoint
- `routes/sessions.ts` — ephemeral join session, emoji-only comments
- `routes/snapshots.ts` — snapshot publish pipeline

No server modules exist on `main` that are absent on campaign-classroom.

---

## 3. Rate limiter — different implementations, complementary scope

**Plan's claim** that `main` "lacks a rate limiter entirely" is inaccurate. Both branches have `server/middleware/rateLimit.ts`, but they are structurally different modules with disjoint use cases:

| | main | campaign |
|---|------|----------|
| Backend | `express-rate-limit` (npm) | custom in-memory `Map<Bucket>` |
| Keyed by | IP (default) | `req.user.id` |
| Applied to | `/api/auth/*`, `/api/users/outsider`, `/api/users/outsider/login` | publish / share / comment / problem writes |
| Test-mode skip | `NODE_ENV=test && !RATE_LIMIT_TEST` | `NODE_ENV=test && RATE_LIMIT_TEST != 'on'` |

**Phase 1 implication:** don't replace main's IP-keyed auth limiter with campaign's user-keyed one. Port campaign's as a second, complementary module (rename to avoid symbol collision — e.g. `rateLimit.write.ts` / `rateLimitPerUser`), and keep main's for anonymous surfaces. The two limiters solve different problems (brute-force anonymous vs authenticated write abuse) and both need to exist post-unification.

---

## 4. Route endpoint diffs

### `routes/compete.ts`
Campaign adds:
- `GET /problems/:slug/solve-count`
- `POST /teacher/problems/:slug/publish`
- `POST /teacher/problems/:slug/request-public`

Main adds nothing campaign lacks.

### `routes/groups.ts`
Campaign adds:
- `GET /:id/snapshot` — classroom polling view
- `POST /:id/session/start` — ephemeral session issuance

### `routes/users.ts`
| Endpoint | main | campaign |
|----------|------|----------|
| `POST /outsider` | `outsiderSignupLimiter` | no limiter |
| `POST /outsider/login` | `outsiderLoginLimiter` | no limiter |
| `GET /search` | Authenticated global directory query | Returns `410 Gone` — search deliberately removed under SPP-1 |
| `POST /me/upgrade-teacher` | absent (already removed on main via `92abf57`) | absent (returns comment marker) |
| `GET /me` | present | present |

**The `/users/search` behavior is the sharpest philosophical fork of the whole codebase.** Main keeps a queryable user directory (needed for share-dialog). Campaign hard-410s the endpoint (no queryable users at all — invite-link only). This is the exact case Phase 2's profile seam must express: `institutional → directory`, `public → 410`.

### `routes/comments.ts`, `routes/shares.ts`, `routes/help-requests.ts`, `routes/projects.ts`
Route lists identical. Bodies differ (auth/authz internals, review gates, snapshot pipeline hooks) — audit deferred to Phase 1 per-port.

### New campaign-only route files
- `routes/moderation.ts` — `GET /flagged`, `POST /problems/:slug/decision`, `POST /report`
- `routes/sessions.ts` — `POST /start`, `POST /join`, `POST /:sid/comments`, `POST /:sid/comments/list`, `GET /allowed-emoji`
- `routes/snapshots.ts` — `POST /projects/:projectId/snapshot`, `GET /mine`, `POST /:snapshotId/request-public`, `POST /:snapshotId/revoke`, `GET /s/:shareLink`, `POST /s/:shareLink/fork`

---

## 5. Phased-plan corrections surfaced by Phase 0

1. **Rate limiter is not a gap-fill.** Reframe Phase 1 item as "port campaign's per-user write limiter as a *second* limiter, don't replace main's."
2. **009 migration collision** is a real coordination point, not an appendable sequence.
3. **`/users/search` is the profile-seam canary.** Whatever abstraction Phase 2 lands should be provable by making `/users/search` behave as `institutional=directory` vs `public=410` from a single codebase.
4. **auth-providers is already abstracted** on both branches — the profile seam builds *on top of* it, not parallel to it (auth-provider = "which IdP"; profile = "what standing does that identity carry").

---

## 6. Route/file-body deep-diff — deferred

Bodies of `comments.ts`, `projects.ts`, `shares.ts`, `help-requests.ts`, `compete.ts` shared endpoints all differ. Not tabulated here — deep-diff belongs inside each Phase 1 port PR (comment-scanner wiring, review-gate visibility, snapshot hooks, etc.) so the port and the diff review happen against the same reviewer's mental model.

---

## Handoff to Phase 1

Order of PRs (each independent, small, hotfix-discipline):
1. Per-user write rate limiter (`rateLimitPerUser`) — no schema change, coexists with existing IP limiter.
2. Content scanner module — pure function, add tests, no wiring yet.
3. Wire scanner into main's `is_public` toggle + problem authoring + comments.
4. Moderation endpoints (`routes/moderation.ts`) + env-var allowlist.
5. Snapshot publish pipeline for `is_public` projects (needs schema — coordinate with Phase 4 or land migration-only slice first).
6. `/users/search` scope-down to teachers-only (institutional-side hardening, not the profile seam yet).

Steps 1–4 need no schema changes and can land immediately. Step 5 forces Phase 4 to at least begin. Step 6 is the last non-profile hardening before Phase 2 begins.
