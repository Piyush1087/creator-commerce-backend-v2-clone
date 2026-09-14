import { Injectable } from "@nestjs/common";
import { IntelligenceOwnerType, Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { IntelligenceOwnerScope } from "../../../creator-audience/contracts/creator-audience-v0.contract";

export type PersistedOwnerScope = Readonly<{
  id: string;
  ownerKey: string;
  scope: IntelligenceOwnerScope;
}>;

@Injectable()
export class IntelligenceOwnerScopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(scope: IntelligenceOwnerScope): Promise<PersistedOwnerScope> {
    if (scope.kind === "BRAND") {
      const row = await this.prisma.intelligenceOwnerScope.upsert({
        where: { ownerKey: `BRAND:${scope.brandProfileId}` },
        create: {
          ownerType: IntelligenceOwnerType.BRAND,
          ownerKey: `BRAND:${scope.brandProfileId}`,
          brandProfileId: scope.brandProfileId,
        },
        update: {},
      });
      return { id: row.id, ownerKey: row.ownerKey, scope };
    }

    const workspace = await this.prisma.creatorWorkspace.findFirst({
      where: {
        id: scope.creatorWorkspaceId,
        ownerProfileId: scope.creatorProfileId,
      },
      select: { id: true },
    });
    if (!workspace) throw new Error("CREATOR_OWNER_SCOPE_MISMATCH");
    const ownerKey = `CREATOR:${scope.creatorProfileId}:${scope.creatorWorkspaceId}`;
    const row = await this.prisma.intelligenceOwnerScope.upsert({
      where: { ownerKey },
      create: {
        ownerType: IntelligenceOwnerType.CREATOR,
        ownerKey,
        creatorProfileId: scope.creatorProfileId,
        creatorWorkspaceId: scope.creatorWorkspaceId,
      },
      update: {},
    });
    return { id: row.id, ownerKey: row.ownerKey, scope };
  }

  /** Exact internal Creator Instagram purge; the canonical Creator scope survives. */
  async purgeCreatorInstagram(scopeId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const scope = await tx.intelligenceOwnerScope.findUnique({
        where: { id: scopeId },
      });
      if (!scope || scope.ownerType !== IntelligenceOwnerType.CREATOR) {
        throw new Error("CREATOR_OWNER_SCOPE_REQUIRED");
      }
      const counts = await tx.$queryRaw<
        Array<{ deleted_count: bigint }>
      >(Prisma.sql`
        WITH deleted_subjects AS (
          DELETE FROM intelligence_subjects WHERE owner_scope_id = ${scopeId} AND subject_type = 'CREATOR' RETURNING 1
        ), deleted_resources AS (
          DELETE FROM data_extraction_resources WHERE owner_scope_id = ${scopeId} AND source_class = 'INSTAGRAM_OWNED' RETURNING 1
        ), deleted_sync AS (
          DELETE FROM instagram_intelligence_sync_jobs WHERE owner_scope_id = ${scopeId} RETURNING 1
        )
        SELECT
          (SELECT count(*) FROM deleted_subjects) +
          (SELECT count(*) FROM deleted_resources) +
          (SELECT count(*) FROM deleted_sync) AS deleted_count
      `);
      return Number(counts[0]?.deleted_count ?? 0n);
    });
  }
}
