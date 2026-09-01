import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import type {
  CanonicalBrandStateSnapshot,
  CanonicalServiceabilitySnapshot,
} from "./canonical-brand-state.port";

interface LocationRow {
  readonly id: string;
  readonly brandProfileId: string;
  readonly name: string | null;
  readonly city: string | null;
  readonly authority: string;
  readonly revision: number;
}
interface OfferingRow {
  readonly id: string;
  readonly brandProfileId: string;
  readonly name: string;
  readonly type: string;
  readonly updatedAt: Date;
}

/** References application identity only; never synthesizes Offering availability. */
export function assembleCanonicalServiceabilitySnapshot(
  snapshot: CanonicalBrandStateSnapshot,
  locations: readonly LocationRow[],
  offerings: readonly OfferingRow[],
): CanonicalBrandStateSnapshot {
  if (
    locations.some((row) => row.brandProfileId !== snapshot.brandId) ||
    offerings.some((row) => row.brandProfileId !== snapshot.brandId)
  )
    throw new Error("SERVICEABILITY_CANONICAL_CROSS_BRAND_INPUT");
  const identity = {
    brandSnapshot: snapshot.canonicalSnapshotRef,
    locations: locations.map((row) => ({
      id: row.id,
      authority: row.authority,
      revision: row.revision,
    })),
    offerings: offerings.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    })),
    offeringAvailabilityReferences: [],
    offeringLocationReferences: [],
  };
  const canonicalSnapshotRef = `canonical-snapshot:sha256:${sha256CanonicalExecution(identity)}`;
  const state: CanonicalServiceabilitySnapshot = {
    brandId: snapshot.brandId,
    locations: locations.map((row) => ({
      brandId: row.brandProfileId,
      locationId: row.id,
      name: row.name,
      city: row.city,
      authority: row.authority,
      businessStateReference: {
        entityType: "Location",
        entityId: row.id,
        semanticFieldPath: "$",
        revisionKind: "SNAPSHOT_FINGERPRINT",
        revisionToken: sha256CanonicalExecution({
          id: row.id,
          authority: row.authority,
          revision: row.revision,
        }),
        observedAt: snapshot.observedAt,
        canonicalSnapshotRef,
      },
    })),
    offeringIdentities: offerings.map((row) => ({
      brandId: row.brandProfileId,
      offeringId: row.id,
      name: row.name,
      type: row.type,
      businessStateReference: {
        entityType: "Offering",
        entityId: row.id,
        semanticFieldPath: "$.identity",
        revisionKind: "UPDATED_AT",
        revisionToken: sha256CanonicalExecution({
          id: row.id,
          name: row.name,
          type: row.type,
          updatedAt: row.updatedAt.toISOString(),
        }),
        observedAt: snapshot.observedAt,
        canonicalSnapshotRef,
      },
    })),
    offeringAvailabilityReferences: [],
    offeringLocationReferences: [],
  };
  return { ...snapshot, canonicalSnapshotRef, serviceabilityState: state };
}
