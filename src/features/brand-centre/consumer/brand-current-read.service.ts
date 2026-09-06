import { Inject, Injectable } from "@nestjs/common";

import {
  CANONICAL_BRAND_STATE_READER,
  CANONICAL_BRAND_STATE_SEMANTICS,
  type CanonicalBrandStateReader,
} from "../../brand-intelligence/input/canonical-state/canonical-brand-state.port";

export type BrandCurrentReadResult = Readonly<{
  brandId: string;
  observedAt: string;
  canonicalSnapshotRef: string;
  fields: readonly Readonly<{
    semantic: string;
    value: string | null;
    authority: string;
    provenanceStatus?: string;
    resolutionStatus?: string;
    fallbackUsed: boolean;
    conflictDetected: boolean;
  }>[];
}>;

@Injectable()
export class BrandCurrentReadService {
  constructor(
    @Inject(CANONICAL_BRAND_STATE_READER)
    private readonly canonical: CanonicalBrandStateReader,
  ) {}

  async read(brandId: string): Promise<BrandCurrentReadResult> {
    const snapshot = await this.canonical.read({
      brandId,
      requiredSemantics: CANONICAL_BRAND_STATE_SEMANTICS,
    });

    return {
      brandId: snapshot.brandId,
      observedAt: snapshot.observedAt,
      canonicalSnapshotRef: snapshot.canonicalSnapshotRef,
      fields: snapshot.entries.map((entry) => ({
        semantic: entry.semantic,
        value: entry.value,
        authority: entry.authority,
        ...(entry.provenanceStatus
          ? { provenanceStatus: entry.provenanceStatus }
          : {}),
        ...(entry.resolutionStatus
          ? { resolutionStatus: entry.resolutionStatus }
          : {}),
        fallbackUsed: entry.fallbackUsed,
        conflictDetected: entry.conflictDetected,
      })),
    };
  }
}
