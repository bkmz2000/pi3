# Deployment and Project Data Safety Policy

**Status:** Required release policy

**Release gate status: READY**

`READY` means **eligible to attempt a controlled promotion**, not "deployed" or
"production canary passed." The operator may commit `READY` only after the
pre-promotion controls are evidenced: reviewed durability changes, a tested
rollback/canary path, and a recorded off-host restore drill. For this manually
attended pilot, independent external host-down monitoring is recommended but
not a launch gate (see the accepted risk below). The full release gate then
runs on that exact clean `production` commit and creates a short-lived,
commit/profile-bound
stamp; candidate publication does not change production. Promotion still
requires the published image digest and separate exact-tuple approval. The
production canary cannot run against the new image until *after* promotion:
`make promote-vps` must run it before declaring success and must roll back on
failure. Keep release-specific rollback evidence through the attended watch;
only `make finalize-vps FINALIZE_FOR_SHA=<full commit SHA>` may retire it after
ten minutes and another health/identity check. Only after that finalizer exits
successfully does the Make target run a pi3-scoped image cleanup. It verifies the
finalized running digest and the unique pre-deploy manifest row, preserves the
current and immediately previous image, and removes only unused pi3 images and
stopped empty-writable-layer pi3 app containers (never `-v`). Cleanup fails
closed on pending markers, unknown aliases/dependencies, or missing backup,
timer, image, or volume evidence. It never prunes globally or mutates backups,
the manifest, or database volume; cleanup failure does not roll back the
finalized release. After finalization, a dry-run can be run with
`ssh "$VPS" "sh -s -- --dry-run <full-release-sha>" < scripts/cleanup-vps-images.sh`.

Never set `READY` merely to get past a failing gate, or treat a successful local
gate as a production canary.

**Applies to:** every pi3 deployment, including institutional and public profiles

**Owner:** release operator

**Goal:** a deployment must never make a student's previously durable project disappear

## 1. The durability contract

pi3 uses three distinct words for project state. The UI, documentation, tests,
and support must use them consistently:

| State | Meaning | User-facing wording |
|---|---|---|
| In memory | The project exists only in the current tab | **Not saved** |
| Local | A stable project record exists in IndexedDB on this browser profile | **On this device — not backed up** |
| Durable | The server acknowledged the write and a subsequent read can retrieve it, or the user completed a ZIP export | **Saved and backed up** |

The unqualified word **Saved** is reserved for the durable state. A green save
indicator must not be shown for an in-memory project, a single-slot
`localStorage` stash, or an offline write that has not reached the server.

Browser storage is a recovery cache, not a backup. It can be removed by the
user, the browser, private browsing, a profile change, a device failure, an
origin change, or application migration code. Therefore any project that pi3
presents as durable must have a server copy or a user-confirmed export.

## 2. Product invariants that block a release

A release is blocked unless all of these are true:

1. Every new project receives a stable ID before the first edit.
2. Anonymous projects are stored as separate records in IndexedDB. Creating or
   editing one anonymous project cannot overwrite another.
3. Anonymous and offline projects remain visibly marked **On this device** until
   they are claimed/synced or exported.
4. Sign-in and reconnect sync are copy-first: the local record is retained until
   the server write succeeds and a read-back matches the local revision.
5. Conflicts create another recoverable revision; neither side is overwritten
   silently.
6. Browser database upgrades are copy-forward migrations. They must never call
   `deleteObjectStore`, `indexedDB.deleteDatabase`, or clear a content store.
7. Every browser-storage migration has an automated test that starts with the
   previous released schema and verifies project IDs, files, assets, sheets,
   sounds, tilemaps, and queued saves after upgrade.
8. The production origin (scheme + hostname + port) is stable. An origin change
   requires an explicit in-app export/import migration period before cutover.
9. The Projects surface always exposes ZIP export for local and server projects.
10. Storage quota or persistence failures keep the project dirty and show a
    blocking recovery action; they never resolve as a successful save.

### Current release status: READY for a corrected controlled attempt (2026-09-26)

