import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import { PrismaService } from "../../../../prisma/prisma.service";
import { InputDependencyError } from "../domain/input-dependency.error";
import {
  CANONICAL_BRAND_STATE_SEMANTICS,
  type CanonicalBrandStateAuthority,
  type CanonicalBrandStateEntry,
  type CanonicalBrandStateProvenance,
  type CanonicalBrandStateReadRequest,
  type CanonicalBrandStateReader,
  type CanonicalBrandStateResolution,
  type CanonicalBrandStateSemantic,
  type CanonicalBrandStateSnapshot,
} from "./canonical-brand-state.port";

const PROFILE_SELECT = {
  id: true,
  domain: true,
  name: true,
  logoUrl: true,
  industry: true,
  subIndustry: true,
  countryCode: true,
  currencyCode: true,
  igHandle: true,
  ytHandle: true,
  tiktokHandle: true,
  updatedAt: true,
} as const;

type ProfileState = Prisma.BrandProfileGetPayload<{
  select: typeof PROFILE_SELECT;
}>;

interface EntrySeed {
  readonly semantic: CanonicalBrandStateSemantic;
  readonly fieldPath: string;
  readonly value: string | null;
  readonly authority: CanonicalBrandStateAuthority;
  readonly fallbackUsed?: boolean;
  readonly conflictDetected?: boolean;
  readonly candidateValue?: string | null;
  readonly provenanceStatus?: CanonicalBrandStateProvenance;
  readonly resolutionStatus?: CanonicalBrandStateResolution;
}

