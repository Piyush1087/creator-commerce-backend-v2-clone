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
import { BrandDiscoveryService } from "./brand-discovery.service";

@Controller("api/v1/discovery")
@UseGuards(ThrottlerGuard)
export class BrandDiscoveryController {
  constructor(private readonly brandDiscovery: BrandDiscoveryService) {}

  @Post("validate")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(@Body() body: DiscoverValidateRequestDto, @Ip() clientIp: string) {
    return this.brandDiscovery.validateUrl(body.url, { clientIp });
  }
}