The failed canary's 401 was reproduced in the real `server/index.ts` assembly:
`createCompeteRouter()` is mounted at `/api` and its account-auth middleware
rejected the scoped token before `/api/canary` was reached. The scoped router
now mounts before that broad router, without granting scoped tokens access to
normal account APIs. Production-assembly regression coverage verifies issuance,
scoped read/delete/absence, and rejection by `/api/users/me`. The 403 fallback
cleanup was missing the CSRF header on its bodyless DELETE; the browser helper
now always sends `X-Requested-With: XMLHttpRequest`. Scoped deletion removes
project presence, and the canary leaves the editor before cleanup to stop its
background writes. Reload comparison now normalizes actual newlines rather than
literal backslash sequences. Both rollback paths retain their evidence for
operator reconciliation; post-canary rollback also restores `.env`'s image.

Local regressions and full browser E2E pass. The reconciled production baseline
is the healthy prior digest, with no canary leftovers. READY permits a new
controlled attempt only: exact-commit gates, immutable publication and fresh
digest-bound owner approval remain mandatory. No new promotion success is
claimed by these fixes. The incident history below records the earlier state.

A controlled promotion of commit `a8dd8c71a0409db155d3c49971347b585bcac497`
was explicitly approved for institutional candidate
`ghcr.io/bkmz2000/pi3@sha256:318fcb14de0a5a38faa5a3e843a29ef639f156e6470a77f5d402be2a42dd0906`
and briefly started on 2026-09-26. Its immediate health probe got a connection reset; rollback's one-shot health
probe also failed, and the production canary never ran. Bounded polling was
implemented, regression-tested for startup recovery/timeouts, and passed the
exact institutional release gate in commit
`69982820f24be48ef1fab4b017a4b3bdb23bd85a`. Its replacement digest
`ghcr.io/bkmz2000/pi3@sha256:edacd140b849984f1e89ae93a4aae93d96dd563070b951572498b3106be9395e`
was published but not promoted; it lacks the subsequent fail-closed state
guard and must not be used.

The failed state was reconciled on 2026-09-26 without changing the running
container, `docker-compose.yml`, `.env`, or database. Compose, `.env`, container
reference, and running image ID all select prior digest
`ghcr.io/bkmz2000/pi3@sha256:4f55bd0d89533ecd288694638c80c186fd6e36b55fb82b0c17a48cbbb12e0404`;
internal and public `/api/health` returned 200 on repeated checks. The legacy
image has no release labels, so its release SHA remains **unknown**; no SHA was
invented. The four retained Compose/image/SHA markers were copied byte-for-byte,
checksum-verified, and archived at
`/srv/pi3/backups/reconciliation-failed-promotion-20260926T112917Z-20260926T140349Z`
(mode `0700`, files `0600`) and in a protected local archive under
`~/.local/share/pi3/reconciliation/`. Only after both copies verified were the
active markers retired. The encrypted pre-deploy snapshot
`pi3-predeploy-20260926T112917Z.db.age` remains mode `0600` with its manifest
binding intact.

Candidate startup applied the additive `014_canary_tokens.sql` migration to
the live database (migration count 15→16). Read-only checks after reconciliation
found SQLite integrity `ok`, 42 projects, 17 users, 16 migrations including
014, and zero canary-token rows. An isolated fixture using the exact prior image
applied 014, then successfully reran that image's `initDb()`; integrity remained
`ok` and all 16 migration records remained. This verifies prior-image startup
against the additive schema, not student-level API behavior. The actual
authenticated API/UI canary remains mandatory after the next approved image
switch. Never restore the older database snapshot as rollback.

The current source adds fail-closed guards: `make promote-vps` rejects all five
pending Compose/image/SHA/watch markers (including symlinks), and the VPS deploy
script independently rejects rollback/image/SHA/watch markers before deployment
mutations. The earlier `6998282` image does not contain those guards and is not
eligible for this attempt. The exact current source commit must pass its own
release gate and be published as an immutable matching digest. READY means
**eligible to attempt** a controlled promotion, not deployed or canary-passed;
explicit approval for the exact commit/profile/digest/VPS/origin is still
required. No successful promotion or canary is recorded.

