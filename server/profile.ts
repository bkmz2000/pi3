// Deployment profile seam.
//
// A single env var (DEPLOYMENT_PROFILE) picks between two authorization
// philosophies that share the same code:
//
//   institutional  — persistent roles, real identities, teacher-directory
//                    accountable to a school. This is what main historically
//                    behaved like; it is the default.
//   public         — no persistent role, ephemeral sessions, no queryable
//                    directory. This is the public-launch stance ported
//                    from feat/phase1-campaign-classroom.
//
// Adding a third profile is a matter of extending the enum and the
// `resolve()` switch below. Callers must never branch directly on the raw
// env string — always go through the exported config.

export type DeploymentProfile = 'institutional' | 'public';

export interface ProfileConfig {
  profile: DeploymentProfile;

  // /users/search behavior
  userSearch:
    | { mode: 'teacher_directory' }
    | { mode: 'disabled_gone' };

  // Snapshot public projection: attach author name or strip it.
  snapshotPublicIncludesAuthor: boolean;

  // Comment channel disposition — free-text vs emoji-only. Emoji-only mode
  // is not yet ported to main; the seam is here so Phase 3 can flip it
  // without touching routes/comments.ts again.
  commentsMode: 'freetext_scanned' | 'emoji_only';
}

function resolve(profile: DeploymentProfile): ProfileConfig {
  switch (profile) {
    case 'public':
      return {
        profile,
        userSearch: { mode: 'disabled_gone' },
        snapshotPublicIncludesAuthor: false,
        commentsMode: 'emoji_only',
      };
    case 'institutional':
    default:
      return {
        profile: 'institutional',
        userSearch: { mode: 'teacher_directory' },
        snapshotPublicIncludesAuthor: true,
        commentsMode: 'freetext_scanned',
      };
  }
}

function readEnv(): DeploymentProfile {
  const raw = (process.env['DEPLOYMENT_PROFILE'] ?? '').trim().toLowerCase();
  if (raw === 'public') return 'public';
  if (raw === 'institutional' || raw === '') return 'institutional';
  // Loud fail-safe: an unknown value should fall to institutional (the
  // more restrictive-of-outbound-data default), not silently switch to
  // public. Log so it's noticed.
  console.warn(`[profile] unknown DEPLOYMENT_PROFILE='${raw}', falling back to 'institutional'`);
  return 'institutional';
}

// Live resolver — reads env on every call. Simple and test-friendly:
// tests can set/unset DEPLOYMENT_PROFILE per case without module cache tricks.
// Hot-path callers can capture the result at boot if the overhead matters.
export function getProfile(): ProfileConfig {
  return resolve(readEnv());
}
