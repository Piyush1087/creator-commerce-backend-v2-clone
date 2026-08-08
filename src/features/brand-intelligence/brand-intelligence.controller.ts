import { Body, Controller, NotFoundException, Post } from "@nestjs/common";

import { BrandIntelligenceService } from "./brand-intelligence.service";
import { IdentityTestDto } from "./dto/identity-test.dto";

@Controller("api/v1/brand-intelligence")
export class BrandIntelligenceController {
  constructor(private readonly brandIntelligence: BrandIntelligenceService) {}

  /**
   * Dev/test-only dry-run entry for identity_test.
   * No auth — endpoint is disabled in production via NODE_ENV check.
   */
  @Post("identity-test")
  async identityTest(@Body() body: IdentityTestDto) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }

    return this.brandIntelligence.runIdentityTest({
      websiteUrl: body.websiteUrl,
      entityId: body.entityId,
    });
  }
}
