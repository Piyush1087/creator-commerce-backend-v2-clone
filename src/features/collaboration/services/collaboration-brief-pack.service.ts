import { ConflictException, Injectable } from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { CollaborationAccessService } from "./collaboration-access.service";

/** Immutable, snapshot-only Collaboration Brief projection. */
@Injectable()
export class CollaborationBriefPackService {
  constructor(private readonly access: CollaborationAccessService) {}

  async get(user: AuthUser, collaborationId: string) {
    const row = await this.access.assertThreadForUser(user, collaborationId);
    if (!row.sourceApplicationId || !row.snapshot) {
      throw new ConflictException({
        code: "COLLABORATION_BRIEF_PACK_UNAVAILABLE",
      });
    }
    return {
      schemaVersion: 1 as const,
      collaboration: {
        collaborationId: row.id,
        sourceApplicationId: row.sourceApplicationId,
        lockedAt: row.snapshot.lockedAt.toISOString(),
      },
      brand: row.snapshot.brandContext,
      campaign: row.snapshot.campaignContext,
      asset: row.snapshot.campaignAssetContext,
      commercial: row.snapshot.campaignCommercialContext,
      brief: {
        content: row.snapshot.briefContext,
        usageRights: row.snapshot.usageRights,
        creatorRequirements: row.snapshot.creatorRequirements,
        deliverables: row.deliverables.map((item) => ({
          sourceBriefDeliverableId: item.sourceBriefDeliverableId,
          displayOrder: item.displayOrder,
          definition: item.definitionSnapshot,
          publishingRequired: item.publishingRequired,
        })),
      },
    };
  }
}
