import type {
  IntelligenceExecution,
  IntelligenceProcessorAttempt,
  IntelligenceProcessorExecution,
  IntelligenceReadiness,
  Prisma,
} from "@prisma/client";

import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { ContractRegistryKey } from "../../contracts/bundle/contract-bundle.types";

export const SYNTHETIC_PROCESSOR_ID = "synthetic_test_processor";
export const SYNTHETIC_PROCESSOR_VERSION = "1.0";
export const SYNTHETIC_OUTPUT_CONTRACT_ID = "synthetic_test_output_contract";
export const SYNTHETIC_OUTPUT_CONTRACT_VERSION = "1.0";
export const SYNTHETIC_BUNDLE_ID = "brand_intelligence.synthetic_test";
export const SYNTHETIC_BUNDLE_VERSION = "1.0";

export type SyntheticProcessorScenario =
  | "SUCCEED_READY"
  | "SUCCEED_PARTIAL"
  | "SUCCEED_NOT_READY"
  | "FAIL_RETRYABLE"
  | "FAIL_TERMINAL"
  | "WAIT_DEPENDENCY"
  | "HANG_UNTIL_LEASE_EXPIRES"
  | "INTERNAL_RETRY_THEN_SUCCESS";

export type ProcessorFailureCategory =
  | "RETRYABLE_TECHNICAL"
  | "VALIDATION_FAILURE"
  | "DEPENDENCY_UNAVAILABLE"
  | "CONFIGURATION_DRIFT"
  | "LEASE_LOST"
  | "CANCELLED";

export interface ProcessorExecutionRequest {
  readonly registryKey: ContractRegistryKey;
  readonly activeScope: readonly ComponentSemanticAddress[];
  readonly dependencyManifest: Prisma.InputJsonValue;
  readonly evidenceManifest: Prisma.InputJsonValue;
  readonly executionIntentKey: string;
  readonly maxAttempts: number;
  readonly dependencyEligible: boolean;
  readonly syntheticHarness?: Readonly<{
    explicit: true;
    scenario: SyntheticProcessorScenario;
  }>;
}

export interface CreateIntelligenceExecutionCommand {
  readonly brandId: string;
  readonly triggerType: string;
  readonly triggerRef: string;
  readonly triggerIdempotencyKey: string;
  readonly correlationRef: string;
  readonly requestedImpact: Prisma.InputJsonValue;
  readonly processors: readonly ProcessorExecutionRequest[];
}

export interface CreatedIntelligenceExecution {
  readonly execution: IntelligenceExecution;
  readonly processorExecutions: readonly IntelligenceProcessorExecution[];
  readonly replayed: boolean;
}

export interface ClaimedProcessorWork {
  readonly processorExecution: IntelligenceProcessorExecution;
  readonly attempt: IntelligenceProcessorAttempt;
}

export interface LeaseIdentity {
  readonly processorExecutionId: string;
  readonly attemptId: string;
  readonly workerIdentity: string;
  readonly leaseToken: string;
}

export interface ProcessorExecutionResult {
  readonly readiness: IntelligenceReadiness;
  readonly telemetry?: Readonly<Record<string, string | number | boolean>>;
  /** Transient validated material consumed by the success hook in the lease transaction. */
  readonly persistencePayload?: unknown;
}

export interface ProcessorFailure {
  readonly category: ProcessorFailureCategory;
  readonly code: string;
  readonly telemetry?: Readonly<Record<string, string | number | boolean>>;
}

export interface DependencyResumeCommand {
  readonly processorExecutionId: string;
  readonly expectedAttemptCount: number;
}

export interface CancellationResult {
  readonly executionId: string;
  readonly cancelledProcessorExecutionIds: readonly string[];
}
