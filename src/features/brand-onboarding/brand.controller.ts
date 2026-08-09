import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  GatewayTimeoutException,
  Headers,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { throwBrandScanGateHttp } from "./brand-scan-gate-http.util";

import { BrandProfileService } from "./brand-profile.service";
import { BrandOfferingsService } from "./brand-offerings.service";
import { BrandCompetitorsService } from "./brand-competitors.service";
import { SendBrandVerificationDto } from "./dto/send-brand-verification.dto";
import { VerifyBrandVerificationDto } from "./dto/verify-brand-verification.dto";
import { GoogleBrandVerificationDto } from "./dto/google-brand-verification.dto";
import { SetBrandPasswordDto } from "./dto/set-brand-password.dto";
import {
  PatchBrandProfileDto,
  SurfaceScanRequestDto,
} from "./dto/brand-profile.dto";
import {
  SyncOfferingsDto,
  UploadOfferingImageDto,
} from "./dto/brand-offerings.dto";
import { UploadBrandImageDto } from "./dto/brand-image-upload.dto";
import { SyncCompetitorsDto } from "./dto/brand-competitors.dto";
import { BrandVerificationService } from "./verification/brand-verification.service";
import {
  BRAND_SURFACE_SCAN_RUNNER,
  type BrandSurfaceScanRunner,
} from "./surface-scan/brand-surface-scan.runner.token";
import { SURFACE_SCAN_NOT_CONFIGURED_PREFIX } from "./surface-scan/unconfigured-brand-surface-scan.runner";
import { isSurfaceScanConnectionFailure } from "./surface-scan/surface-scan-connection-failure.error";
import { isSurfaceScanAcquisitionTimeout } from "./surface-scan/surface-scan-acquisition-timeout.error";
import { SurfaceScanProgressStore } from "./surface-scan/surface-scan-progress.store";
import { CoreIdentitySnapshotService } from "./surface-scan/stage1a/core-identity-snapshot.service";
import { CoreIdentityConfirmationService } from "./surface-scan/stage1a/core-identity-confirmation.service";
import { ConfirmIdentityBodySchema } from "./surface-scan/stage1a/confirm-identity.schema";
import { IntelligenceStatusService } from "./surface-scan/intelligence-status.service";
import { BrandAuditExportService } from "./surface-scan/brand-audit-export.service";
import { Checkpoint2Service } from "./surface-scan/checkpoint2/checkpoint2.service";
import { ConfirmCheckpoint2BodySchema } from "./surface-scan/checkpoint2/confirm-checkpoint2.schema";

@Controller("api/v1/brand")
@UseGuards(ThrottlerGuard)
export class BrandController {
  constructor(
    @Inject(BRAND_SURFACE_SCAN_RUNNER)
    private readonly surfaceScanRunner: BrandSurfaceScanRunner,
    private readonly brandProfiles: BrandProfileService,
    private readonly brandOfferings: BrandOfferingsService,
    private readonly brandCompetitors: BrandCompetitorsService,
    private readonly brandVerification: BrandVerificationService,
    private readonly scanProgress: SurfaceScanProgressStore,
    private readonly coreIdentitySnapshots: CoreIdentitySnapshotService,
    private readonly coreIdentityConfirmation: CoreIdentityConfirmationService,
    private readonly intelligenceStatus: IntelligenceStatusService,
    private readonly brandAuditExport: BrandAuditExportService,
    private readonly checkpoint2: Checkpoint2Service,
    private readonly jwtService: JwtService,
  ) {}

  @Get("surface-scan/progress/:leadId")
  async surfaceScanProgress(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    const snapshot = this.scanProgress.get(leadId);
    if (!snapshot) {
      return {
        leadId,
        phase: "signals",
        completedPhases: [] as string[],
        message: "Waiting for scan to start",
        updatedAt: new Date().toISOString(),
      };
    }
    return snapshot;
  }

  /**
   * Stage 1A Checkpoint 1 payload — typed Core Identity snapshot for the
   * temporary review UI (value/confidence/evidence wrappers).
   */
  @Get("surface-scan/core-identity/:leadId")
  async coreIdentitySnapshot(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.coreIdentitySnapshots.getByLeadId(leadId);
  }

