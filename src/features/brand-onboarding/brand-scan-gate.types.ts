import type { IndustryVertical } from "@prisma/client";

export type BrandScanGateOrgClaimed = {
  kind: "org_claimed";
  message: string;
  domain: string;
  adminEmail: string;
};

export type BrandScanGateBrandActive = {
  kind: "brand_active";
  message: string;
  domain: string;
};

export type BrandScanGateVerificationRequired = {
  kind: "verification_required";
  message: string;
  domain: string;
  brandProfileId: string;
  reason: "DOMAIN_LIMIT" | "IP_LIMIT";
};

export type BrandScanGateResume = {
  kind: "resume";
  leadId: string;
  normalizedUrl: string;
  industry: IndustryVertical;
  brandProfileId: string;
  domain: string;
};

export type BrandScanGateAllow = {
  kind: "allow";
  domain: string;
  hostname: string;
  normalizedUrl: string;
};

export type BrandScanGateResult =
  | BrandScanGateOrgClaimed
  | BrandScanGateBrandActive
  | BrandScanGateVerificationRequired
  | BrandScanGateResume
  | BrandScanGateAllow;