A later explicit approval authorized commit `39eafcd2eb58b2c958c50a9a6cd07d407cae8629`, profile `institutional`, image `ghcr.io/bkmz2000/pi3@sha256:d064fe858559bbd38352b925ee02eac79c4a0ec1173b21bac4f0879cd00e7a29`, VPS `root@159.194.196.40`, and origin `https://pi3.sys5.ru`. Its exact-commit release gate passed and the digest labels matched. Candidate health and DB read-back passed (42 projects, 17 users, 16 migrations, project read-back verified), but the post-switch API/UI canary failed: scoped project read returned HTTP 401; automatic scoped cleanup returned 401 and the session cleanup path returned 403. `make promote-vps` automatically rolled back to the prior pinned digest `sha256:4f55bd0d89533ecd288694638c80c186fd6e36b55fb82b0c17a48cbbb12e0404`; rollback health passed after two probes. Subsequent read-only checks showed the prior image running and both internal/public health 200. The encrypted attempt snapshot `pi3-predeploy-20260926T153328Z.db.age` remains mode 0600. The approved `.env` repair changed only `PI3_IMAGE` to the prior digest, without restarting the container; its pre-edit copy is preserved mode 0600 at `/srv/pi3/backups/reconciliation-canary-failure-20260926T172215Z/.env.before` in a mode-0700 directory. Compose, `.env`, and the running container now select the prior digest; the current release SHA remains `unknown`. The rollback command retired its release-specific markers after verified rollback. A later owner-authorized, guarded transaction revalidated the exact generated project, expired scoped token, and matching `live_presence` row, confirmed no other project-ID dependencies, and removed exactly those three rows. Final SQLite integrity is `ok`; counts returned to 42 projects, 17 users, 16 migrations, with both internal/public health 200 and no canary artifacts remaining. No production promotion or canary success occurred. Policy was kept **BLOCKED** until the reproduced routing defect and rollback handling were fixed as described above; the failed candidate itself remains ineligible for retry.

- Historical browser-save review blockers (local-draft export, claim read-back,
  reconnect/editor revision, post-conflict autosave, clean-draft claiming, and
  recovery after unknown revisions) were fixed and covered by tests in the
  reviewed candidate. Focused client and release follow-ups returned **OK with
  notes**; the exact clean-commit release gate passed for the attempted
  candidate. Those results do not override the current deployment failure or
  mean the production canary passed.
- **Migration dry-run recorded locally on 2026-09-25:** verified the encrypted
  checksum for `pi3-daily-2026-09-25.db.age`, decrypted only into a private local
  temporary directory, and ran the current `initDb()` migrations against that
  isolated copy. SQLite integrity remained `ok`; the database advanced from 15
  to 16 tracked migrations (`014_canary_tokens.sql`), project/user counts stayed
  at 39/15, and a representative project content hash was unchanged. The
  plaintext and fixture were removed. This was against the current worktree,
  not a clean committed image or the live database. The local release gate now
  exercises an isolated candidate-migration fixture; the promotion script runs
  the candidate image's migration code on a tmpfs copy of the verified snapshot
  before changing the container. Neither is evidence for the exact clean
  committed/published candidate until the gate and actual promotion are verified.
- **Off-host restore drill recorded on 2026-09-25 at 17:57 UTC:** copied
  `pi3-daily-2026-09-25.db.age` to a private local temporary directory, checked
  its encrypted and decrypted SHA-256 values against the VPS manifest, restored
  SQLite (`integrity_check=ok`, 39 projects, 15 users, 15 migrations), and read
  a copied four-file project through the authenticated API of an isolated local
  server. The temporary plaintext, test database, and server were removed.
  The VPS marking helper preserved `pi3-restore-verified.db.age` and its matching
  JSON record; the active freshness checker then passed. The legacy nightly
  backup manifest omitted `file`, so a checksum-verified, append-only filename
  binding was added before invoking the helper; the nightly executable itself
  was not replaced. This snapshot has sheets but no assets, sounds, or tilemaps
  to exercise. Repeat monthly; an independent external host-down monitor is
  still missing but is not a gate for this attended pilot. Same-VPS retention
  is not an off-host backup.
