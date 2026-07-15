import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CoreIdentitySnapshotSchema,
  type CoreIdentitySnapshot,
} from "./core-identity.schema";

export type CoreIdentitySnapshotResponse = {
  leadId: string;
  brandProfileId: string | null;
  completedAt: string | null;
  snapshot: CoreIdentitySnapshot;
};

/**
 * Reads the Stage 1A Core Identity snapshot stored on
 * DiscoveryLead.temporaryPayload.stage1a (no Prisma schema change).
 */
@Injectable()
export class CoreIdentitySnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async getByLeadId(leadId: string): Promise<CoreIdentitySnapshotResponse> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        normalizedUrl: true,
        temporaryPayload: true,
      },
    });
    if (!lead) {
      throw new NotFoundException("Discovery lead not found");
    }

    const payload =
      lead.temporaryPayload &&
      typeof lead.temporaryPayload === "object" &&
      !Array.isArray(lead.temporaryPayload)
        ? (lead.temporaryPayload as Record<string, unknown>)
        : null;

    const rawSnapshot = payload?.stage1a;
    const parsed = CoreIdentitySnapshotSchema.safeParse(rawSnapshot);
    if (!parsed.success) {
      throw new NotFoundException(
        "Stage 1A core identity snapshot is not available for this lead.",
      );
    }

    const completedAt =
      typeof payload?.stage1aCompletedAt === "string"
        ? payload.stage1aCompletedAt
        : null;

    let brandProfileId: string | null = null;
    try {
      const host = new URL(lead.normalizedUrl).hostname.replace(/^www\./, "");
      const profile = await this.prisma.brandProfile.findUnique({
        where: { domain: host },
        select: { id: true },
      });
      brandProfileId = profile?.id ?? null;
    } catch {
      brandProfileId = null;
    }

    return {
      leadId: lead.id,
      brandProfileId,
      completedAt,
      snapshot: parsed.data,
    };
  }
}
