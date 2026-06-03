import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { UnifiedBridgeSignalProcessorSchema } from "./schemas/bridge-signal.schema";
import { BrandCentreUceBridgeService } from "./services/brand-centre-uce-bridge.service";

@Controller("api/v1/orchestration")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandCentreUceBridgeController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly bridge: BrandCentreUceBridgeService,
  ) {}

  @Post("process-signal")
  @HttpCode(201)
  async processSignal(@Req() req: RequestWithAuthUser, @Body() body: unknown) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    const parsed = UnifiedBridgeSignalProcessorSchema.safeParse(body);
    if (!parsed.success) {
      return this.bridge.logValidationFailure(
        brandProfileId,
        body,
        parsed.error.flatten(),
      );
    }
    return this.bridge.processSignal(brandProfileId, parsed.data, body);
  }
}

