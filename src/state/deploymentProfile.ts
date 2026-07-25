// Client-side view of the deployment profile. Mirrors server/profile.ts values.
// Set VITE_DEPLOYMENT_PROFILE=institutional to skip the public landing page.
//
// The env read must be spelled `import.meta.env.X` exactly: Vite substitutes
// that literal text. An optional-chained `import.meta?.env?.X` is left alone,
// so it reads a native `import.meta` that has no `env` — undefined in dev, and
// constant-folded away at build time. Tests swap this module out via
// `moduleNameMapper` (ts-jest cannot transform `import.meta`).
export type DeploymentProfile = "institutional" | "public";

export const DEPLOYMENT_PROFILE: DeploymentProfile =
  (import.meta.env.VITE_DEPLOYMENT_PROFILE as DeploymentProfile) === "institutional"
    ? "institutional"
    : "public";

export const isInstitutional = () => DEPLOYMENT_PROFILE === "institutional";
