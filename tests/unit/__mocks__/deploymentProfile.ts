// deploymentProfile.ts reads import.meta.env, which ts-jest cannot transform.
// Tests run against the public profile (the default of a plain build).
export type DeploymentProfile = 'institutional' | 'public';
export const DEPLOYMENT_PROFILE: DeploymentProfile = 'public';
export const isInstitutional = () => false;
