# Doctrine — Safety & Privacy, split by profile

Structural doctrine for the unified pi3 codebase. Split into three sections
so that a reader can see what applies always, what applies to the
institutional deployment (Систематика school), and what applies to the
public-launch profile ported from `feat/phase1-campaign-classroom`.

Deployment profile is selected by the `DEPLOYMENT_PROFILE` env var
(`institutional` | `public`). Default: `institutional`.

---

## Core — universal, applies to every deployment

These principles are enforced in shared code that runs regardless of profile.

- **CORE-1: All published content passes through a pre-share content scanner.**
  Scope of scanning is the *full raw text* of a submission — code, comments,
  docstrings, string literals, identifiers, titles, README. No exceptions
  carved out for "it's just code." Layered, not airtight: catches the
  accidental/lazy cases and holds flagged content for human review.
  What "holds for review" gates is specifically the CORE-7 public-listing
  request (`scan_status` must be `clean`) — it does **not** gate the private
  share link itself. A share link is opt-in distribution to whoever holds
  it, not public discovery, so a flagged snapshot/problem stays fully
  readable and forkable via its link. This is a deliberate, current product
  decision (undiscoverable/link-only sharing is an accepted state), not a
  gap — revisit if/when public listing is prioritized.
  Implementation: `server/snapshots/scanner.ts`.

- **CORE-2: Publishing anything is a snapshot.** Private originals stay
  account-linked and editable; a share/publish action stamps an immutable
  copy. New edits require a new snapshot. Whether the snapshot's public
  projection includes an author identity is a **profile decision** (see
  Institutional-2 / Public-2), but the snapshot mechanism itself is
  universal. Implementation: `server/routes/snapshots.ts`.

- **CORE-3: Author-project linkage is internal-only.** `owner_id` on
  `project_snapshots` is used only for (a) letting authors manage/revoke
  their own shares and (b) catching repeat abuse. It must never appear in
  a projection returned to a caller who is not the owner or a reviewer.

- **CORE-4: Moderation is layered, not airtight.** Pattern scan for the
  accidental cases + visible report mechanism + defined reviewer allowlist
  (`REVIEWER_IDS` env var). No claim of an unreachable zero-incidence
  guarantee. Implementation: `server/routes/moderation.ts`.

- **CORE-5: Write endpoints that touch shared surfaces are per-user
  rate-limited.** Publish, share, comment, problem authoring, snapshot
  creation, fork — each has its own bucket. Complements the IP-keyed
  anonymous-auth limiter. Implementation:
  `server/middleware/rateLimitPerUser.ts`.

- **CORE-6: Search index directives are always applied to shareable
  content.** `X-Robots-Tag: noindex, nofollow` on public snapshot reads,
  regardless of profile.

- **CORE-7: Snapshot public listing requires a distinct-viewer threshold
  and a reviewer decision.** Merely toggling `public_status` is not enough
  — an author can only *request* a listing after (a) scan is `clean`, and
  (b) a per-account distinct-view count is met. **Current status: the
  request step is implemented and recorded (`public_status = 'requested'`),
  but there is no reviewer approve/reject surface yet — a request is
  accepted but not currently actionable.** This is intentional: public
  discovery/listing is not being pursued right now (undiscoverable,
  link-only sharing is fine for now), so building the reviewer decision
  endpoint is parked, not a bug to fix. The same framing applies to
  `compete.ts` problem `public_status = 'pending_review'`. Revisit when
  public discoverability is prioritized.

- **CORE-8: Live editor buffers are ephemeral telemetry, not snapshots.**
  The live-code view (teacher dashboard + session group view) streams the
  current file buffer via presence pings. It is a *single overwritten row per
  student* (no history), size-capped, never scanned, never published, and never
  attributed in a public projection — it is categorically distinct from a CORE-2
  snapshot. A buffer is only ever readable inside a boundary that *already* grants
  activity visibility: an owned group (institutional teacher) or a session the
  reader holds a valid token for. Visibility inside a session is decided by the
  token, not the profile — a `groupId`-bound (classroom) token is asymmetric
  (only the starter reads peers); an unbound token is symmetric.
  Implementation: `server/routes/live.ts`, migration `012_live_code.sql`.

---

## Profile: institutional (default) — persistent identity, teacher-directory

Applies when `DEPLOYMENT_PROFILE=institutional` or unset. This is the
current Систематика deployment stance.

