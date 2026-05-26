import { BadRequestException, Controller, Get, Query } from "@nestjs/common";

import { S3Service } from "./s3.service";

@Controller("api/v1/s3")
export class S3Controller {
  constructor(private readonly s3: S3Service) {}

  @Get("signed-url")
  async getSignedUrl(@Query("key") key: string | undefined) {
    const trimmed = key?.trim();
    if (!trimmed) {
      throw new BadRequestException("Missing key query parameter.");
    }
    if (!this.s3.isConfigured()) {
      throw new BadRequestException("S3 is not configured for this environment.");
    }
    const url = await this.s3.getSignedUrl(trimmed);
    return { url };
  }
}
