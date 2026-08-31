import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandCanonicalStateModule } from "../brand-canonical-state/brand-canonical-state.module";
import { InstagramModule } from "../instagram/instagram.module";
import { MailModule } from "../../mail/mail.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { S3Module } from "../../shared/s3/s3.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { BrandSocialSyncController } from "./social-sync/brand-social-sync.controller";
import { BrandSocialSyncService } from "./social-sync/brand-social-sync.service";
import { BrandOnboardingPurgeScheduler } from "./brand-onboarding-purge.scheduler";
import { BrandOnboardingPurgeService } from "./brand-onboarding-purge.service";
import { BrandIntelligenceJobService } from "./brand-intelligence-job.service";
import { BrandIntelligenceWorkerService } from "./brand-intelligence-worker.service";
import { BrandScanGateService } from "./brand-scan-gate.service";
import { BrandController } from "./brand.controller";
import { BrandOnboardingController } from "./brand-onboarding.controller";
import { BrandOnboardingService } from "./brand-onboarding.service";
import { DiscoveryReachabilityService } from "./discovery-reachability.service";
import { BrandProfileService } from "./brand-profile.service";
import { BrandOfferingsService } from "./brand-offerings.service";
import { CanonicalOfferingStateService } from "../brand-centre/services/canonical-offering-state.service";
import { BrandCompetitorsService } from "./brand-competitors.service";
import { GeminiJsonClient } from "./integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "./integrations/parallel/parallel-extract.client";
import { ParallelSearchClient } from "./integrations/parallel/parallel-search.client";
import { GatekeeperService } from "./industry/gatekeeper.service";
import { GeminiIndustryClassifier } from "./industry/gemini-industry-classifier.service";
import { INDUSTRY_CLASSIFIER } from "./industry/industry-classifier.token";
import { StubIndustryClassifier } from "./industry/stub-industry-classifier.service";
import { BRAND_SURFACE_SCAN_RUNNER } from "./surface-scan/brand-surface-scan.runner.token";
import { BrandScanAssetMirrorService } from "./surface-scan/brand-scan-asset-mirror.service";
import { HttpBrandSurfaceScanRunner } from "./surface-scan/http-brand-surface-scan.runner";
import { UnconfiguredBrandSurfaceScanRunner } from "./surface-scan/unconfigured-brand-surface-scan.runner";
import { SurfaceScanProgressStore } from "./surface-scan/surface-scan-progress.store";
import { CoreIdentityOrchestratorService } from "./surface-scan/stage1a/core-identity-orchestrator.service";
import { CoreIdentitySnapshotService } from "./surface-scan/stage1a/core-identity-snapshot.service";
import { CoreIdentityConfirmationService } from "./surface-scan/stage1a/core-identity-confirmation.service";
import { PlaywrightHomepageStrategy } from "./surface-scan/stage1a/playwright-homepage.strategy";
import { Stage1aBrandSurfaceScanRunner } from "./surface-scan/stage1a/stage1a-brand-surface-scan.runner";
import { ZyteHomepageStrategy } from "./surface-scan/stage1a/zyte-homepage.strategy";
import { McpPlannerService } from "./surface-scan/stage1b/mcp-planner.service";
import { Stage1bCoordinatorService } from "./surface-scan/stage1b/stage1b-coordinator.service";
import { TextContextBuilderService } from "./surface-scan/stage1b/text-context-builder.service";
import { PromptBuilderService } from "./surface-scan/stage2/prompt-builder.service";
import { BrandDnaEngineService } from "./surface-scan/stage2/brand-dna-engine.service";
import { SnapshotValidationService } from "./surface-scan/stage2/snapshot-validation.service";
import { BrandDnaProfileMergerService } from "./surface-scan/stage2/brand-dna-profile-merger.service";
import { IntelligenceStatusService } from "./surface-scan/intelligence-status.service";
import { BrandAuditExportService } from "./surface-scan/brand-audit-export.service";
import { Checkpoint2Service } from "./surface-scan/checkpoint2/checkpoint2.service";
import { BrandVerificationService } from "./verification/brand-verification.service";
import { GatekeeperAdmissionDecisionService } from "./gatekeeper/gatekeeper-admission-decision.service";
import { GatekeeperIndustryConfirmationService } from "./gatekeeper/gatekeeper-industry-confirmation.service";
import { GatekeeperPersistenceService } from "./gatekeeper/gatekeeper-persistence.service";
import { GatekeeperPolicyVersionService } from "./gatekeeper/gatekeeper-policy-version.service";
import { GatekeeperRecoveryService } from "./gatekeeper/gatekeeper-recovery.service";
import { GatekeeperSupportService } from "./gatekeeper/gatekeeper-support.service";
import { GatekeeperV1AdmissionService } from "./gatekeeper/gatekeeper-v1-admission.service";
import { GATEKEEPER_CAPABILITY_PORT } from "./gatekeeper/runtime/gatekeeper-capability.port";
import { DataExtractionGatekeeperAdapter } from "./gatekeeper/runtime/data-extraction-gatekeeper.adapter";
import { GatekeeperArtifactLoader } from "./gatekeeper/runtime/gatekeeper-artifact.loader";
import { GatekeeperPromptService } from "./gatekeeper/runtime/gatekeeper-prompt.service";
import { GatekeeperRuntimeOrchestratorService } from "./gatekeeper/runtime/gatekeeper-runtime-orchestrator.service";
import { GatekeeperTelemetryService } from "./gatekeeper/runtime/gatekeeper-telemetry.service";
import { BrandPreviewRunService } from "./brand-preview/brand-preview-run.service";
import { BrandPreviewWebsiteEvidenceService } from "./brand-preview/data-extraction/brand-preview-evidence.service";
import { BrandPreviewPublicWebEnrichmentService } from "./brand-preview/data-extraction/brand-preview-enrichment.service";
import { BrandPreviewArtifactLoader } from "./brand-preview/runtime/brand-preview-artifact.loader";
import { BrandPreviewPromptService } from "./brand-preview/runtime/brand-preview-prompt.service";
import { BrandPreviewSynthesisService } from "./brand-preview/runtime/brand-preview-synthesis.service";
import { BrandPreviewRuntimeService } from "./brand-preview/runtime/brand-preview-runtime.service";
import { BrandPreviewWorkerService } from "./brand-preview/runtime/brand-preview-worker.service";
import {
  BRAND_PREVIEW_PUBLIC_WEB_ENRICHMENT,
  BRAND_PREVIEW_WEBSITE_EVIDENCE,
} from "./brand-preview/data-extraction/brand-preview-evidence.port";
import { BrandStateReadTelemetryService } from "./canonical-brand-state/brand-state-read-telemetry.service";
import { CanonicalBrandStateService } from "./canonical-brand-state/canonical-brand-state.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    S3Module,
    BrandCentreModule,
    BrandCanonicalStateModule,
    InstagramModule,
    DataExtractionModule,
  ],
  controllers: [
    BrandOnboardingController,
    BrandController,
    BrandSocialSyncController,
  ],
  providers: [
    BrandSocialSyncService,
    BrandScanGateService,
    DiscoveryReachabilityService,
    BrandOnboardingPurgeService,
    BrandOnboardingPurgeScheduler,
    BrandOnboardingService,
    GatekeeperV1AdmissionService,
    GatekeeperAdmissionDecisionService,
    GatekeeperIndustryConfirmationService,
    GatekeeperPersistenceService,
    GatekeeperPolicyVersionService,
    GatekeeperRecoveryService,
    GatekeeperSupportService,
    GatekeeperArtifactLoader,
    GatekeeperPromptService,
    GatekeeperRuntimeOrchestratorService,
    GatekeeperTelemetryService,
    CanonicalBrandStateService,
    BrandStateReadTelemetryService,
    BrandPreviewRunService,
    BrandPreviewWebsiteEvidenceService,
    BrandPreviewPublicWebEnrichmentService,
    {
      provide: BRAND_PREVIEW_WEBSITE_EVIDENCE,
      useExisting: BrandPreviewWebsiteEvidenceService,
    },
    {
      provide: BRAND_PREVIEW_PUBLIC_WEB_ENRICHMENT,
      useExisting: BrandPreviewPublicWebEnrichmentService,
    },
    BrandPreviewArtifactLoader,
    BrandPreviewPromptService,
    BrandPreviewSynthesisService,
    BrandPreviewRuntimeService,
    BrandPreviewWorkerService,
    DataExtractionGatekeeperAdapter,
    {
      provide: GATEKEEPER_CAPABILITY_PORT,
      useExisting: DataExtractionGatekeeperAdapter,
    },
    BrandProfileService,
    BrandOfferingsService,
    CanonicalOfferingStateService,
    BrandCompetitorsService,
    BrandVerificationService,
    SurfaceScanProgressStore,
    ParallelExtractClient,
    ParallelSearchClient,
    GeminiJsonClient,
    BrandScanAssetMirrorService,
    // Legacy Parallel-backed runner retained for reactivation only.
    HttpBrandSurfaceScanRunner,
    UnconfiguredBrandSurfaceScanRunner,
    ZyteHomepageStrategy,
    PlaywrightHomepageStrategy,
    CoreIdentityOrchestratorService,
    CoreIdentitySnapshotService,
    CoreIdentityConfirmationService,
    TextContextBuilderService,
    McpPlannerService,
    PromptBuilderService,
    BrandDnaEngineService,
    BrandDnaProfileMergerService,
    SnapshotValidationService,
    Stage1bCoordinatorService,
    BrandIntelligenceJobService,
    BrandIntelligenceWorkerService,
    IntelligenceStatusService,
    BrandAuditExportService,
    Checkpoint2Service,
    Stage1aBrandSurfaceScanRunner,
    {
      provide: BRAND_SURFACE_SCAN_RUNNER,
      useFactory: (
        config: ConfigService,
        stage1a: Stage1aBrandSurfaceScanRunner,
        unconfigured: UnconfiguredBrandSurfaceScanRunner,
      ) => {
        const hasZyte = Boolean(config.get<string>("ZYTE_API_KEY")?.trim());
        const playwrightEnabled =
          (config.get<string>("PLAYWRIGHT_ENABLED", "true") ?? "true")
            .trim()
            .toLowerCase() !== "false";
        // Legacy Parallel path kept for reactivation only:
        // inject HttpBrandSurfaceScanRunner and return it when
        // BRAND_SCAN_ACQUISITION === "parallel" && PARALLEL_API_KEY is set.
        if (hasZyte || playwrightEnabled) {
          return stage1a;
        }
        return unconfigured;
      },
      inject: [
        ConfigService,
        Stage1aBrandSurfaceScanRunner,
        UnconfiguredBrandSurfaceScanRunner,
      ],
    },
    StubIndustryClassifier,
    GatekeeperService,
    // Legacy Parallel+Gemini classifier retained but not bound by default.
    GeminiIndustryClassifier,
    {
      provide: INDUSTRY_CLASSIFIER,
      useFactory: (
        config: ConfigService,
        gatekeeper: GatekeeperService,
        stub: StubIndustryClassifier,
      ) => {
        const hasGemini = Boolean(config.get<string>("GEMINI_API_KEY")?.trim());
        if (hasGemini) {
          return gatekeeper;
        }
        return stub;
      },
      inject: [ConfigService, GatekeeperService, StubIndustryClassifier],
    },
  ],
})
export class BrandOnboardingModule {}
