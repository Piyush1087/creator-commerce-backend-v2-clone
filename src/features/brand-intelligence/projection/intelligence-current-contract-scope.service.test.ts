import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "../contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "../contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../contracts/validation/semantic.validator";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import { IntelligenceCurrentContractScopeService } from "./intelligence-current-contract-scope.service";

describe("W1.0F verified current contract scope", () => {
  function service() {
    const codec = new ComponentPathCodec();
    const runtime = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    runtime.verifyAtRoot(
      join(
        process.cwd(),
        "src",
        "features",
        "brand-intelligence",
        "generated",
        "contract-bundles",
      ),
    );
    return new IntelligenceCurrentContractScopeService(
      runtime,
      new BundlePathOwnershipRegistry(runtime, codec),
      codec,
    );
  }

  it("resolves one exact registered Object owner and treats only root as the materialization anchor", () => {
    const scope = service().resolveObject("communication_profile");
    expect(scope).toMatchObject({
      objectSemanticId: "communication_profile",
      outputContractId: "brand_communication_output_contract",
      outputContractVersion: "1.0",
      requiredMaterializedPaths: ["$"],
    });
    expect(scope.ownedPathPatterns).toContain("$/f/primary_language");
  });

  it("matches semantic item IDs through the verified registry and rejects unknown Objects", () => {
    const current = service();
    expect(
      current.ownsPath(
        "brand",
        "communication_profile",
        "$/f/tone_traits/i/direct",
      ),
    ).toBe(true);
    expect(
      current.ownsPath("brand", "communication_profile", "$/f/unowned"),
    ).toBe(false);
    expect(() => current.resolveObject("unknown_object")).toThrowError(
      expect.objectContaining({ code: "CONTRACT_CONFIGURATION_DRIFT" }),
    );
  });
});