- Read-only production inspection on 2026-09-25 found the running container
  mounted only the database Docker volume; `/srv/pi3/backups` was not mounted.
  The host backup directory was root-owned mode 700. Keep verifying this
  invariant; same-host backups do not protect against VPS/disk loss.
- The configured production canary account ID was verified read-only as an
  existing student; its value is not recorded here. An unauthenticated probe
  confirms `/api/canary/token` is mounted (401); this does not verify token
  issuance. The first live canary attempt could not authenticate and hit
  Puppeteer's default three-minute CDP timeout while the script allows ten
  minutes for operator sign-in. No canary project was created, and a subsequent
  read-only DB query found no `Release canary` projects. The launcher now sets
  an 11-minute protocol timeout; the authenticated API/UI canary must still be
  completed on the candidate. In a subsequent authorized live check, the
  dedicated student authenticated and a temporary project was created, but
  scoped-token issuance returned 404 on the currently running legacy `:latest`
  image; the student session's DELETE returned 403. The exact canary row was
  removed in a guarded transaction after verifying its name and that it had no
  related rows. No image/container was changed. This verifies the old production
  image is not a valid target for the new canary; do not rerun against it. The
  candidate's canary runs *after* its approved switch, within the rollback-
  protected command. This legacy-image check preceded the approved but failed
  candidate promotion described above; the subsequent canary attempt failed with HTTP 401 on scoped read-back, and automatic rollback succeeded. Its project/token cleanup was then authorized but safely aborted after finding a live-presence dependency. See the incident record below.
- The Vercel production path has no policy-compliant rollback/canary workflow and
  remains deliberately disabled.
- Before promotion, `scripts/verify-age-recipient.sh` must derive exactly one
  public recipient from the operator-owned mode-0600 local age identity using
  trusted host `age-keygen -y`, and match it exactly to
  `BACKUP_AGE_RECIPIENT`. The private identity is never sent to the VPS or
  mounted into a candidate container. The predeploy encryption container has
  no network, sees only the snapshot via a read-only file mount, and writes
  ciphertext to a private host temp file through stdout. The release stamp now
  requires `make test`'s coverage-gated container suite in addition to the
  existing local gates; a failed run must not leave a valid stamp.

Operationally verified: the installed `pi3-backup.timer` runs nightly (00:30 UTC
with up to 10 minutes randomized delay), encrypts backups under `/srv/pi3/backups`,
and applies 7 daily, 4 weekly, and 1 monthly retention. The local code provides
a separate protected restore-verified copy, Telegram success/failure messages,
and a daily backup/restore freshness checker. Telegram credentials are now
configured on the VPS in root-owned mode 0600, and Telegram's `getChat` API
accepted the token/chat pair. On 2026-09-25 the notifier scripts and
`pi3-backup-alert-check.timer` were installed, enabled, and exercised. The app
container was not replaced. The existing nightly backup executable still lacks
immediate Telegram hooks until a reviewed image establishes release markers.
The age private identity is local at `~/.config/age/pi3-backup-identity.txt` (mode 0600); only the public recipient is
on the VPS. These same-VPS backups are not off-host protection.

### Telegram backup alerts (local implementation)

The local host-side `vps-backup.sh` implementation sends Telegram notifications
after a completed or failed backup (this version is not yet installed).
`mark-restore-verified.sh` sends a success notification only after an operator
records a completed off-host restore drill. A daily systemd checker
validates the newest manifest-listed backup file/checksum (36-hour freshness
threshold) and the protected restore-drill artifact/record (35-day threshold).
It notifies on a new issue, repeats unresolved alerts weekly, and sends a
recovery message when the condition clears.