- **INST-1: Persistent roles.** A user's `role` (`student`/`teacher`) is
  set at account creation and persists across sessions. Role gates:
  - Comment authoring is restricted to (project owner) OR (teacher with
    share access).
  - Problem authoring is teacher-only.
  - Reviewer decisions require inclusion in `REVIEWER_IDS`.

- **INST-2: Snapshot public projections attach `author_name`.**
  Attribution supports accountability inside a known institution — the
  student and teacher know each other outside the app; hiding names
  inside the app buys nothing and loses pedagogical clarity.

- **INST-3: `/users/search` returns a teacher directory.** Any authed
  user can query; results filter to `role = 'teacher'`. Rationale: the
  share dialog lets students grant a teacher access to their project.
  Student→student directory enumeration is not a supported use case,
  so those rows never appear.

- **INST-4: Free-text project comments.** Teachers write feedback on
  student projects in prose, gated by CORE-1 scanner + CORE-5 rate
  limits + a length cap. Flagged content is rejected at submission time
  (422, with the specific findings named) — nothing is stored, and the
  author edits and resubmits. There is no held-for-review queue for
  comments (unlike the CORE-1 snapshot/problem scan, comments never reach
  a stored-but-gated state).

- **INST-5: Session store is server-backed.** Cookie-based sessions via
  `express-session`; SQLite or Redis store per env. No ephemeral-token
  handoff outside the OAuth callback.

---

## Profile: public — no persistent role, ephemeral, no directory

Applies when `DEPLOYMENT_PROFILE=public`. Corresponds to the design
articulated in campaign-classroom's SPP-1 through SPP-8. **Not yet fully
wired** on main; landing behind this profile is Phase 3 of the
reconciliation plan.

- **PUB-1: No persistent roles.** No standing "teacher" badge grants an
  account ongoing visibility into another's activity. Any collaborative
  session is ephemeral (short expiry, symmetric — anyone can start one).

- **PUB-2: Snapshot public projections strip author identity.** Attribution
  is not attached; the snapshot pipeline already keeps `owner_id` internal
  (see CORE-3). Fork counts are aggregate-only; no endpoint enumerates
  forks or their owners.

- **PUB-3: `/users/search` returns 410 Gone.** No queryable directory.
  Access to another user's context is only through session invite links.

- **PUB-4: Emoji-only in-session communication.** Structural prevention,
  not a filter. Fixed small palette. Applies to the ephemeral session
  channel, not project comments — which are still free-text under CORE-1.

- **PUB-5: No PII collected from students.** Auto-generated handle;
  only the password is user-editable. No name, email, or other identifier
  requested in the student path.

- **PUB-6: Tripwire — pi3 never facilitates first contact between
  strangers.** Every relationship using pi3 must pre-exist it. Any
  feature involving persistent handles, public profiles, follow/DM
  mechanics, or open cross-user leaderboards must be evaluated against
  this before being built.

- **PUB-7: Session join is by signed link/token only — no short join codes.**
  A live session (CORE-8) is joined by opening a link carrying the signed
  session token (in the URL fragment, never the query). A *short, memorable*
  join code was evaluated against PUB-6 and **rejected**: its only purpose is
  casual shareability, which is exactly the broadcast-to-strangers vector PUB-6
  guards. A signed link stays something you deliberately hand to a known person,
  and adds no discovery surface (no directory, no enumeration). Revisit only via
  an explicit PUB-6 amendment. Implementation: `server/routes/sessions.ts`.

---

## Where this doctrine is enforced

| Principle | Code |
|---|---|
| CORE-1 scanner | `server/snapshots/scanner.ts`, wired in `routes/{projects,compete,comments}.ts` |
| CORE-2 snapshot pipeline | `server/routes/snapshots.ts`, migration `011_project_snapshots.sql` |
| CORE-3 owner internal | `snapshots.ts:projectPublic`, `snapshots.ts:projectOwner` |
| CORE-4 moderation | `server/routes/moderation.ts`, migration `010_content_reports.sql` |
| CORE-5 rate limits | `server/middleware/rateLimitPerUser.ts` |
| CORE-6 robots directive | `snapshots.ts` GET `/s/:shareLink` |
| CORE-7 request-to-publish gate | `snapshots.ts` POST `/:snapshotId/request-public` |
| INST-2 / PUB-2 attribution swap | `snapshots.ts:projectPublic`, gated by `getProfile().snapshotPublicIncludesAuthor` |
| INST-3 / PUB-3 search behavior | `routes/users.ts` GET `/search`, gated by `getProfile().userSearch.mode` |
| Profile resolver | `server/profile.ts` |
