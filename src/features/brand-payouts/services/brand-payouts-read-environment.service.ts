import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class BrandPayoutsReadEnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async assertDatabaseUtc(): Promise<void> {
    const rows = await this.prisma.$queryRaw<
      ReadonlyArray<Record<string, unknown>>
    >(Prisma.sql`SHOW TIME ZONE`);
    const row = rows[0];
    const value = row ? (row.TimeZone ?? row.timezone ?? row.time_zone) : null;
    if (typeof value !== "string" || value.toUpperCase() !== "UTC") {
      throw new ServiceUnavailableException({
        code: "BRAND_PAYOUTS_DATABASE_TIMEZONE_UNSAFE",
        message: "Brand Payouts reads require a UTC database session",
      });
    }
  }
}