To enable on the VPS, create a bot with Telegram's `@BotFather`, start a chat
with it, and obtain the destination chat ID. Do not put either value in Git or
send the bot token in chat. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to
`/etc/pi3-backup.env` using `sudoedit`; keep that file `root:root` mode 0600.
Install `scripts/telegram-notify.sh` as
`/usr/local/sbin/pi3-telegram-notify` and `scripts/backup-alert-check.sh` as
`/usr/local/sbin/pi3-backup-alert-check`, root-owned mode 0750. Install
`mark-restore-verified.sh` for operator use, install the two
`scripts/systemd/pi3-backup-alert-check.*` units into `/etc/systemd/system`,
then reload systemd and enable `pi3-backup-alert-check.timer`. Send a manual test
message and run the checker once; before the first drill the checker alerts
that a restore drill has not yet been recorded.

Do not replace the existing `/usr/local/sbin/pi3-vps-backup` yet. The local
`vps-backup.sh` deliberately refuses to create backups unless the running image
has a digest-pinned release identity and matching `.pi3-current-*` markers;
those markers are absent on the current production image. Keep the existing
nightly backup job intact until a reviewed candidate establishes that identity,
then install the new backup implementation as a separate verified step.

This on-host checker cannot notify if the entire VPS, its network, or Telegram
connectivity is down. **Accepted pilot risk:** for a manually attended release
with a small user base, an independent external dead-man's-switch monitor is
recommended, not a promotion prerequisite. The operator must watch the rollout
and check service/backup health the next day. A later total VPS/network outage
may go unnoticed until a human checks; same-host backups may be lost with the
host. Add external monitoring before unattended releases or a larger cohort;
manual attention at deploy time is not equivalent to 24/7 alerting. Telegram
and the first off-host drill are recorded. Despite the prior local review and
release gate, the 2026-09-26 promotion attempt failed during readiness/rollback
probes. Bounded health polling is now implemented and gated, and the failed state was
reconciled with evidence preserved as recorded above. Current status is **READY
for a controlled attempt only**. The
production canary is mandatory *after* the image switch and before rollout
success.

The current release workflow builds/publishes a candidate first,
then requires separate, command-line approval bound to commit, registry
digest, deployment profile, VPS target, and origin before promotion. The
production canary must then pass; rollback must restore the prior pinned image
and Compose configuration. The failed attempt means the full controlled promotion workflow has not yet
completed successfully.

Regardless of READY, no production switch occurs until the exact published digest,
commit, profile, VPS target, and origin have been approved explicitly on the
promotion command. If the canary or artifact checks fail, the command must roll
back; keep rollback evidence through the attended watch. The failed attempt's markers are archived and checksum-verified at the
locations recorded above. The prior release SHA remains unknown; do not infer
or fabricate it. This reconciliation does not count as candidate canary or
promotion success.

## 3. Server data protection

### Recommended operational policy

- **Pre-deploy:** create an encrypted SQLite online backup under
  `/srv/pi3/backups`, verify its checksum, and validate the plaintext online
  snapshot's integrity and row counts against the live DB before replacing any
  container. Abort if validation fails; recovery-key decryption remains an
  off-host restore-drill responsibility.
- **Scheduled:** nightly encrypted backup on the VPS host filesystem via
  `pi3-backup.timer` and `/usr/local/sbin/pi3-vps-backup`. The local implementation
  validates the online snapshot's integrity, row counts, migration names, and a
  representative project's content hash against the source before encryption.
  Each daily/weekly/monthly manifest entry records its filename, source
  release/image digest, checksums, size, and verification metadata. The local
  implementation sends Telegram success/failure notices and includes a daily
  freshness checker. The new backup executable is not installed on the VPS;
  the separate freshness checker is installed and active. This is a snapshot
  check—not a decrypt-and-restore drill. The age private identity stays
  off-host, so periodic off-host restore tests remain necessary.
- **Retention:** 7 daily, 4 weekly, and 1 monthly, plus pre-deploy copies kept
  for 30 days and one separately protected `pi3-restore-verified.db.age` copy.
  After a full off-host restore drill passes, an operator must run
  `scripts/mark-restore-verified.sh <backup-file.db.age> --restore-drill-passed`
  on the VPS to publish/replace that protected copy. Normal rotation never prunes
  it. The 2026-09-25 off-host drill was recorded with the installed helper;
  prune only after a new snapshot passes its checks.
