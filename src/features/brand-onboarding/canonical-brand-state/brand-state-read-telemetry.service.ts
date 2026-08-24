import { Injectable, Logger } from "@nestjs/common";

import type {
  BrandStateAuthority,
  BrandStateLifecycleMode,
  BrandStateProvenanceStatus,
  BrandStateSemantic,
  BrandStateSource,
  CurrencyResolutionStatus,
} from "./brand-state-read.types";

export type BrandStateReadTelemetryEvent = {
  event: "brand_state.read";
  semantic: BrandStateSemantic;
  lifecycle_mode: BrandStateLifecycleMode;
  selected_source: BrandStateSource;
  authority: BrandStateAuthority;
  fallback_used: boolean;
  conflict_detected: boolean;
  candidate_present: boolean;
  legacy_fallback_used: boolean;
  provenance_status?: BrandStateProvenanceStatus;
  resolution_status?: CurrencyResolutionStatus;
  correlation_id?: string;
};

export interface BrandStateReadTelemetryPort {
  record(event: BrandStateReadTelemetryEvent): void;
}

@Injectable()
export class BrandStateReadTelemetryService implements BrandStateReadTelemetryPort {
  private readonly logger = new Logger(BrandStateReadTelemetryService.name);

  record(event: BrandStateReadTelemetryEvent): void {
    this.logger.log(
      JSON.stringify({ ...event, occurred_at: new Date().toISOString() }),
    );
  }
}
