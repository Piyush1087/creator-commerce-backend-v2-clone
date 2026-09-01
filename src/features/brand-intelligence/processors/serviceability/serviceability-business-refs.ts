import type { Prisma } from "@prisma/client";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import type {
  BusinessStateReference,
  CanonicalBrandStateSnapshot,
} from "../../input/canonical-state/canonical-brand-state.port";
import { serviceabilityInvalid } from "./serviceability-identity";

export function serviceabilityBusinessRef(
  semantic: string,
  reference: BusinessStateReference,
) {
  const { observedAt: _observedAt, ...stable } = reference;
  return sha256CanonicalExecution({ semantic, reference: stable });
}
export function serviceabilityBusinessEntries(
  snapshot: CanonicalBrandStateSnapshot,
) {
  return [
    ...snapshot.entries,
    ...(snapshot.serviceabilityState?.locations ?? []).map((item) => ({
      semantic: `location:${item.locationId}`,
      businessStateReference: item.businessStateReference,
    })),
    ...(snapshot.serviceabilityState?.offeringIdentities ?? []).map((item) => ({
      semantic: `offering:${item.offeringId}:identity`,
      businessStateReference: item.businessStateReference,
    })),
    ...(snapshot.serviceabilityState?.offeringAvailabilityReferences ?? []).map(
      (businessStateReference) => ({
        semantic: `offering:${businessStateReference.entityId}:availability`,
        businessStateReference,
      }),
    ),
    ...(snapshot.serviceabilityState?.offeringLocationReferences ?? []).map(
      (businessStateReference) => ({
        semantic: `offering:${businessStateReference.entityId}:locations`,
        businessStateReference,
      }),
    ),
  ];
}
export function validateServiceabilityCanonicalBoundary(
  snapshot: CanonicalBrandStateSnapshot,
  brandId: string,
) {
  const state = snapshot.serviceabilityState;
  if (
    !state ||
    snapshot.brandId !== brandId ||
    state.brandId !== brandId ||
    new Set(state.locations.map((item) => item.locationId)).size !==
      state.locations.length ||
    new Set(state.offeringIdentities.map((item) => item.offeringId)).size !==
      state.offeringIdentities.length ||
    state.locations.some(
      (item) =>
        item.brandId !== brandId ||
        item.businessStateReference.entityType !== "Location" ||
        item.businessStateReference.entityId !== item.locationId,
    ) ||
    state.offeringIdentities.some(
      (item) =>
        item.brandId !== brandId ||
        item.businessStateReference.entityType !== "Offering" ||
        item.businessStateReference.entityId !== item.offeringId ||
        item.businessStateReference.semanticFieldPath !== "$.identity",
    )
  )
    serviceabilityInvalid("SERVICEABILITY_CANONICAL_REFERENCE_INTEGRITY");
  // Clarified MVP: these application-owned semantics do not exist yet.
  if (
    state.offeringAvailabilityReferences.length ||
    state.offeringLocationReferences.length
  )
    serviceabilityInvalid("SERVICEABILITY_UNAUTHORIZED_AVAILABILITY_STATE");
}

export async function lockServiceabilityCanonicalBasis(
  tx: Prisma.TransactionClient,
  snapshot: CanonicalBrandStateSnapshot,
) {
  validateServiceabilityCanonicalBoundary(snapshot, snapshot.brandId);
  await tx.$queryRaw`SELECT id FROM brand_profiles WHERE id = ${snapshot.brandId} FOR SHARE`;
  const [locations, offerings] = await Promise.all([
    tx.location.findMany({
      where: { brandProfileId: snapshot.brandId, lifecycle: "ACTIVE" },
      select: { id: true, authority: true, revision: true },
      orderBy: { id: "asc" },
    }),
    tx.offering.findMany({
      where: { brandProfileId: snapshot.brandId, isActive: true },
      select: { id: true, name: true, type: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const before = snapshot.serviceabilityState!;
  const locationRefs = new Map(
    locations.map((item) => [item.id, sha256CanonicalExecution(item)]),
  );
  const offeringRefs = new Map(
    offerings.map((item) => [
      item.id,
      sha256CanonicalExecution({
        id: item.id,
        name: item.name,
        type: item.type,
        updatedAt: item.updatedAt.toISOString(),
      }),
    ]),
  );
  const changed =
    locationRefs.size !== before.locations.length ||
    offeringRefs.size !== before.offeringIdentities.length ||
    before.locations.some(
      (item) =>
        locationRefs.get(item.locationId) !==
        item.businessStateReference.revisionToken,
    ) ||
    before.offeringIdentities.some(
      (item) =>
        offeringRefs.get(item.offeringId) !==
        item.businessStateReference.revisionToken,
    );
  if (changed)
    throw new ProcessorExecutorFailure({
      category: "RETRYABLE_TECHNICAL",
      code: "SERVICEABILITY_CANONICAL_BASIS_CHANGED",
    });
}
