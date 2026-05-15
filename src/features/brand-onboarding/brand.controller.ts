import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { BrandProfileService } from "./brand-profile.service";
import {
  PatchBrandProfileDto,
  SurfaceScanRequestDto,
} from "./dto/brand-profile.dto";
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
  ) {}

  @Post("surface-scan")
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async surfaceScan(
    @Body() body: SurfaceScanRequestDto,
    @Ip() _clientIp: string,
  ) {
    try {
      return await this.surfaceScanRunner.run({
        leadId: body.leadId,
        force: body.force === true,
      });
    } catch (err) {
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
}
