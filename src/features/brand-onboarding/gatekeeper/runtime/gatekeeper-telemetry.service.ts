import { Injectable, Logger } from "@nestjs/common";

export type GatekeeperTelemetryEvent = {
  event: "gatekeeper.execution" | "gatekeeper.processor_execution";
  executionId: string;
  processorId?: "gatekeeper_site_assessment";
  capabilityId?: string;
  provider?: string;
  modelId?: string;
  promptBuildId?: string;
  evidenceRefs?: string[];
  validationStage?: "STRUCTURAL" | "SEMANTIC";
  providerLatencyMs?: number;
  usage?: unknown;
  fallbackStage?: string;
  terminalState?: string;
  errorCode?: string;
  providerStatusCode?: number;
  providerMessage?: string;
  credentialEnv?: string;
  credentialFingerprint?: string;
  occurredAt: string;
};

export interface GatekeeperTelemetryPort {
  record(event: Omit<GatekeeperTelemetryEvent, "occurredAt">): void;
}

@Injectable()
export class GatekeeperTelemetryService implements GatekeeperTelemetryPort {
  private readonly logger = new Logger(GatekeeperTelemetryService.name);

  record(event: Omit<GatekeeperTelemetryEvent, "occurredAt">): void {
    const record = { ...event, occurredAt: new Date().toISOString() };
    this.logger.log(JSON.stringify(record));
  }
}
