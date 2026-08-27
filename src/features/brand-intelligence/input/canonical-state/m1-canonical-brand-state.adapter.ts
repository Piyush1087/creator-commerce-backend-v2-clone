import { Injectable, Optional } from "@nestjs/common";
import { BrandVisualStateService } from "../../../brand-canonical-state/brand-visual-state.service";
import { assembleCanonicalVisualSnapshot } from "./canonical-visual-snapshot";
import { assembleCanonicalServiceabilitySnapshot } from "./canonical-serviceability-snapshot";
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly visuals?: BrandVisualStateService,
  ) {}

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
        if (request.exactOfferingScope) {
          return this.readExactOffering(
            transaction,
            snapshot,
            request.exactOfferingScope.canonicalOfferingRef,
          );
        }
        if (request.includeServiceabilityState) {
          const [locations, offerings] = await Promise.all([
            transaction.location.findMany({
              where: { brandProfileId: request.brandId, lifecycle: "ACTIVE" },
              select: {
                id: true,
                brandProfileId: true,
                name: true,
                city: true,
                authority: true,
                revision: true,
              },
              orderBy: { id: "asc" },
            }),
            transaction.offering.findMany({
              where: { brandProfileId: request.brandId, isActive: true },
              select: {
                id: true,
                brandProfileId: true,
                name: true,
                type: true,
                updatedAt: true,
              },
              orderBy: { id: "asc" },
            }),
          ]);
          return assembleCanonicalServiceabilitySnapshot(
            snapshot,
            locations,
            offerings,
          );
        }
        if (request.includeVisualState) {
          if (!this.visuals)
            throw new InputDependencyError(
              "CONFIGURATION_DRIFT",
              "Canonical visual reader is unavailable",
            );
          const visualState = await this.visuals.read(
            request.brandId,
            transaction,
          );
          return assembleCanonicalVisualSnapshot(snapshot, visualState);
        }
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

  private async readExactOffering(
    transaction: Prisma.TransactionClient,
    snapshot: CanonicalBrandStateSnapshot,
    offeringId: string,
  ): Promise<CanonicalBrandStateSnapshot> {
    if (!offeringId.trim()) {
      throw new InputDependencyError(
        "CANONICAL_INPUT_UNAVAILABLE",
        "Exact Offering scope requires a canonical Offering reference",
      );
    }
    const offering = await transaction.offering.findUnique({
      where: {
        brandProfileId_id: { brandProfileId: snapshot.brandId, id: offeringId },
      },
      select: {
        id: true,
        brandProfileId: true,
        name: true,
        type: true,
        canonicalKind: true,
        canonicalSubtype: true,
        canonicalLifecycle: true,
        description: true,
        url: true,
        categoryTag: true,
        isActive: true,
        updatedAt: true,
        fieldStates: {
          where: { authority: "BRAND_CONFIRMED" },
          select: { semanticFieldPath: true, revision: true },
          orderBy: { semanticFieldPath: "asc" },
        },
        guidanceItems: {
          where: { authority: "BRAND_CONFIRMED", lifecycle: "ACTIVE" },
          select: { id: true, kind: true, text: true, revision: true },
          orderBy: { id: "asc" },
        },
        mediaState: {
          select: {
            primaryMediaAssetId: true,
            assets: {
              where: { lifecycle: "ACTIVE" },
              select: {
                id: true,
                url: true,
                authority: true,
                origin: true,
                revision: true,
              },
              orderBy: { id: "asc" },
            },
          },
        },
        bundleMemberships: {
          where: { lifecycle: "ACTIVE" },
          select: {
            id: true,
            bundleOfferingId: true,
            productOfferingId: true,
            revision: true,
          },
          orderBy: { id: "asc" },
        },
        productBundleMemberships: {
          where: { lifecycle: "ACTIVE" },
          select: {
            id: true,
            bundleOfferingId: true,
            productOfferingId: true,
            revision: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!offering) {
      throw new InputDependencyError(
        "CANONICAL_STATE_NOT_FOUND",
        "Exact canonical Offering was not found within the requested Brand",
        { brandId: snapshot.brandId, offeringId },
      );
    }
    const allowedValues: Readonly<Record<string, unknown>> = {
      name: offering.name,
      description: offering.description,
      url: offering.url,
      canonicalKind: offering.canonicalKind,
      canonicalSubtype: offering.canonicalSubtype,
      canonicalLifecycle: offering.canonicalLifecycle,
    };
    const brandConfirmedValues = [
      ...offering.fieldStates.flatMap((state) =>
        Object.prototype.hasOwnProperty.call(
          allowedValues,
          state.semanticFieldPath,
        )
          ? [
              {
                semanticFieldPath: state.semanticFieldPath,
                value: allowedValues[state.semanticFieldPath],
                revision: state.revision,
              },
            ]
          : [],
      ),
      ...offering.guidanceItems.map((item) => ({
        semanticFieldPath: `guidance/${item.kind}/${item.id}`,
        value: item.text,
        revision: item.revision,
      })),
    ];
    const bundleRelationships = [
      ...offering.bundleMemberships,
      ...offering.productBundleMemberships,
    ].map(({ id, ...relation }) => ({ relationId: id, ...relation }));
    const mediaRefs = offering.mediaState?.assets ?? [];
    const stable = {
      id: offering.id,
      brandProfileId: offering.brandProfileId,
      name: offering.name,
      type: offering.type,
      canonicalKind: offering.canonicalKind,
      canonicalSubtype: offering.canonicalSubtype,
      canonicalLifecycle: offering.canonicalLifecycle,
      description: offering.description,
      customerDestination: offering.url,
      categoryTag: offering.categoryTag,
      isActive: offering.isActive,
      primaryMediaAssetId: offering.mediaState?.primaryMediaAssetId ?? null,
      mediaRefs,
      bundleRelationships,
      brandConfirmedValues,
      updatedAt: offering.updatedAt.toISOString(),
    };
    const revisionToken = sha256CanonicalExecution(stable);
    const canonicalSnapshotRef = `canonical-snapshot:sha256:${revisionToken}`;
    return {
      ...snapshot,
      canonicalSnapshotRef,
      offeringFacts: [
        {
          offeringId: offering.id,
          brandId: offering.brandProfileId,
          name: offering.name,
          type: String(offering.type),
          url: offering.url,
          categoryTag: offering.categoryTag,
          isActive: offering.isActive,
          canonicalKind: offering.canonicalKind,
          canonicalSubtype: offering.canonicalSubtype,
          canonicalLifecycle: offering.canonicalLifecycle,
          description: offering.description,
          customerDestination: offering.url,
          mediaRefs,
          bundleRelationships,
          brandConfirmedValues,
          businessStateReference: {
            entityType: "Offering",
            entityId: offering.id,
            semanticFieldPath: "$",
            revisionKind: "SNAPSHOT_FINGERPRINT",
            revisionToken,
            observedAt: snapshot.observedAt,
            canonicalSnapshotRef,
          },
        },
      ],
    };
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
  if (result.some((semantic) => !allowed.has(semantic))) {
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
