import { Injectable } from "@nestjs/common";

import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import type {
  BusinessStateReference,
  CanonicalBrandStateSnapshot,
} from "./canonical-brand-state.port";

export interface CanonicalDependencyManifestEntry {
  readonly semantic: string;
  readonly source: string;
  readonly authority: string;
  readonly fallbackUsed: boolean;
  readonly conflictDetected: boolean;
  readonly provenanceStatus?: string;
  readonly resolutionStatus?: string;
  readonly businessStateReference: Omit<BusinessStateReference, "observedAt">;
}

export interface CanonicalDependencyManifest {
  readonly schemaVersion: "1.0";
  readonly brandId: string;
  readonly canonicalSnapshotRef: string;
  readonly entries: readonly CanonicalDependencyManifestEntry[];
}

@Injectable()
export class CanonicalStateManifestBuilder {
  build(snapshot: CanonicalBrandStateSnapshot): Readonly<{
    manifest: CanonicalDependencyManifest;
    hash: string;
  }> {
    const entries = snapshot.entries
      .map((entry) => {
        const { observedAt: _observedAt, ...businessStateReference } =
          entry.businessStateReference;
        return {
          semantic: entry.semantic,
          source: entry.source,
          authority: entry.authority,
          fallbackUsed: entry.fallbackUsed,
          conflictDetected: entry.conflictDetected,
          ...(entry.provenanceStatus
            ? { provenanceStatus: entry.provenanceStatus }
            : {}),
          ...(entry.resolutionStatus
            ? { resolutionStatus: entry.resolutionStatus }
            : {}),
          businessStateReference,
        };
      })
      .sort((left, right) => left.semantic.localeCompare(right.semantic));
    const manifest: CanonicalDependencyManifest = {
      schemaVersion: "1.0",
      brandId: snapshot.brandId,
      canonicalSnapshotRef: snapshot.canonicalSnapshotRef,
      entries,
    };
    return { manifest, hash: sha256CanonicalExecution(manifest) };
  }
}
