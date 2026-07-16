// Client-side view of the deployment profile. Mirrors server/profile.ts values.
// Set VITE_DEPLOYMENT_PROFILE=institutional to skip the public landing page.
export type DeploymentProfile = "institutional" | "public";

export const DEPLOYMENT_PROFILE: DeploymentProfile =
  (import.meta?.env?.VITE_DEPLOYMENT_PROFILE as DeploymentProfile) === "institutional"
    ? "institutional"
    : "public";

export const isInstitutional = () => DEPLOYMENT_PROFILE === "institutional";
