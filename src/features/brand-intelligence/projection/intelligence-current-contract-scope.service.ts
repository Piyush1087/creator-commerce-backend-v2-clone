import { Injectable } from "@nestjs/common";

import { BundlePathOwnershipRegistry } from "../contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../contracts/registry/contract-runtime.registry";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import { IntelligenceCurrentProjectionError } from "./intelligence-current-projection.error";

export interface IntelligenceProjectionContractScope {
  readonly objectSemanticId: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
  readonly ownedPathPatterns: readonly string[];
  readonly requiredMaterializedPaths: readonly string[];
}

@Injectable()
export class IntelligenceCurrentContractScopeService {
  constructor(
    private readonly runtime: ContractRuntimeRegistry,
    private readonly ownership: BundlePathOwnershipRegistry,
    private readonly codec: ComponentPathCodec,
  ) {}

  resolveObject(objectSemanticId: string): IntelligenceProjectionContractScope {
    if (!this.runtime.isReady()) {
      throw new IntelligenceCurrentProjectionError(
        "CONTRACT_CONFIGURATION_DRIFT",
        "The verified Intelligence contract registry is not ready",
      );
    }
    const registrations = this.runtime
      .registrations()
      .filter((registration) =>
        registration.ownedObjectSemanticIds.includes(objectSemanticId),
      );
    if (registrations.length !== 1) {
      throw new IntelligenceCurrentProjectionError(
        "CONTRACT_CONFIGURATION_DRIFT",
        "The semantic Object does not have one exact verified owner",
        { objectSemanticId, ownerCount: registrations.length },
      );
    }
    const registration = registrations[0];
    const ownedPathPatterns = registration.ownedPathPatterns
      .filter((pattern) => pattern.objectSemanticId === objectSemanticId)
      .map((pattern) => pattern.componentPathPattern)
      .sort();
    if (!ownedPathPatterns.length) {
      throw new IntelligenceCurrentProjectionError(
        "CONTRACT_CONFIGURATION_DRIFT",
        "The semantic Object has no verified owned paths",
        { objectSemanticId },
      );
    }
    try {
      for (const path of ownedPathPatterns) {
        this.codec.assertCanonical(
          path.replaceAll("{semantic_id}", "contract-semantic-item"),
        );
      }
    } catch {
      throw new IntelligenceCurrentProjectionError(
        "CONTRACT_CONFIGURATION_DRIFT",
        "The verified registry contains a non-canonical owned path",
        { objectSemanticId },
      );
    }
    return {
      objectSemanticId,
      outputContractId: registration.outputContractId,
      outputContractVersion: registration.outputContractVersion,
      ownedPathPatterns,
      // The root is the stable materialization anchor. Other exact owned paths
      // may be optional contract fields; ownership alone does not make them
      // required in every active evaluation scope.
      requiredMaterializedPaths: ownedPathPatterns.includes("$") ? ["$"] : [],
    };
  }

  ownsPath(
    brandId: string,
    objectSemanticId: string,
    componentSemanticPath: string,
  ): boolean {
    try {
      this.codec.assertCanonical(componentSemanticPath);
      return this.ownership.owns({
        brandId,
        objectSemanticId,
        pathSchemeVersion: 1,
        componentSemanticPath,
      });
    } catch {
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "The requested component path is not canonical",
        { componentSemanticPath },
      );
    }
  }
}
