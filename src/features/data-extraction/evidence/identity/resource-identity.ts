import type { BrandId, ResourceRef } from "../domain/evidence-identities";
import type { EvidenceSourceClass } from "../domain/evidence-vocabulary";

export interface OwnedWebsiteResourceIdentity {
  readonly brandId: BrandId;
  readonly sourceClass: "OWNED_WEBSITE";
  readonly resourceRef?: ResourceRef;
  readonly canonicalResourceKey: string;
  readonly canonicalUrl: string;
  readonly aliases: readonly string[];
}

export interface ResolveOwnedWebsiteResourceRequest {
  readonly brandId: BrandId;
  readonly sourceClass: Extract<EvidenceSourceClass, "OWNED_WEBSITE">;
  readonly url: string;
  readonly aliases?: readonly string[];
}

export interface ResourceIdentityResolver {
  resolveOwnedWebsiteResource(
    request: ResolveOwnedWebsiteResourceRequest,
  ): OwnedWebsiteResourceIdentity;
}

/**
 * Minimal deterministic normalization allowed in DE-W1.0A.
 * It removes fragments/default ports and normalizes scheme/host casing only.
 * Tracking/query semantics remain a later resource-identity implementation concern.
 */
export function normalizeOwnedWebsiteUrl(value: string): string {
  const url = new URL(value);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  return url.toString();
}
