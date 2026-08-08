import { Module } from "@nestjs/common";

import { BrandIntelligenceController } from "./brand-intelligence.controller";
import { BrandIntelligenceService } from "./brand-intelligence.service";
import { IdentityEvidenceRuntime } from "./runtime/evidence/identity-evidence.runtime";
import { NoopPersistenceAdapter } from "./runtime/persistence/noop-persistence.adapter";
import { GeminiIntelligenceProvider } from "./runtime/providers/gemini/gemini-intelligence.provider";
import { NoopTelemetryAdapter } from "./runtime/telemetry/noop-telemetry.adapter";

@Module({
  controllers: [BrandIntelligenceController],
  providers: [
    BrandIntelligenceService,
    IdentityEvidenceRuntime,
    GeminiIntelligenceProvider,
    NoopPersistenceAdapter,
    NoopTelemetryAdapter,
  ],
  exports: [BrandIntelligenceService],
})
export class BrandIntelligenceModule {}
