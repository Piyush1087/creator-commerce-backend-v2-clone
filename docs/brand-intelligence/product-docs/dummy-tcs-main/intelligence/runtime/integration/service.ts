import type { IdentityRuntimeDependencies } from "./types";
import { createIdentityRuntime } from "./identity_runtime";

export type ExecuteIntelligenceRequest = {
  executionProfileId: "identity_test";
  entityType: "brand";
  entityId: string;
  websiteUrl: string;
  persistResults?: boolean;
};

export function createIntelligenceService(deps: IdentityRuntimeDependencies) {
  const identity = createIdentityRuntime(deps);
  return {
    async execute(request: ExecuteIntelligenceRequest) {
      if (request.executionProfileId !== "identity_test") throw new Error(`Unsupported execution profile: ${request.executionProfileId}`);
      if (!request.entityId) throw new Error("entityId is required");
      let websiteUrl: string;
      try { websiteUrl = new URL(request.websiteUrl).toString(); }
      catch { throw new Error("websiteUrl must be a valid URL"); }
      return identity.executeIdentityTest({
        entityType: request.entityType,
        entityId: request.entityId,
        websiteUrl,
        persistResults: request.persistResults ?? false,
      });
    },
  };
}
