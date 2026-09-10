export const BRAND_FINANCIAL_COMMAND_SURFACE_HEADER =
  "x-brand-financial-command-surface";

export type BrandFinancialCommandSurface = "SETTINGS" | "PAYOUTS";

/**
 * Settings is the compatibility-safe default. A deployment cuts over both UI
 * capability projection and command admission by setting this value to PAYOUTS.
 */
export function resolveBrandFinancialCommandSurface(
  env: NodeJS.ProcessEnv = process.env,
): BrandFinancialCommandSurface {
  return env.BRAND_PAYOUTS_COMMAND_SURFACE?.trim().toUpperCase() === "PAYOUTS"
    ? "PAYOUTS"
    : "SETTINGS";
}

export function isBrandFinancialCommandSurfaceActive(
  claimedSurface: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const activeSurface = resolveBrandFinancialCommandSurface(env);
  const normalizedClaim = claimedSurface?.trim().toUpperCase();

  // Preserve old Settings clients during rollout and rollback. Once Payouts is
  // active, every mutation must explicitly identify the canonical surface.
  if (!normalizedClaim) return activeSurface === "SETTINGS";
  return normalizedClaim === activeSurface;
}
