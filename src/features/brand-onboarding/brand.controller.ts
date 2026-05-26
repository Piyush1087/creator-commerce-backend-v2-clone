import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { SendBrandVerificationDto } from "./dto/send-brand-verification.dto";
import { VerifyBrandVerificationDto } from "./dto/verify-brand-verification.dto";
import {
  PatchBrandProfileDto,
  SurfaceScanRequestDto,
} from "./dto/brand-profile.dto";
import { BrandVerificationService } from "./verification/brand-verification.service";
import {
  BRAND_SURFACE_SCAN_RUNNER,
  type BrandSurfaceScanRunner,
} from "./surface-scan/brand-surface-scan.runner.token";
import { SURFACE_SCAN_NOT_CONFIGURED_PREFIX } from "./surface-scan/unconfigured-brand-surface-scan.runner";

@Controller("api/v1/brand")
@UseGuards(ThrottlerGuard)
export class BrandController {
  constructor(
    @Inject(BRAND_SURFACE_SCAN_RUNNER)
    private readonly surfaceScanRunner: BrandSurfaceScanRunner,
    private readonly brandProfiles: BrandProfileService,
    private readonly brandVerification: BrandVerificationService,
    private readonly jwtService: JwtService,
  ) {}

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
      const message = err instanceof Error ? err.message : "Surface scan failed";
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
