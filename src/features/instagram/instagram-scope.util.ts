import { BrandIntegrationScope, BrandIntegrationStatus } from "@prisma/client";

/**
 * Map Meta/Instagram permission names → platform scopes + connection status.
 *
 * Case 1 (PARTIAL): basic granted, insights withheld.
 * Case 2 (FULL): basic + insights granted.
 * Missing or unrecognized evidence never grants a scope. Callers may add
 * BASIC_PROFILE when a functional `/me` call proves profile access.
 */
export function resolveInstagramScopesFromPermissions(
  permissionNames: string[],
): {
  scopes: BrandIntegrationScope[];
  status: BrandIntegrationStatus;
} {
  const normalized = permissionNames.map((p) => p.toLowerCase());

  const hasBasic = normalized.includes("instagram_business_basic");
  const hasInsights = normalized.includes("instagram_business_manage_insights");

  const scopes: BrandIntegrationScope[] = [];
  if (hasBasic) {
    scopes.push(BrandIntegrationScope.BASIC_PROFILE);
  }
  if (hasInsights) {
    scopes.push(BrandIntegrationScope.ENGAGEMENT_INSIGHTS);
  }

  const status = scopes.includes(BrandIntegrationScope.ENGAGEMENT_INSIGHTS)
    ? BrandIntegrationStatus.CONNECTED
    : BrandIntegrationStatus.PARTIALLY_CONNECTED;

  return { scopes, status };
}
