import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../brand-centre-auth.service";
import { CanonicalOfferingIndexResponseSchema } from "./canonical-offering-discovery.schema";

@Injectable()
export class CanonicalOfferingDiscoveryService {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(user);
    const rows = await this.prisma.offering.findMany({
      where: {
        brandProfileId,
        canonicalKind: { not: null },
        canonicalLifecycle: { not: null },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        canonicalKind: true,
        canonicalSubtype: true,
        canonicalLifecycle: true,
      },
    });

    return CanonicalOfferingIndexResponseSchema.parse({
      offerings: rows.map((row) => this.mapRow(row)),
    });
  }

  async listBounded(user: AuthUser, limit: number) {
    const brandProfileId = await this.auth.resolveBrandProfileId(user);
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.offering.findMany({
      where: {
        brandProfileId,
        canonicalKind: { not: null },
        canonicalLifecycle: { not: null },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: boundedLimit + 1,
      select: {
        id: true,
        name: true,
        canonicalKind: true,
        canonicalSubtype: true,
        canonicalLifecycle: true,
      },
    });
    return {
      ...CanonicalOfferingIndexResponseSchema.parse({
        offerings: rows.slice(0, boundedLimit).map((row) => this.mapRow(row)),
      }),
      truncated: rows.length > boundedLimit,
    };
  }

  private mapRow(row: {
    id: string;
    name: string;
    canonicalKind: string | null;
    canonicalSubtype: string | null;
    canonicalLifecycle: string | null;
  }) {
    if (!row.canonicalKind || !row.canonicalLifecycle) {
      throw new Error("Canonical Offering discovery returned unresolved state");
    }
    return {
      offeringId: row.id,
      name: row.name,
      kind: row.canonicalKind,
      subtype: row.canonicalSubtype,
      lifecycle: row.canonicalLifecycle,
    };
  }
}
