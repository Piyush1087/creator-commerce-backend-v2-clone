import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { DiscoverValidateRequestDto } from "./dto/discover-validate-request.dto";
import { DiscoverWaitlistRequestDto } from "./dto/discover-waitlist-request.dto";
import { BrandOnboardingService } from "./brand-onboarding.service";

@Controller("api/v1/discovery")
@UseGuards(ThrottlerGuard)
export class BrandOnboardingController {
  constructor(
    private readonly brandOnboarding: BrandOnboardingService,
    private readonly jwtService: JwtService,
  ) {}

  @Post("resolve")
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  resolve(
    @Body() body: DiscoverValidateRequestDto,
    @Ip() clientIp: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.brandOnboarding.resolveUrl(body.url, {
      clientIp,
      authenticatedUserId: this.optionalUserId(authorization),
    });
  }

  @Post("validate")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(
    @Body() body: DiscoverValidateRequestDto,
    @Ip() clientIp: string,
    @Headers("authorization") authorization?: string,
  ) {
    return this.brandOnboarding.validateUrl(body.url, {
      clientIp,
      authenticatedUserId: this.optionalUserId(authorization),
    });
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
