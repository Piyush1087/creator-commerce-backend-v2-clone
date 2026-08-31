import { createHash } from "node:crypto";

import { canonicalJson } from "../../contracts/bundle/canonical-json";
import type { ContractBundleManifest } from "../../contracts/bundle/contract-bundle.types";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";

export function sha256CanonicalExecution(value: unknown): string {
  return createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

export function canonicalActiveScope(
  activeScope: readonly ComponentSemanticAddress[],
): readonly Readonly<{
  objectSemanticId: string;
  pathSchemeVersion: number;
  componentSemanticPath: string;
}>[] {
  return activeScope
    .map((address) => ({
      objectSemanticId: address.objectSemanticId,
      pathSchemeVersion: address.pathSchemeVersion,
      componentSemanticPath: address.componentSemanticPath,
    }))
    .sort((left, right) =>
      [
        left.objectSemanticId,
        left.pathSchemeVersion.toString(),
        left.componentSemanticPath,
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.objectSemanticId,
            right.pathSchemeVersion.toString(),
            right.componentSemanticPath,
          ].join("\u0000"),
        ),
    );
}

export function processorLogicalKeyV2(input: {
  readonly brandId: string;
  readonly subject: Readonly<{ id: string; type: string; ref: string }>;
  readonly manifest: Pick<
    ContractBundleManifest,
    | "processorId"
    | "processorVersion"
    | "bundleId"
    | "bundleVersion"
    | "bundleContentHash"
  >;
  readonly activeScope: readonly ComponentSemanticAddress[];
  readonly dependencyManifestHash: string;
  readonly evidenceManifestHash: string;
  readonly executionIntentKey: string;
}): string {
  return sha256CanonicalExecution({
    keyVersion: 2,
    brandId: input.brandId,
    subject: input.subject,
    processorId: input.manifest.processorId,
    processorVersion: input.manifest.processorVersion,
    bundleId: input.manifest.bundleId,
    bundleVersion: input.manifest.bundleVersion,
    bundleHash: input.manifest.bundleContentHash,
    activeScope: canonicalActiveScope(input.activeScope),
    dependencyManifestHash: input.dependencyManifestHash,
    evidenceManifestHash: input.evidenceManifestHash,
    executionIntentKey: input.executionIntentKey,
  });
}

export function processorLogicalKey(input: {
  readonly brandId: string;
  readonly manifest: Pick<
    ContractBundleManifest,
    | "processorId"
    | "processorVersion"
    | "bundleId"
    | "bundleVersion"
    | "bundleContentHash"
  >;
  readonly activeScope: readonly ComponentSemanticAddress[];
  readonly dependencyManifestHash: string;
  readonly evidenceManifestHash: string;
  readonly executionIntentKey: string;
}): string {
  return sha256CanonicalExecution({
    brandId: input.brandId,
    processorId: input.manifest.processorId,
    processorVersion: input.manifest.processorVersion,
    bundleId: input.manifest.bundleId,
    bundleVersion: input.manifest.bundleVersion,
    bundleHash: input.manifest.bundleContentHash,
    activeScope: canonicalActiveScope(input.activeScope),
    dependencyManifestHash: input.dependencyManifestHash,
    evidenceManifestHash: input.evidenceManifestHash,
    executionIntentKey: input.executionIntentKey,
  });
}
