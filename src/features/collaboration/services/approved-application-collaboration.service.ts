import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApprovedApplicationCollaborationPort } from "../../campaign-applications/approved-application-collaboration.port";
import { canonicalApplication } from "../../campaign-applications/application-evidence";
import { mapBrandIndustryToCollaborationIndustry } from "../utils/map-collaboration-industry.util";

const identity = z.object({ id: z.string().min(1) }).passthrough();
const commercial = z.object({
  compensationModel: z.enum(["FIXED", "NEGOTIABLE"]),
  offer: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.enum(["INR", "USD"]),
});

/** The caller owns the workspace/Campaign/Application locks and transaction. */
@Injectable()
export class ApprovedApplicationCollaborationService extends ApprovedApplicationCollaborationPort {
  async provisionFromApprovedApplication(
    tx: Prisma.TransactionClient,
    input: { applicationId: string; approvalTransitionId: string },
  ) {
    z.string().uuid().parse(input.approvalTransitionId);
    const row = await tx.uceApplication.findUniqueOrThrow({
      where: { id: input.applicationId },
      include: { snapshot: true },
    });
    const app = canonicalApplication(row);
    const snapshot = row.snapshot;
    if (
      app.status !== "APPROVED" ||
      snapshot?.schemaVersion !== "C03_APPLICATION_SNAPSHOT_V1"
    )
      throw new ConflictException({
        code: "C03_APPLICATION_HANDOFF_EVIDENCE_INVALID",
      });
    const campaign = identity
      .extend({ brandProfileId: z.string() })
      .parse(snapshot.campaignContext);
    const asset = identity
      .extend({ campaignId: z.string() })
      .parse(snapshot.campaignAssetContext);
    const brief = identity
      .extend({ campaignAssetId: z.string() })
      .parse(snapshot.briefContext);
    const subject = z
      .object({ subjectCreatorProfileId: z.string(), workspaceId: z.string() })
      .parse(snapshot.creatorIdentity);
    const terms = commercial.parse(snapshot.commercialContext);
    if (
      campaign.id !== app.campaignId ||
      campaign.brandProfileId !== app.brandProfileId ||
      asset.id !== app.canonicalCampaignAssetId ||
      asset.campaignId !== app.campaignId ||
      brief.id !== app.canonicalBriefId ||
      brief.campaignAssetId !== asset.id ||
      subject.subjectCreatorProfileId !== app.subjectCreatorProfileId ||
      subject.workspaceId !== app.subjectCreatorWorkspaceId
    )
      throw new ConflictException({
        code: "C03_APPLICATION_HANDOFF_EVIDENCE_INVALID",
      });

    const existing = await tx.collaboration.findUnique({
      where: { sourceApplicationId: app.id },
    });
    if (existing) return { collaborationId: existing.id, created: false };
    const workspace = await tx.creatorWorkspace.findUnique({
      where: { id: app.subjectCreatorWorkspaceId },
      include: {
        organization: true,
        ownerProfile: { include: { user: true } },
        members: { where: { securityRole: "OWNER", isActive: true } },
      },
    });
    const owner = workspace?.ownerProfile.user;
    if (
      !workspace ||
      workspace.ownerProfileId !== app.subjectCreatorProfileId ||
      !owner ||
      owner.role !== "CREATOR" ||
      owner.authState !== "ACTIVE" ||
      workspace.organization.kind !== "CREATOR" ||
      owner.organizationId !== workspace.organizationId ||
      workspace.members.length !== 1 ||
      workspace.members[0].userId !== owner.id ||
      workspace.members[0].assignedProfileId !== workspace.ownerProfileId
    )
      throw new ConflictException({
        code: "C03_APPLICATION_CREATOR_IDENTITY_CONFLICT",
      });
    const brand = await tx.brandProfile.findUniqueOrThrow({
      where: { id: app.brandProfileId },
      select: { industry: true, brandRoutingType: true },
    });
    const fixed = terms.compensationModel === "FIXED";
    const created = await tx.collaboration.create({
      data: {
        sourceApplicationId: app.id,
        brandProfileId: app.brandProfileId,
        campaignId: app.campaignId,
        creatorUserId: owner.id,
        briefId: null,
        productId: null,
        ucePipelineCollaborationId: null,
        industry: mapBrandIndustryToCollaborationIndustry(
          brand.industry,
          brand.brandRoutingType,
        ),
        handoffCommercialState: fixed
          ? "FIXED_AGREED"
          : "AWAITING_CREATOR_PROPOSAL",
        negotiationRound: 0,
        commercials: {
          create: {
            initialQuote: null,
            brandCounterOffer: null,
            finalQuote: fixed ? new Prisma.Decimal(terms.offer) : null,
            advance30Amount: 0,
            balance70Amount: 0,
          },
        },
        logistics: { create: {} },
        finalization: { create: {} },
      },
    });
    return { collaborationId: created.id, created: true };
  }
}
