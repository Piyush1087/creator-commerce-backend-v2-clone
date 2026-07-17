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
 * Reads the Stage 1A Core Identity snapshot.
 * Prefer BrandIntelligenceScan.stage1aSnapshot; fall back to
 * DiscoveryLead.temporaryPayload.stage1a for older rows.
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

    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: leadId },
    });

    let snapshot: CoreIdentitySnapshot | null = null;
    let completedAt: string | null = null;
    let brandProfileId: string | null = scan?.brandProfileId ?? null;

    if (scan?.stage1aSnapshot) {
      const parsed = CoreIdentitySnapshotSchema.safeParse(scan.stage1aSnapshot);
      if (parsed.success) {
        snapshot = parsed.data;
        completedAt = scan.updatedAt.toISOString();
      }
    }

    if (!snapshot) {
      const payload =
        lead.temporaryPayload &&
        typeof lead.temporaryPayload === "object" &&
        !Array.isArray(lead.temporaryPayload)
          ? (lead.temporaryPayload as Record<string, unknown>)
          : null;

      const parsed = CoreIdentitySnapshotSchema.safeParse(payload?.stage1a);
      if (!parsed.success) {
        throw new NotFoundException(
          "Stage 1A core identity snapshot is not available for this lead.",
        );
      }
      snapshot = parsed.data;
      completedAt =
        typeof payload?.stage1aCompletedAt === "string"
          ? payload.stage1aCompletedAt
          : null;
    }

    if (!brandProfileId) {
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
    }

    return {
      leadId: lead.id,
      brandProfileId,
      completedAt,
      snapshot,
    };
  }
}
