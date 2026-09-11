import { createHash } from "node:crypto";

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

export type InstagramResourceIdentity = Readonly<{
  sourceClass: "INSTAGRAM_OWNED";
  resourceType: "INSTAGRAM_ACCOUNT" | "INSTAGRAM_MEDIA";
  providerAccountId: string;
  resourceRef: ResourceRef;
  canonicalResourceKey: string;
  canonicalUrl: string;
}>;

export function instagramAccountResourceKey(providerAccountId: string): string {
  return `instagram:${requiredIdentityPart(providerAccountId)}:account`;
}

export function instagramMediaResourceKey(
  providerAccountId: string,
  mediaId: string,
): string {
  return `instagram:${requiredIdentityPart(providerAccountId)}:media:${requiredIdentityPart(mediaId)}`;
}

export function resolveInstagramResourceIdentity(
  input: Readonly<{
    providerAccountId: string;
    resourceType: "INSTAGRAM_ACCOUNT" | "INSTAGRAM_MEDIA";
    mediaId?: string;
  }>,
): InstagramResourceIdentity {
  if (input.resourceType === "INSTAGRAM_MEDIA" && !input.mediaId) {
    throw new Error("INSTAGRAM_MEDIA_ID_REQUIRED");
  }
  if (input.resourceType === "INSTAGRAM_ACCOUNT" && input.mediaId) {
    throw new Error("INSTAGRAM_ACCOUNT_MUST_NOT_HAVE_MEDIA_ID");
  }
  const canonicalResourceKey =
    input.resourceType === "INSTAGRAM_ACCOUNT"
      ? instagramAccountResourceKey(input.providerAccountId)
      : instagramMediaResourceKey(input.providerAccountId, input.mediaId!);
  const digest = createHash("sha256")
    .update(canonicalResourceKey)
    .digest("hex");
  return {
    sourceClass: "INSTAGRAM_OWNED",
    resourceType: input.resourceType,
    providerAccountId: requiredIdentityPart(input.providerAccountId),
    resourceRef: `resource:instagram:${digest}` as ResourceRef,
    canonicalResourceKey,
    canonicalUrl: canonicalResourceKey,
  };
}

function requiredIdentityPart(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes(":")) {
    throw new Error("INVALID_INSTAGRAM_RESOURCE_IDENTITY_PART");
  }
  return normalized;
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