@Injectable()
export class M1CanonicalBrandStateAdapter implements CanonicalBrandStateReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    request: CanonicalBrandStateReadRequest,
  ): Promise<CanonicalBrandStateSnapshot> {
    const required = normalizeRequiredSemantics(request.requiredSemantics);
    return this.prisma.$transaction(
      async (transaction) => {
        const profile = await transaction.brandProfile.findUnique({
          where: { id: request.brandId },
          select: PROFILE_SELECT,
        });
        if (!profile) {
          throw new InputDependencyError(
            "CANONICAL_STATE_NOT_FOUND",
            "Canonical Brand state was not found for the supplied Brand ID",
            { brandId: request.brandId },
          );
        }
        const snapshot = assembleCanonicalBrandStateSnapshot(
          profile.id,
          profile.updatedAt,
          seedsFromProfile(profile).filter((entry) =>
            required.includes(entry.semantic),
          ),
        );
        if (!request.includeOfferingFacts) return snapshot;
        // Explicitly requested by the differentiation profile only. No scan JSON,
        // prices, selling points, claims, or inferred Offering identity.
        const offerings = await transaction.offering.findMany({
          where: { brandProfileId: request.brandId },
          select: {
            id: true,
            brandProfileId: true,
            name: true,
            type: true,
            url: true,
            categoryTag: true,
            isActive: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
        });
        const canonicalSnapshotRef = `canonical-snapshot:sha256:${sha256CanonicalExecution(
          {
            brandSnapshot: snapshot.canonicalSnapshotRef,
            offerings: offerings.map((row) => ({
              ...row,
              updatedAt: row.updatedAt.toISOString(),
            })),
          },
        )}`;
        return {
          ...snapshot,
          canonicalSnapshotRef,
          offeringFacts: offerings.map(
            ({ updatedAt, id, brandProfileId, ...facts }) => ({
              ...facts,
              offeringId: id,
              brandId: brandProfileId,
              businessStateReference: {
                entityType: "Offering" as const,
                entityId: id,
                semanticFieldPath: "$",
                revisionKind: "UPDATED_AT" as const,
                revisionToken: sha256CanonicalExecution({
                  id,
                  facts,
                  updatedAt: updatedAt.toISOString(),
                }),
                observedAt: snapshot.observedAt,
                canonicalSnapshotRef,
              },
            }),
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

export function assembleCanonicalBrandStateSnapshot(
  brandId: string,
  updatedAt: Date,
  seeds: readonly EntrySeed[],
  observedAt = new Date(),
): CanonicalBrandStateSnapshot {
  const sorted = [...seeds].sort((left, right) =>
    left.semantic.localeCompare(right.semantic),
  );
  const unique = new Set(sorted.map((entry) => entry.semantic));
  if (unique.size !== sorted.length) {
    throw new InputDependencyError(
      "DEPENDENCY_SNAPSHOT_INCOHERENT",
      "A canonical semantic appeared more than once in one snapshot",
    );
  }
  const stableEntries = sorted.map((entry) => ({
    semantic: entry.semantic,
    fieldPath: entry.fieldPath,
    value: entry.value,
    source: "BRAND_PROFILE" as const,
    authority: entry.authority,
    fallbackUsed: entry.fallbackUsed ?? false,
    conflictDetected: entry.conflictDetected ?? false,
    ...(entry.candidateValue !== undefined
      ? { candidateValue: entry.candidateValue }
      : {}),
    ...(entry.provenanceStatus
      ? { provenanceStatus: entry.provenanceStatus }
      : {}),
    ...(entry.resolutionStatus
      ? { resolutionStatus: entry.resolutionStatus }
      : {}),
  }));
  const canonicalSnapshotRef = `canonical-snapshot:sha256:${sha256CanonicalExecution(
    {
      brandId,
      lifecycleMode: "POST_PROFILE",
      entries: stableEntries,
    },
  )}`;
  const observedAtIso = observedAt.toISOString();
  const revisionBase = updatedAt.toISOString();
  const entries: CanonicalBrandStateEntry[] = stableEntries.map((entry) => ({
    semantic: entry.semantic,
    value: entry.value,
    source: entry.source,
    authority: entry.authority,
    fallbackUsed: entry.fallbackUsed,
    conflictDetected: entry.conflictDetected,
    ...(entry.candidateValue !== undefined
      ? { candidateValue: entry.candidateValue }
      : {}),
    ...(entry.provenanceStatus
      ? { provenanceStatus: entry.provenanceStatus }
      : {}),
    ...(entry.resolutionStatus
      ? { resolutionStatus: entry.resolutionStatus }
      : {}),
    businessStateReference: {
      entityType: "BrandProfile",
      entityId: brandId,
      semanticFieldPath: entry.fieldPath,
      revisionKind: "UPDATED_AT",
      revisionToken: sha256CanonicalExecution({
        updatedAt: revisionBase,
        semanticState: entry,
      }),
      observedAt: observedAtIso,
      canonicalSnapshotRef,
    },
  }));
  // Ensure this remains JSON-safe before it crosses the application port.
  canonicalJson(entries);
  return {
    brandId,
    lifecycleMode: "POST_PROFILE",
    observedAt: observedAtIso,
    canonicalSnapshotRef,
    entries,
  };
}

function normalizeRequiredSemantics(
  semantics: readonly CanonicalBrandStateSemantic[],
): readonly CanonicalBrandStateSemantic[] {
  const allowed = new Set<CanonicalBrandStateSemantic>(
    CANONICAL_BRAND_STATE_SEMANTICS,
  );
  const result = [...new Set(semantics)].sort();
  if (!result.length || result.some((semantic) => !allowed.has(semantic))) {
    throw new InputDependencyError(
      "CANONICAL_INPUT_UNAVAILABLE",
      "Canonical state request contains no usable semantic scope",
    );
  }
  return result;
}

function seedsFromProfile(profile: ProfileState): readonly EntrySeed[] {
  return [
    canonical("website_url", "$.domain", profile.domain),
    canonical("brand_name", "$.name", profile.name),
    canonical("brand_logo", "$.logoUrl", profile.logoUrl),
    canonical("industry", "$.industry", String(profile.industry)),
    {
      ...canonical(
        "sub_industry",
        "$.subIndustry",
        profile.subIndustry,
        "PROVISIONAL",
      ),
      provenanceStatus: "UNATTRIBUTED_CANONICAL_FIELD",
    },
    canonical("country", "$.countryCode", profile.countryCode),
    {
      ...canonical(
        "reporting_currency",
        "$.currencyCode",
        profile.currencyCode,
        "UNVERIFIED_PROVENANCE",
      ),
      provenanceStatus: "UNATTRIBUTED_CANONICAL_FIELD",
      resolutionStatus: "UNKNOWN_PROVENANCE",
    },
    canonical("instagram_handle", "$.igHandle", profile.igHandle),
    {
      ...canonical(
        "youtube_handle",
        "$.ytHandle",
        profile.ytHandle,
        "UNVERIFIED_PROVENANCE",
      ),
      provenanceStatus: "UNATTRIBUTED_CANONICAL_FIELD",
    },
    {
      ...canonical(
        "tiktok_handle",
        "$.tiktokHandle",
        profile.tiktokHandle,
        "UNVERIFIED_PROVENANCE",
      ),
      provenanceStatus: "UNATTRIBUTED_CANONICAL_FIELD",
    },
  ];
}

function canonical(
  semantic: CanonicalBrandStateSemantic,
  fieldPath: string,
  value: string | null,
  authority: CanonicalBrandStateAuthority = "APPLICATION_CANONICAL",
): EntrySeed {
  return {
    semantic,
    fieldPath,
    value,
    authority,
    fallbackUsed: false,
    conflictDetected: false,
  };
}
