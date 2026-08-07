import {
  BrandIntegrationScope,
  BrandIntegrationStatus,
} from "@prisma/client";

/**
 * Map Meta/Instagram permission names → platform scopes + connection status.
 *
 * Case 1 (PARTIAL): basic granted, insights withheld.
 * Case 2 (FULL): basic + insights granted.
 * When Meta returns no permission list, assume the requested full scope set
 * (authorize URL asks for both) so we do not false-flag Case 1 on API quirks.
 */
export function resolveInstagramScopesFromPermissions(
  permissionNames: string[],
): {
  scopes: BrandIntegrationScope[];
  status: BrandIntegrationStatus;
} {
  const normalized = permissionNames.map((p) => p.toLowerCase());

  if (normalized.length === 0) {
    return {
      scopes: [
        BrandIntegrationScope.BASIC_PROFILE,
        BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
      ],
      status: BrandIntegrationStatus.CONNECTED,
    };
  }

  const hasBasic = normalized.some(
    (p) =>
      p.includes("instagram_business_basic") ||
      p === "instagram_basic" ||
      (p.includes("basic") && !p.includes("insights")),
  );
  const hasInsights = normalized.some(
    (p) => p.includes("manage_insights") || p.includes("insights"),
  );

  const scopes: BrandIntegrationScope[] = [];
  if (hasBasic || hasInsights) {
    scopes.push(BrandIntegrationScope.BASIC_PROFILE);
  }
  if (hasInsights) {
    scopes.push(BrandIntegrationScope.ENGAGEMENT_INSIGHTS);
  }

  if (scopes.length === 0) {
    scopes.push(BrandIntegrationScope.BASIC_PROFILE);
  }

  const status = scopes.includes(BrandIntegrationScope.ENGAGEMENT_INSIGHTS)
    ? BrandIntegrationStatus.CONNECTED
    : BrandIntegrationStatus.PARTIALLY_CONNECTED;

  return { scopes, status };
}