  /**
   * Checkpoint 1 confirmation — locks authoritative identity and queues
   * Stage 1B → Prompt A Brand DNA pipeline.
   */
  @Post("surface-scan/confirm-identity/:leadId")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmIdentity(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
    @Body() body: unknown,
  ) {
    const parsed = ConfirmIdentityBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid confirm-identity payload",
        issues: parsed.error.issues,
      });
    }
    return this.coreIdentityConfirmation.confirm(leadId, parsed.data);
  }

  /**
   * Pipeline status + archived Brand DNA for the Brand DNA page polling.
   */
  @Get("surface-scan/intelligence/:leadId")
  async intelligenceStatusByLead(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.intelligenceStatus.getByLeadId(leadId);
  }

  /**
   * Structured audit payload for product-team PDF export on the Brand DNA page.
   */
  @Get("surface-scan/audit/:leadId")
  async brandAuditByLead(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.brandAuditExport.getByLeadId(leadId);
  }

  /**
   * Checkpoint 2 payload — Surface Intelligence (Brand DNA + offerings/competitors).
   */
  @Get("surface-scan/checkpoint-2/:leadId")
  async checkpoint2ByLead(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.checkpoint2.getByLeadId(leadId);
  }

  /**
   * Checkpoint 2 confirmation — locks Surface Intelligence review.
   */
  @Post("surface-scan/checkpoint-2/:leadId/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmCheckpoint2(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
    @Body() body: unknown,
  ) {
    const parsed = ConfirmCheckpoint2BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid checkpoint-2 confirm payload",
        issues: parsed.error.issues,
      });
    }
    return this.checkpoint2.confirm(leadId, parsed.data);
  }

  @Post("surface-scan")
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async surfaceScan(
    @Body() body: SurfaceScanRequestDto,
    @Ip() clientIp: string,
    @Headers("authorization") authorization?: string,
  ) {
    try {
      return await this.surfaceScanRunner.run({
        leadId: body.leadId,
        force: body.force === true,
        clientIp,
        authenticatedUserId: this.optionalUserId(authorization),
      });
    } catch (err: unknown) {
      throwBrandScanGateHttp(err);
      if (isSurfaceScanAcquisitionTimeout(err)) {
        throw new GatewayTimeoutException({
          outcome: "scan_timeout",
          timeoutMs: err.timeoutMs,
          message: err.message,
        });
      }
      if (isSurfaceScanConnectionFailure(err)) {
        // Landing Page State F: typed payload so the frontend can render the
        // dedicated infrastructure-error / "Retry Connection Check" state.
        throw new BadGatewayException({
          outcome: "infrastructure_error",
          reason: err.reason,
          httpStatus: err.httpStatus ?? null,
          message: err.message,
        });
      }
      const message =
        err instanceof Error ? err.message : "Surface scan failed";
      if (message.includes(SURFACE_SCAN_NOT_CONFIGURED_PREFIX)) {
        throw new ServiceUnavailableException(
          message.slice(SURFACE_SCAN_NOT_CONFIGURED_PREFIX.length),
        );
      }
      if (message.includes("not found")) {
        throw new NotFoundException(message);
      }
      if (message.includes("schema validation")) {
        throw new UnprocessableEntityException(message);
      }
      if (
        message.includes("insufficient content") ||
        message.includes("Parallel extract failed") ||
        message.includes("timed out")
      ) {
        throw new BadGatewayException(message);
      }
      throw new BadRequestException(message);
    }
  }

  @Get("profiles/:brandProfileId")
  async getProfile(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
  ) {
    return this.brandProfiles.getById(brandProfileId);
  }

  @Patch("profiles/:brandProfileId")
  async patchProfile(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: PatchBrandProfileDto,
  ) {
    return this.brandProfiles.patch(brandProfileId, body);
  }

  @Post("profiles/:brandProfileId/logo")
  @HttpCode(200)
  async uploadBrandLogo(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: UploadBrandImageDto,
  ) {
    return this.brandProfiles.uploadLogo(brandProfileId, body);
  }

  @Patch("profiles/:brandProfileId/offerings")
  async syncOfferings(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: SyncOfferingsDto,
  ) {
    return this.brandOfferings.sync(brandProfileId, body);
  }

  @Post("profiles/:brandProfileId/offerings/:offeringId/image")
  @HttpCode(200)
  async uploadOfferingImage(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Param("offeringId", new ParseUUIDPipe({ version: "4" }))
    offeringId: string,
    @Body() body: UploadOfferingImageDto,
  ) {
    return this.brandOfferings.uploadOfferingImage(
      brandProfileId,
      offeringId,
      body,
    );
  }

  @Patch("profiles/:brandProfileId/competitors")
  async syncCompetitors(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: SyncCompetitorsDto,
  ) {
    return this.brandCompetitors.sync(brandProfileId, body);
  }

  @Post("profiles/:brandProfileId/competitors/:competitorId/logo")
  @HttpCode(200)
  async uploadCompetitorLogo(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Param("competitorId", new ParseUUIDPipe({ version: "4" }))
    competitorId: string,
    @Body() body: UploadBrandImageDto,
  ) {
    return this.brandCompetitors.uploadCompetitorLogo(
      brandProfileId,
      competitorId,
      body,
    );
  }

  @Post("profiles/:brandProfileId/verification/send")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async sendVerificationOtp(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: SendBrandVerificationDto,
  ) {
    return this.brandVerification.sendOtp(brandProfileId, body.email);
  }

  @Post("profiles/:brandProfileId/verification/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyVerificationOtp(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: VerifyBrandVerificationDto,
  ) {
    return this.brandVerification.verifyOtp(
      brandProfileId,
      body.email,
      body.otp,
    );
  }

  @Post("profiles/:brandProfileId/verification/google")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async confirmGoogleVerification(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: GoogleBrandVerificationDto,
  ) {
    return this.brandVerification.confirmGoogleIdentity(
      brandProfileId,
      body.idToken,
    );
  }

  @Post("profiles/:brandProfileId/verification/password")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async setVerificationPassword(
    @Param("brandProfileId", new ParseUUIDPipe({ version: "4" }))
    brandProfileId: string,
    @Body() body: SetBrandPasswordDto,
  ) {
    return this.brandVerification.setPasswordAndActivate(
      brandProfileId,
      body.email,
      body.password,
    );
  }

  private optionalUserId(authorization?: string): string | undefined {
    if (!authorization?.startsWith("Bearer ")) {
      return undefined;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(
        authorization.slice(7),
      );
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
