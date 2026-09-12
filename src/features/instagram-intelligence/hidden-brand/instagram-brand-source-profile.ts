import type { IntelligenceProcessorExecution } from "@prisma/client";

export const INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION = "1.1" as const;
export const INSTAGRAM_BRAND_SOURCE_SCOPE = "INSTAGRAM_OWNED" as const;
export const INSTAGRAM_BRAND_SOURCE_INSTRUCTION = `
Source profile: INSTAGRAM_OWNED 1.1. Use only the admitted Instagram Evidence in
the approved context. Do not make website, canonical-current, candidate,
serviceability, commercial, Campaign, Collaboration, Creator-identity or
Offering-truth assumptions. Context-specific or uninspected material is not a
negative observation. Emit null/empty contract values whenever repeated,
representative Evidence is insufficient, and preserve exact evidence_refs for
every non-null field.`.trim();

export type InstagramBrandSourceIdentity = Readonly<{
  sourceProfileVersion: typeof INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION;
  sourceScope: typeof INSTAGRAM_BRAND_SOURCE_SCOPE;
  providerAccountId: string;
  authorizationGeneration: number;
  windowStart: string;
  windowEnd: string;
}>;

export function sourceIdentityFromManifest(
  execution: Pick<IntelligenceProcessorExecution, "evidenceManifest">,
): InstagramBrandSourceIdentity | null {
  const manifest = execution.evidenceManifest;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
    return null;
  const profile = (manifest as Record<string, unknown>).sourceProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    return null;
  const value = profile as Record<string, unknown>;
  if (
    value.sourceProfileVersion !== INSTAGRAM_BRAND_SOURCE_PROFILE_VERSION ||
    value.sourceScope !== INSTAGRAM_BRAND_SOURCE_SCOPE ||
    typeof value.providerAccountId !== "string" ||
    !Number.isInteger(value.authorizationGeneration) ||
    typeof value.windowStart !== "string" ||
    typeof value.windowEnd !== "string"
  )
    throw new Error("INSTAGRAM_SOURCE_PROFILE_INVALID");
  return value as InstagramBrandSourceIdentity;
}
