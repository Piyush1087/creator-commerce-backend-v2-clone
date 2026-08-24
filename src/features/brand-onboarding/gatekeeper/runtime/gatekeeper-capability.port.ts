import type { ZodType, ZodTypeDef } from "zod";

import type {
  ProviderEvidenceResult,
  ProviderTelemetry,
} from "../../../data-extraction/contracts/provider-execution.contract";
import type { CompanyPublicWebResearchPayload } from "../../../data-extraction/providers/parallel-company-research.provider";

export const GATEKEEPER_CAPABILITY_PORT = Symbol("GATEKEEPER_CAPABILITY_PORT");

export interface GatekeeperCapabilityPort {
  primary<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    ownedUrl: string;
    instruction: string;
    outputSchema: ZodType<T, ZodTypeDef, T>;
  }): Promise<ProviderEvidenceResult<T>>;
  publicWebResearch(args: {
    acquisitionRunId: string;
    objective: string;
    searchQueries: string[];
  }): Promise<ProviderEvidenceResult<CompanyPublicWebResearchPayload>>;
  openAi<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    instruction: string;
    approvedEvidenceContext: unknown;
    evidenceRefs: string[];
    outputSchema: ZodType<T, ZodTypeDef, T>;
  }): Promise<ProviderEvidenceResult<T>>;
}

export type GatekeeperProviderTrace = {
  capabilityId: string;
  provider: ProviderTelemetry["provider"];
  modelId?: string;
  telemetry: ProviderTelemetry;
};
