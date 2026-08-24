import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { ConfirmGatekeeperIndustryDto } from "./dto/confirm-gatekeeper-industry.dto";
import { DiscoverResolveRequestDto } from "./dto/discover-resolve-request.dto";
import { DiscoverValidateRequestDto } from "./dto/discover-validate-request.dto";
import { DiscoverWaitlistRequestDto } from "./dto/discover-waitlist-request.dto";
import { GatekeeperRecoveryRequestDto } from "./dto/gatekeeper-recovery-request.dto";
import { BrandOnboardingService } from "./brand-onboarding.service";
import { GatekeeperIndustryConfirmationService } from "./gatekeeper/gatekeeper-industry-confirmation.service";
import { GatekeeperRecoveryService } from "./gatekeeper/gatekeeper-recovery.service";
import { GatekeeperSupportService } from "./gatekeeper/gatekeeper-support.service";
import { GatekeeperV1AdmissionService } from "./gatekeeper/gatekeeper-v1-admission.service";
import { BrandPreviewRunService } from "./brand-preview/brand-preview-run.service";

@Controller("api/v1/discovery")
@UseGuards(ThrottlerGuard)
export class BrandOnboardingController {
  constructor(
    private readonly brandOnboarding: BrandOnboardingService,
    private readonly gatekeeperV1: GatekeeperV1AdmissionService,
    private readonly gatekeeperConfirmation: GatekeeperIndustryConfirmationService,
    private readonly gatekeeperRecovery: GatekeeperRecoveryService,
    private readonly gatekeeperSupport: GatekeeperSupportService,
    private readonly brandPreview: BrandPreviewRunService,
    private readonly jwtService: JwtService,
  ) {}

  @Post("resolve")
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  resolve(
    @Body() body: DiscoverResolveRequestDto,
    @Ip() clientIp: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.brandOnboarding.resolveUrl(body.url, {
      clientIp,
      authenticatedUserId: this.optionalUserId(authorization),
    });
  }

  @Get(":leadId/brand-preview")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getBrandPreview(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.brandPreview.getOrStartEligible(leadId);
  }

  @Post(":leadId/brand-preview/retry")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  retryBrandPreview(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
  ) {
    return this.brandPreview.retry(leadId);
  }

  @Post("validate")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(
    @Body() body: DiscoverValidateRequestDto,
    @Ip() clientIp: string,
    @Headers("authorization") authorization?: string,
    @Headers("x-session-id") sessionId?: string,
  ) {
    return this.gatekeeperV1.validate(body, {
      clientIp,
      authenticatedUserId: this.optionalUserId(authorization),
      sessionId,
    });
  }

  @Post(":leadId/confirm-industry")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirmIndustry(
    @Param("leadId") leadId: string,
    @Body() body: ConfirmGatekeeperIndustryDto,
  ) {
    return this.gatekeeperConfirmation.confirm(leadId, body);
  }

  @Post(":leadId/request-org-access")
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  requestOrganizationAccess(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
    @Body() body: GatekeeperRecoveryRequestDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-session-id") sessionId?: string,
  ) {
    return this.gatekeeperRecovery.requestOrganizationAccess(leadId, body, {
      authenticatedUserId: this.optionalUserId(authorization),
      sessionId,
    });
  }

  @Post(":leadId/request-classification-review")
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  requestClassificationReview(
    @Param("leadId", new ParseUUIDPipe({ version: "4" })) leadId: string,
    @Body() body: GatekeeperRecoveryRequestDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-session-id") sessionId?: string,
  ) {
    return this.gatekeeperRecovery.requestClassificationReview(leadId, body, {
      authenticatedUserId: this.optionalUserId(authorization),
      sessionId,
    });
  }

  @Get("support")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  support() {
    return this.gatekeeperSupport.destination();
  }

  @Post("waitlist")
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  waitlist(@Body() body: DiscoverWaitlistRequestDto, @Ip() clientIp: string) {
    return this.brandOnboarding.joinWaitlist(body, { clientIp });
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
