import { randomUUID } from "node:crypto";

import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { ApprovedApplicationCollaborationPort } from "../../campaign-applications/approved-application-collaboration.port";
import { canonicalApplication } from "../../campaign-applications/application-evidence";
import { mapBrandIndustryToCollaborationIndustry } from "../utils/map-collaboration-industry.util";
import { exactCampaignPaymentTerm } from "../utils/collaboration-financial-authority";

const identity = z.object({ id: z.string().min(1) }).passthrough();
const commercial = z
  .object({
    compensationModel: z.enum(["FIXED", "NEGOTIABLE"]),
    offer: z.string().regex(/^\d+(\.\d{1,2})?$/),
    currency: z.enum(["INR", "USD"]),
    receivesBrandSupport: z.boolean().optional(),
    brandSupportType: z
      .enum([
        "PRODUCT",
        "SERVICE",
        "EXPERIENCE",
        "ACCESS_SUBSCRIPTION",
        "OTHER",
      ])
      .nullable()
      .optional(),
    brandSupportEstimatedValue: z
      .union([z.string(), z.number()])
      .nullable()
      .optional(),
  })
  .passthrough();

/** C-03 owns the locks and transaction; this trusted port owns C-04 initialization. */
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
    ) {
      throw new ConflictException({
        code: "C03_APPLICATION_HANDOFF_EVIDENCE_INVALID",
      });
    }

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
    ) {
      throw new ConflictException({
        code: "C03_APPLICATION_HANDOFF_EVIDENCE_INVALID",
      });
    }

    const existing = await tx.collaboration.findUnique({
      where: { sourceApplicationId: app.id },
      include: { snapshot: true, commercialAgreement: true },
    });
    if (existing) {
      if (
        existing.authorityVersion !== "CANONICAL_V1" ||
        existing.creatorProfileId !== app.subjectCreatorProfileId ||
        existing.creatorWorkspaceId !== app.subjectCreatorWorkspaceId ||
        existing.brandProfileId !== app.brandProfileId ||
        existing.campaignId !== app.campaignId ||
        existing.campaignAssetId !== app.canonicalCampaignAssetId ||
        !existing.snapshot ||
        !existing.commercialAgreement
      )
        throw new ConflictException({
          code: "C04_APPLICATION_LINEAGE_CONFLICT",
        });
      return { collaborationId: existing.id, created: false };
    }

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

    const [brand, deliverables, campaignCommercials] = await Promise.all([
      tx.brandProfile.findUniqueOrThrow({
        where: { id: app.brandProfileId },
        select: {
          id: true,
          name: true,
          industry: true,
          brandRoutingType: true,
        },
      }),
      tx.canonicalBriefDeliverable.findMany({
        where: { briefId: app.canonicalBriefId },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      }),
      tx.uceCampaignCommercials.findUnique({
        where: { campaignId: app.campaignId },
        select: { finalBalanceTerms: true },
      }),
    ]);
    const campaignPaymentTerm = exactCampaignPaymentTerm(
      campaignCommercials?.finalBalanceTerms,
    );
    const fixed = terms.compensationModel === "FIXED";
    const physicalDeliveryRequired =
      terms.receivesBrandSupport === true &&
      terms.brandSupportType === "PRODUCT";
    const offer = new Prisma.Decimal(terms.offer);
    const agreementId = randomUUID();
    const lockedAt = fixed ? new Date() : null;
    const agreementHash = null;
    const created = await tx.collaboration.create({
      data: {
        authorityVersion: "CANONICAL_V1",
        sourceApplicationId: app.id,
        brandProfileId: app.brandProfileId,
        campaignId: app.campaignId,
        campaignAssetId: app.canonicalCampaignAssetId,
        creatorUserId: owner.id,
        creatorProfileId: app.subjectCreatorProfileId,
        creatorWorkspaceId: app.subjectCreatorWorkspaceId,
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
        lifecycle: "ACTIVE",
        canonicalStage: fixed ? "SECUREMENT" : "NEGOTIATION",
        currentStageStatus: "IN_PROGRESS",
        currentStage: fixed ? "STAGE_2_SECUREMENT" : "STAGE_1_NEGOTIATION",
        aggregateVersion: 1,
        snapshot: {
          create: {
            campaignContext: snapshot.campaignContext as Prisma.InputJsonValue,
            campaignAssetContext:
              snapshot.campaignAssetContext as Prisma.InputJsonValue,
            briefContext: snapshot.briefContext as Prisma.InputJsonValue,
            applicationContext: {
              sourceApplicationId: app.id,
              approvalTransitionId: input.approvalTransitionId,
            },
            creatorContext: snapshot.creatorIdentity as Prisma.InputJsonValue,
            brandContext: { id: brand.id, name: brand.name },
            usageRights: brief.usageRights
              ? (brief.usageRights as Prisma.InputJsonValue)
              : undefined,
            creatorRequirements:
              typeof brief.creatorRequirements === "string"
                ? brief.creatorRequirements
                : null,
            receivesBrandSupport: terms.receivesBrandSupport ?? false,
            physicalDeliveryRequired,
            brandSupportType: terms.brandSupportType ?? null,
            brandSupportEstimatedValue:
              terms.brandSupportEstimatedValue == null
                ? null
                : new Prisma.Decimal(terms.brandSupportEstimatedValue),
            campaignCommercialContext:
              snapshot.commercialContext as Prisma.InputJsonValue,
            advancePercentageSnapshot: 0,
            commercialCurrency: terms.currency,
          },
        },
        commercialAgreement: {
          create: {
            id: agreementId,
            negotiationState: fixed
              ? "NOT_REQUIRED"
              : "AWAITING_CREATOR_PROPOSAL",
            applicationProposedFee: null,
            creatorProposedFee: null,
            minimumCreatorFeeSnapshot: fixed ? null : offer,
            brandCounterFee: null,
            agreedCreatorFee: fixed ? offer : null,
            currency: terms.currency,
            advancePercentageSnapshot: 0,
            paymentRail: "PLATFORM_ESCROW",
            securementState: fixed ? "AWAITING_ESCROW_FUNDING" : null,
            requiredSecuredAmount: fixed ? offer : null,
            termsLockedAt: lockedAt,
            agreementVersion: 1,
            agreementHash,
            campaignPaymentTermSnapshot: campaignPaymentTerm,
          },
        },
        fulfillment: { create: { state: "NOT_STARTED" } },
        deliverables: {
          create: deliverables.map((item, index) => ({
            sourceBriefDeliverableId: item.id,
            displayOrder: item.displayOrder ?? index,
            definitionSnapshot: JSON.parse(
              JSON.stringify(item),
            ) as Prisma.InputJsonValue,
            publishingRequired: item.legacyPublishingRequired ?? false,
            publishing: {
              create: {
                state: item.legacyPublishingRequired
                  ? "AWAITING_PUBLISHING"
                  : "PUBLISHING_NOT_REQUIRED",
                authorizationState: item.legacyPublishingRequired
                  ? "NOT_AUTHORIZED"
                  : "NOT_REQUIRED",
              },
            },
          })),
        },
        events: {
          create: {
            kind: "DOMAIN",
            eventType: "COLLABORATION_CREATED",
            actorClass: "SYSTEM",
            correlationId: input.approvalTransitionId,
            aggregateVersion: 1,
            payload: {
              sourceApplicationId: app.id,
              commercialAgreementId: agreementId,
              commercialAgreementVersion: 1,
              commercialAgreementHash: agreementHash,
              campaignPaymentTerm,
            },
          },
        },
      },
    });
    return { collaborationId: created.id, created: true };
  }
}
