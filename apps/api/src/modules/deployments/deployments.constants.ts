/** BullMQ queue that carries deployment execution jobs. */
export const DEPLOY_QUEUE = 'deployments';

export interface DeployJobData {
  deploymentId: string;
  orgId: string;
  repoId: string;
}

/** Builds a simulated public URL for a deployment. */
export function deploymentUrl(
  repoSlug: string,
  envSlug: string,
  isProduction: boolean,
  discriminator: string,
): string {
  if (isProduction) return `https://${repoSlug}.rant.app`;
  return `https://${repoSlug}-${envSlug}-${discriminator}.rant.app`;
}

/**
 * Deterministic failure hook for simulated deployments — a branch containing
 * "break" or "fail" deploys red, so the failure path is demonstrable.
 */
export function deployShouldFail(branch: string): boolean {
  const b = branch.toLowerCase();
  return b.includes('break') || b.includes('fail');
}