- **Recovery keys:** keep the age private identity outside the VPS (password
  manager/offline recovery escrow), restrict access to named operators, and
  rehearse key recovery. Store only the public recipient on the VPS. Losing the
  private key makes encrypted backups unusable.
- **Restore drills:** monthly full restore to an isolated database/environment;
  verify SQLite integrity, migrations, project counts, representative project
  files/assets, and application read paths. Record result, operator, backup
  checksum, release, and elapsed time. Block planned releases if overdue/failing.
- **Objectives:** target RPO ≤24 hours for ordinary incidents (zero data loss
  across deploys because of mandatory pre-deploy backup) and RTO ≤60 minutes.


The SQLite database is primary storage for authenticated projects. A Docker
volume prevents ordinary container replacement from deleting it, but it is not
a backup.

Required controls:

- Use SQLite's online backup API (the `.backup` command is acceptable) so the
  database and WAL are captured consistently while the service is running.
- Store backups on the VPS host at `/srv/pi3/backups`, outside Docker volumes.
  This is not protection against loss of the VPS or its disk.
- Encrypt backups in transit and at rest.
- Create an automatic backup at least daily and immediately before every deploy.
- Retain 7 daily, 4 weekly, and 1 monthly backup. Keep pre-deploy backups for
  30 days, outside normal rotation, plus one separately protected
  restore-verified encrypted copy. Normal rotation must never prune that copy;
  replace it only after a newer full off-host restore drill passes.
- Restrict access to `/srv/pi3/backups`; do not let the application delete old
  backups. Retention must preserve the protected restore-verified artifact and
  fail closed if its checksum metadata is incomplete or inconsistent.
- For every backup, record UTC timestamp, artifact filename, source release/image
  digest, plaintext and encrypted SHA-256, byte size, `PRAGMA integrity_check`,
  migration names/count, row counts for `users`, `projects`, and
  `schema_migrations`, and a representative project read-back hash in a manifest
  alongside the encrypted backup. These checks establish snapshot validity only.
- A backup is not considered **restore-verified** until it has been decrypted and
  restored into an isolated temporary database and the server's migration and
  project read tests pass against it. Only then may it replace the protected
  restore-verified copy.
- Perform a documented full restore drill monthly into an isolated environment,
  including decrypting with the recovery key, opening the SQLite database,
  checking integrity and migrations, reading representative project content,
  and running application read tests. Record duration and evidence. A missed or
  failed drill blocks the next planned deployment.
- Alert on a missed daily backup, checksum/decryption/integrity failure, low
  VPS disk capacity, or restore drill older than 35 days.

Targets: no project loss caused by deployment; restore time under 60 minutes.
Normal application rollback never restores an older database. Schema changes
must remain compatible with the previous application until the rollback window
closes.

## 4. Schema-change policy

Database changes use an expand/migrate/contract sequence:

1. **Expand:** add nullable/defaulted fields or new tables without removing old
   structures. Both current and previous application versions must work.
2. **Migrate:** copy and verify data in bounded batches. Store progress so the
   operation is resumable.
3. **Contract:** remove old structures only in a later release, after backup
   retention and telemetry confirm that all records migrated.

Migrations must be transactional and idempotent. A migration that rebuilds or
drops a table requires a reviewed row-count/content-equivalence test against a
copy of production data. Catching a migration error and continuing is forbidden
when doing so could leave only part of the schema applied.

The same rules apply to IndexedDB. Browser migrations are treated as production
database migrations, not as disposable cache changes.

## 5. Release procedure

Every production deployment follows this order and records evidence in the
release log:

### Before changing production

1. Identify the exact candidate commit. Confirm the recorded restore drill,
   review, and rollback/canary preparations are ready; explicitly accept the
   missing external-monitor risk for this manually attended pilot. Commit
   `READY` with the candidate on `production` only when these pre-promotion
   conditions are met. It does not claim a gate stamp or a passed production
   canary.
2. Run the full release gate on that exact clean commit and deployment profile:
   lint, unit/server tests, previous-version browser/storage migrations and
   offline sync fixtures, the full browser suite, and builds. `scripts/run-e2e.sh`
   must use a fresh temporary SQLite database with Turso credentials unset so
   local browser tests cannot touch production. Retain the fresh gate stamp.
