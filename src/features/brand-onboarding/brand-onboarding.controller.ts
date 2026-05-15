import {
  Body,
  Controller,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { DiscoverValidateRequestDto } from "./dto/discover-validate-request.dto";
import { DiscoverWaitlistRequestDto } from "./dto/discover-waitlist-request.dto";
import { BrandOnboardingService } from "./brand-onboarding.service";

@Controller("api/v1/discovery")
@UseGuards(ThrottlerGuard)
export class BrandOnboardingController {
  constructor(private readonly brandOnboarding: BrandOnboardingService) {}

  @Post("resolve")
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  resolve(@Body() body: DiscoverValidateRequestDto, @Ip() clientIp: string) {
    return this.brandOnboarding.resolveUrl(body.url, { clientIp });
  }

  @Post("validate")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(@Body() body: DiscoverValidateRequestDto, @Ip() clientIp: string) {
    return this.brandOnboarding.validateUrl(body.url, { clientIp });
  }

  @Post("waitlist")
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  waitlist(@Body() body: DiscoverWaitlistRequestDto, @Ip() clientIp: string) {
    return this.brandOnboarding.joinWaitlist(body, { clientIp });
  }
}