3. Build and publish an immutable candidate tagged with the full commit SHA;
   record the registry digest. Publication does not change production.
4. Obtain final product-owner approval for that commit/digest/profile/VPS/origin
   tuple. This is a separate command-line input, never stored in config.

### Controlled promotion (`make promote-vps`)

5. Before switching containers, create the encrypted pre-deploy SQLite backup
   under `/srv/pi3/backups`; verify its checksum and restored-copy integrity.
6. Record baseline row counts and read a representative pre-existing project.
7. Dry-run the candidate image's migrations on an isolated restored copy;
   compare row counts, migration names, and project content.
8. Promote only the approved image digest. Keep the previous Compose file and a
   digest-pinned rollback configuration through the canary and attended watch.
9. Never delete or recreate the database volume. Wait for migrations and health
   checks; on failure stop the rollout without automatic destructive retries.

### Verify before declaring success

10. Compare post-deploy row counts with the baseline. Any unexplained decrease
    is an automatic rollback/incident condition.
11. Read the pre-existing project and compare its content hash across files,
    assets, tilemaps, sounds, sheet, current file, owner, and revision.
12. During the same `make promote-vps` invocation, use the dedicated canary
    account to sign in through the opened browser. After the image switch, the
    server issues a 10-minute token scoped to that one canary project for
    read/delete only. The canary creates the project in the authenticated
    session, edits/reloads it through the IDE, verifies the server copy, deletes
    it, and confirms it is gone. Failure triggers release-specific rollback of
    image and Compose; the command cannot report success before this passes.
    A passing canary retains rollback evidence rather than deleting it.
13. Actively watch save failures, migration errors, and project-not-found
    responses for at least 10 minutes after the canary. If anything fails, use
    `make rollback ROLLBACK_FOR_SHA=<full commit SHA>` while its exact rollback
    files are intact. After the watch passes, explicitly run
    `make finalize-vps FINALIZE_FOR_SHA=<full commit SHA>`; it rechecks the live
    image/health and the canary timestamp before retiring those files. Check
    service health, backup freshness, and the same error signals again the next
    day. Treat any data-loss symptom as an incident; the missing external
    host-down monitor remains a separately documented follow-up.

## 6. Rollback and incident response

Application rollback means deploying the previous immutable image against the
same forward-compatible database. It must not replace the database with an old
snapshot.

If any project disappears:

1. Stop deployments and destructive cleanup. Preserve the affected browser
   profile; do not clear site data or uninstall the PWA.
2. Preserve the live database, WAL/SHM files, container logs, image digest, and
   browser storage export before attempting repair.
3. Check, in order: server project rows; IndexedDB `projectContent` and
   `saveQueue`; the legacy `projects` store; `pi3_anon_stash`; downloads/ZIPs.
4. Restore missing data into a new record first. Never overwrite the only
   surviving copy during recovery.
5. Record timeline, scope, cause, recovered/unrecovered projects, and a
   regression test. A fix is incomplete until the test is in the release gate.

## 7. Required verification work

The implementation is not eligible for controlled promotion until the
pre-promotion controls are demonstrated on the exact clean candidate and
supported operational environment. Production acceptance additionally requires
the post-promotion canary; it cannot be a prerequisite for setting `READY`:

- verify claim/sync with revision comparison, read-back verification, and
  copy-first deletion; preserve conflicting revisions rather than overwriting
  silently;
- keep an encrypted pre-deploy backup and the recorded off-host restore drill;
  continue monthly drills and on-host alerts for missed jobs, failed validation,
  low disk space, and stale drills. A failed backup/restore validation blocks
  promotion; the absent *external* host-down monitor alone does not block an
  attended pilot release;
- prepare the dedicated test account and rollback/canary tooling before
  promotion; run and verify the authenticated API/UI canary on production
  immediately after the image switch, with automatic rollback on failure.
  Keep the test-account token out of source control.

No checklist checkbox can waive the durability contract. If a required control
cannot be demonstrated, the release does not proceed.
