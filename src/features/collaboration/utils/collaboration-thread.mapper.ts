import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationFulfillmentState,
  CollaborationFeedbackAuthorRole,
  CollaborationFeedbackVisibility,
  CollaborationLifecycle,
  CollaborationMessage,
  CollaborationNegotiationState,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationSecurementState,
  CollaborationSettlementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceMilestoneStage,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import type {
  CanonicalCollaborationThreadRow,
  CollaborationAvailableAction,
  CollaborationMessageRow,
  CollaborationProjectionSource,
  CollaborationThreadRow,
  CollaborationViewerRole,
  CollaborationWorkflowProjection,
} from "../types/collaboration.types";
import { COLLABORATION_THREAD_INCLUDE } from "../services/collaboration-access.service";

export type CollaborationReadSource = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

const CANONICAL_STAGE_ORDER: CollaborationStage[] = [
  CollaborationStage.NEGOTIATION,
  CollaborationStage.SECUREMENT,
  CollaborationStage.FULFILLMENT,
  CollaborationStage.PRODUCTION,
  CollaborationStage.PUBLISHING_SETTLEMENT,
];

function projectionSource(
  row: CollaborationReadSource,
): CollaborationProjectionSource {
  return row.sourceApplicationId ? "CANONICAL" : "LEGACY_COMPATIBILITY";
}

function legacyLifecycle(row: CollaborationReadSource): CollaborationLifecycle {
  if (row.isTerminated) return CollaborationLifecycle.TERMINATED;
  if (row.isPaused) return CollaborationLifecycle.PAUSED;
  return CollaborationLifecycle.ACTIVE;
}

function legacyStage(stage: UceMilestoneStage): CollaborationStage {
  switch (stage) {
    case UceMilestoneStage.STAGE_1_NEGOTIATION:
      return CollaborationStage.NEGOTIATION;
    case UceMilestoneStage.STAGE_2_SECUREMENT:
      return CollaborationStage.SECUREMENT;
    case UceMilestoneStage.STAGE_3_LOGISTICS:
      return CollaborationStage.FULFILLMENT;
    case UceMilestoneStage.STAGE_4_CONTENT_REVIEW:
      return CollaborationStage.PRODUCTION;
    case UceMilestoneStage.STAGE_5_PUBLISHING:
    case UceMilestoneStage.STAGE_6_FEEDBACK_SYNC:
      return CollaborationStage.PUBLISHING_SETTLEMENT;
  }
}

function effectiveLifecycle(
  row: CollaborationReadSource,
): CollaborationLifecycle {
  return projectionSource(row) === "CANONICAL"
    ? row.lifecycle
    : legacyLifecycle(row);
}

function effectiveStage(row: CollaborationReadSource): CollaborationStage {
  return projectionSource(row) === "CANONICAL"
    ? row.canonicalStage
    : legacyStage(row.currentStage);
}

function deriveProductionActor(
  deliverables: CollaborationReadSource["deliverables"],
): CollaborationActorClass | "NONE" {
  const creatorRequired = deliverables.some(
    (item) =>
      item.state === CollaborationDeliverableState.AWAITING_SUBMISSION ||
      item.state === CollaborationDeliverableState.REVISION_REQUESTED,
  );
  const brandRequired = deliverables.some(
    (item) => item.state === CollaborationDeliverableState.UNDER_REVIEW,
  );
  if (creatorRequired && brandRequired) return "NONE";
  if (creatorRequired) return CollaborationActorClass.CREATOR;
  if (brandRequired) return CollaborationActorClass.BRAND;
  return "NONE";
}

function deliverableActions(
  state: CollaborationDeliverableState,
  revisionRequestCount: number,
  viewerRole: CollaborationViewerRole,
): CollaborationAvailableAction[] {
  if (
    viewerRole === "CREATOR" &&
    (state === CollaborationDeliverableState.AWAITING_SUBMISSION ||
      state === CollaborationDeliverableState.REVISION_REQUESTED)
  ) {
    return ["SubmitDeliverable"];
  }
  if (
    viewerRole === "BRAND" &&
    state === CollaborationDeliverableState.UNDER_REVIEW
  ) {
    return revisionRequestCount < 2
      ? ["ApproveDeliverable", "RequestDeliverableRevision"]
      : ["ApproveDeliverable", "RejectFinalDeliverable"];
  }
  return [];
}

function deliverableActionRequiredBy(state: CollaborationDeliverableState) {
  if (
    state === CollaborationDeliverableState.AWAITING_SUBMISSION ||
    state === CollaborationDeliverableState.REVISION_REQUESTED
  )
    return CollaborationActorClass.CREATOR;
  if (state === CollaborationDeliverableState.UNDER_REVIEW)
    return CollaborationActorClass.BRAND;
  return "NONE" as const;
}

function publishingActionRequiredBy(
  item: CollaborationReadSource["deliverables"][number],
) {
  const publishing = item.publishing;
  if (!publishing) return "NONE" as const;
  if (
    item.state === CollaborationDeliverableState.AUTO_APPROVED &&
    publishing.authorizationState ===
      CollaborationPublicationAuthorizationState.NOT_AUTHORIZED
  )
    return CollaborationActorClass.BRAND;
  if (
    publishing.authorizationState ===
      CollaborationPublicationAuthorizationState.AUTHORIZED &&
    (publishing.state === CollaborationPublishingState.AWAITING_PUBLISHING ||
      publishing.state === CollaborationPublishingState.CORRECTION_REQUIRED)
  )
    return CollaborationActorClass.CREATOR;
  if (publishing.state === CollaborationPublishingState.EVIDENCE_SUBMITTED)
    return CollaborationActorClass.BRAND;
  if (publishing.state === CollaborationPublishingState.BLOCKED)
    return CollaborationActorClass.ADMIN;
  return "NONE" as const;
}

function publishingActions(
  item: CollaborationReadSource["deliverables"][number],
  viewerRole: CollaborationViewerRole,
): CollaborationAvailableAction[] {
  const actor = publishingActionRequiredBy(item);
  if (viewerRole === "BRAND" && actor === CollaborationActorClass.BRAND) {
    if (
      item.state === CollaborationDeliverableState.AUTO_APPROVED &&
      item.publishing?.authorizationState ===
        CollaborationPublicationAuthorizationState.NOT_AUTHORIZED
    )
      return ["AuthorizePublishing", "DeclinePublishing"];
    if (
      item.publishing?.state === CollaborationPublishingState.EVIDENCE_SUBMITTED
    )
      return ["VerifyPublishing", "RequestPublishingCorrection"];
  }
  if (viewerRole === "CREATOR" && actor === CollaborationActorClass.CREATOR) {
    return item.publishing?.state ===
      CollaborationPublishingState.CORRECTION_REQUIRED
      ? ["SubmitCorrectedPublishingEvidence"]
      : ["SubmitPublishingEvidence"];
  }
  return [];
}

function derivePublishingActor(
  deliverables: CollaborationReadSource["deliverables"],
): CollaborationActorClass | "NONE" {
  const actors = new Set(
    deliverables
      .map(publishingActionRequiredBy)
      .filter((actor) => actor !== "NONE"),
  );
  return actors.size === 1 ? [...actors][0] : "NONE";
}

export function deriveActionRequiredBy(
  row: CollaborationReadSource,
): CollaborationActorClass | "NONE" {
  const lifecycle = effectiveLifecycle(row);
  if (projectionSource(row) === "LEGACY_COMPATIBILITY") return "NONE";
  if (
    row.settlement &&
    (row.settlement.state === CollaborationSettlementState.ELIGIBLE ||
      row.settlement.state === CollaborationSettlementState.PROCESSING)
  )
    return CollaborationActorClass.SYSTEM;
  if (row.settlement?.state === CollaborationSettlementState.BLOCKED)
    return CollaborationActorClass.ADMIN;
  if (lifecycle !== CollaborationLifecycle.ACTIVE) return "NONE";

  switch (row.canonicalStage) {
    case CollaborationStage.NEGOTIATION:
      if (
        row.commercialAgreement?.negotiationState ===
        CollaborationNegotiationState.AWAITING_BRAND_DECISION
      ) {
        return CollaborationActorClass.BRAND;
      }
      if (
        row.commercialAgreement?.negotiationState ===
        CollaborationNegotiationState.AWAITING_CREATOR_DECISION
      ) {
        return CollaborationActorClass.CREATOR;
      }
      return "NONE";
    case CollaborationStage.SECUREMENT:
      switch (row.commercialAgreement?.securementState) {
        case CollaborationSecurementState.AWAITING_ESCROW_FUNDING:
        case CollaborationSecurementState.AWAITING_BRAND_PAYMENT:
          return CollaborationActorClass.BRAND;
        case CollaborationSecurementState.PROCESSING_FUNDING:
          return CollaborationActorClass.SYSTEM;
        case CollaborationSecurementState.AWAITING_CREATOR_CONFIRMATION:
        case CollaborationSecurementState.AWAITING_PAYOUT_DETAILS:
          return CollaborationActorClass.CREATOR;
        case CollaborationSecurementState.PAYMENT_DISPUTED:
        case CollaborationSecurementState.BLOCKED:
          return CollaborationActorClass.ADMIN;
        default:
          return "NONE";
      }
    case CollaborationStage.FULFILLMENT:
      switch (row.fulfillment?.state) {
        case CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT:
        case CollaborationFulfillmentState.REMEDIATION_REQUIRED:
          return CollaborationActorClass.BRAND;
        case CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION:
          return CollaborationActorClass.CREATOR;
        case CollaborationFulfillmentState.BLOCKED:
          return CollaborationActorClass.ADMIN;
        default:
          return "NONE";
      }
    case CollaborationStage.PRODUCTION:
      return deriveProductionActor(row.deliverables);
    case CollaborationStage.PUBLISHING_SETTLEMENT:
      return derivePublishingActor(row.deliverables);
  }
}

function workflowProjection(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
): CollaborationWorkflowProjection {
  return {
    stage: effectiveStage(row),
    status:
      projectionSource(row) === "CANONICAL"
        ? row.currentStageStatus
        : CollaborationStageStatus.IN_PROGRESS,
    actionRequiredBy: deriveActionRequiredBy(row),
    availableActions: deriveAvailableActions(row, viewerRole),
    aggregateVersion: row.aggregateVersion,
  };
}

export function deriveAvailableActions(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
): CollaborationAvailableAction[] {
  const actions: CollaborationAvailableAction[] = [];
  if (effectiveLifecycle(row) === CollaborationLifecycle.ACTIVE) {
    actions.push("PostCollaborationMessage");
  }
  if (
    projectionSource(row) === "CANONICAL" &&
    row.lifecycle === CollaborationLifecycle.COMPLETED
  ) {
    const authorRole =
      viewerRole === "BRAND"
        ? CollaborationFeedbackAuthorRole.BRAND
        : CollaborationFeedbackAuthorRole.CREATOR;
    if (
      row.feedbackWindow?.visibility ===
        CollaborationFeedbackVisibility.HIDDEN &&
      Date.now() < row.feedbackWindow.closesAt.getTime() &&
      !row.feedback.some((item) => item.authorRole === authorRole)
    )
      actions.push("SubmitCollaborationFeedback");
    return actions;
  }
  if (
    projectionSource(row) !== "CANONICAL" ||
    row.lifecycle !== CollaborationLifecycle.ACTIVE
  )
    return actions;

  if (
    row.canonicalStage === CollaborationStage.NEGOTIATION &&
    row.commercialAgreement?.negotiationState ===
      CollaborationNegotiationState.AWAITING_BRAND_DECISION &&
    viewerRole === "BRAND"
  ) {
    actions.push("AcceptProposedFee", "CounterOffer", "DeclineNegotiation");
  } else if (
    row.canonicalStage === CollaborationStage.NEGOTIATION &&
    row.commercialAgreement?.negotiationState ===
      CollaborationNegotiationState.AWAITING_CREATOR_DECISION &&
    viewerRole === "CREATOR"
  ) {
    actions.push("AcceptCounterOffer", "DeclineNegotiation");
  } else if (row.canonicalStage === CollaborationStage.SECUREMENT) {
    const state = row.commercialAgreement?.securementState;
    if (
      viewerRole === "BRAND" &&
      state === CollaborationSecurementState.AWAITING_ESCROW_FUNDING
    )
      actions.push("RequestEscrowFunding");
    // MANUAL remains a supported internal capability but is deliberately not
    // advertised to ordinary MVP Brand/Creator clients.
  } else if (row.canonicalStage === CollaborationStage.FULFILLMENT) {
    const state = row.fulfillment?.state;
    if (
      viewerRole === "BRAND" &&
      state === CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT
    ) {
      actions.push("ProvideFulfillment");
    } else if (
      viewerRole === "CREATOR" &&
      state === CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION
    ) {
      actions.push("ConfirmFulfillment", "ReportFulfillmentIssue");
    } else if (
      viewerRole === "BRAND" &&
      state === CollaborationFulfillmentState.REMEDIATION_REQUIRED
    ) {
      actions.push("ProvideFulfillmentRemediation");
    }
  } else if (row.canonicalStage === CollaborationStage.PRODUCTION) {
    for (const deliverable of row.deliverables) {
      for (const action of deliverableActions(
        deliverable.state,
        deliverable.revisionRequestCount,
        viewerRole,
      )) {
        if (!actions.includes(action)) actions.push(action);
      }
    }
  } else if (row.canonicalStage === CollaborationStage.PUBLISHING_SETTLEMENT) {
    for (const deliverable of row.deliverables) {
      for (const action of publishingActions(deliverable, viewerRole)) {
        if (!actions.includes(action)) actions.push(action);
      }
    }
  }

  const brandHasSpecificPublishingDecision = (row.deliverables ?? []).some(
    (deliverable) =>
      deliverable.publishingRequired &&
      deliverable.state === CollaborationDeliverableState.AUTO_APPROVED &&
      deliverable.publishing?.authorizationState ===
        CollaborationPublicationAuthorizationState.NOT_AUTHORIZED,
  );
  if (
    row.currentStageStatus !== CollaborationStageStatus.BLOCKED &&
    row.canonicalStage !== CollaborationStage.NEGOTIATION
  ) {
    if (viewerRole === "CREATOR") {
      actions.push("CancelCollaborationByCreator");
    } else if (!brandHasSpecificPublishingDecision) {
      actions.push("EndCollaborationByBrand");
    }
  }
  return actions;
}

function creatorSummary(row: CollaborationReadSource) {
  const profile = row.creatorUser.creatorProfile;
  return {
    id: row.creatorUserId,
    displayName: profile?.displayName ?? row.creatorUser.name,
    handle:
      profile?.instagramHandle ?? row.creatorUser.email.split("@")[0] ?? null,
  };
}

function brandSummary(row: CollaborationReadSource) {
  return { id: row.brandProfileId, displayName: row.brandProfile.name };
}

function sourceContext(row: CollaborationReadSource) {
  return {
    campaign: { id: row.campaignId, name: row.campaign.name },
    campaignAsset: row.product
      ? {
          id: row.product.id,
          name: row.product.productName,
          type: row.product.assetType,
          skuCode: row.product.skuCode,
          imageUrl: row.product.imageUrl,
        }
      : null,
    brief: {
      id: row.briefId,
      title: row.brief.internalTitle,
      creativeGuidelines: row.brief.creativeGuidelines,
    },
  };
}

function blockingProjection(row: CollaborationReadSource) {
  if (effectiveLifecycle(row) === CollaborationLifecycle.PAUSED) {
    return { category: "PAUSED", reason: null };
  }
  if (row.settlement?.state === CollaborationSettlementState.BLOCKED) {
    return {
      category: "SETTLEMENT_BLOCKED",
      reason: row.settlement.blockedReason,
    };
  }
  if (row.currentStageStatus === CollaborationStageStatus.BLOCKED) {
    return {
      category: "WORKFLOW_BLOCKED",
      reason:
        row.commercialAgreement?.securementState ===
        CollaborationSecurementState.PAYMENT_DISPUTED
          ? "PAYMENT_DISPUTED"
          : null,
    };
  }
  return null;
}

function legacyCompatibility(row: CollaborationReadSource) {
  return projectionSource(row) === "LEGACY_COMPATIBILITY"
    ? {
        applied: true as const,
        reason: "MISSING_SOURCE_APPLICATION" as const,
        fields: ["lifecycle", "workflow"] as Array<"lifecycle" | "workflow">,
      }
    : null;
}

export function projectCanonicalCollaborationThreadRow(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
): CanonicalCollaborationThreadRow {
  const creator = creatorSummary(row);
  const brand = brandSummary(row);
  const stage = effectiveStage(row);

  return {
    collaborationId: row.id,
    projectionSource: projectionSource(row),
    counterpart:
      viewerRole === "BRAND"
        ? { ...creator, kind: "CREATOR" }
        : { ...brand, handle: null, kind: "BRAND" },
    sourceContext: {
      campaign: sourceContext(row).campaign,
      campaignAsset: sourceContext(row).campaignAsset,
      brief: {
        id: row.briefId,
        title: row.brief.internalTitle,
      },
    },
    lifecycle: effectiveLifecycle(row),
    workflow: workflowProjection(row, viewerRole),
    blocking: blockingProjection(row),
    resolution: null,
    inbox: {
      unreadCount:
        viewerRole === "BRAND" ? row.unreadCountBrand : row.unreadCountCreator,
      lastMessageSnippet: row.lastMessageSnippet,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    },
    progress: {
      stageIndex: CANONICAL_STAGE_ORDER.indexOf(stage) + 1,
      stageCount: 5,
    },
    updatedAt: row.updatedAt.toISOString(),
    legacyCompatibility: legacyCompatibility(row),
  };
}

function feedbackRecord(
  item: CollaborationReadSource["feedback"][number] | undefined,
) {
  return item
    ? {
        authorRole: item.authorRole,
        rating: item.rating,
        reviewText: item.reviewText,
        submittedAt: item.submittedAt.toISOString(),
      }
    : null;
}

function feedbackProjection(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
) {
  if (!row.feedbackWindow) return null;
  const viewerAuthorRole =
    viewerRole === "BRAND"
      ? CollaborationFeedbackAuthorRole.BRAND
      : CollaborationFeedbackAuthorRole.CREATOR;
  const counterpartAuthorRole =
    viewerAuthorRole === CollaborationFeedbackAuthorRole.BRAND
      ? CollaborationFeedbackAuthorRole.CREATOR
      : CollaborationFeedbackAuthorRole.BRAND;
  const viewer = row.feedback.find(
    (item) => item.authorRole === viewerAuthorRole,
  );
  const counterpart = row.feedback.find(
    (item) => item.authorRole === counterpartAuthorRole,
  );
  const revealed =
    row.feedbackWindow.visibility === CollaborationFeedbackVisibility.REVEALED;
  return {
    visibility: row.feedbackWindow.visibility,
    windowOpenedAt: row.feedbackWindow.openedAt.toISOString(),
    revealDeadlineAt: row.feedbackWindow.closesAt.toISOString(),
    revealedAt: row.feedbackWindow.revealedAt?.toISOString() ?? null,
    viewerSubmission: feedbackRecord(viewer),
    counterpartSubmitted: Boolean(counterpart),
    counterpartSubmission: revealed ? feedbackRecord(counterpart) : null,
    revealedSubmissions: revealed
      ? {
          brand: feedbackRecord(
            row.feedback.find(
              (item) =>
                item.authorRole === CollaborationFeedbackAuthorRole.BRAND,
            ),
          ),
          creator: feedbackRecord(
            row.feedback.find(
              (item) =>
                item.authorRole === CollaborationFeedbackAuthorRole.CREATOR,
            ),
          ),
        }
      : null,
  };
}

export function projectCanonicalCollaborationDetail(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
) {
  const agreement = row.commercialAgreement;
  const snapshot = row.snapshot;
  const workflow = workflowProjection(row, viewerRole);
  const publishingComplete = row.deliverables.every(
    (item) =>
      (!item.publishingRequired &&
        item.publishing?.state ===
          CollaborationPublishingState.PUBLISHING_NOT_REQUIRED) ||
      (item.publishingRequired &&
        item.publishing?.state ===
          CollaborationPublishingState.COMPLIANCE_VERIFIED),
  );
  const deliverables = row.deliverables.map((item) => {
    const submissions = item.submissions ?? [];
    const latestSubmission = submissions.at(-1) ?? null;
    const submissionVersions = submissions.map((submission) => ({
      submissionVersionId: submission.id,
      versionNumber: submission.versionNumber,
      assetRef: submission.assetRef,
      creatorNote: submission.creatorNote,
      submissionMetadata: submission.submissionMetadata,
      submittedAt: submission.submittedAt.toISOString(),
      reviewDeadlineAt: submission.reviewDeadlineAt.toISOString(),
      reviewState: submission.reviewState,
      brandFeedback: submission.brandFeedback,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      autoApprovedAt: submission.autoApprovedAt?.toISOString() ?? null,
      supersededAt: submission.supersededAt?.toISOString() ?? null,
    }));
    const publishingEvidenceHistory = (
      item.publishing?.evidenceHistory ?? []
    ).map((evidence) => ({
      publishingEvidenceId: evidence.id,
      sequence: evidence.sequence,
      evidenceRef: evidence.evidenceRef,
      platform: evidence.platform,
      creatorNote: evidence.creatorNote,
      evidenceMetadata: evidence.evidenceMetadata,
      submittedAt: evidence.submittedAt.toISOString(),
      correctionReason: evidence.correctionReason,
      reviewedAt: evidence.reviewedAt?.toISOString() ?? null,
      complianceEvidenceRef: evidence.complianceEvidenceRef,
      verifiedAt: evidence.verifiedAt?.toISOString() ?? null,
    }));
    return {
      deliverableExecutionId: item.id,
      sourceBriefDeliverableId: item.sourceBriefDeliverableId,
      definitionSnapshot: item.definitionSnapshot,
      displayOrder: item.displayOrder,
      state: item.state,
      revisionRequestCount: item.revisionRequestCount,
      revisionsRemaining: Math.max(0, 2 - item.revisionRequestCount),
      publishingRequired: item.publishingRequired,
      actionRequiredBy:
        row.canonicalStage === CollaborationStage.PUBLISHING_SETTLEMENT
          ? publishingActionRequiredBy(item)
          : deliverableActionRequiredBy(item.state),
      activeSubmissionVersionId:
        item.state === CollaborationDeliverableState.UNDER_REVIEW
          ? (latestSubmission?.id ?? null)
          : null,
      latestSubmissionVersion: latestSubmission
        ? (submissionVersions.at(-1) ?? null)
        : null,
      submissionVersions,
      productionApprovalState: item.state,
      approvedAt: item.approvedAt?.toISOString() ?? null,
      autoApprovedAt: item.autoApprovedAt?.toISOString() ?? null,
      hardStoppedAt: item.hardStoppedAt?.toISOString() ?? null,
      publishing: item.publishing
        ? {
            state: item.publishing.state,
            authorizationState: item.publishing.authorizationState,
            authorizedAt: item.publishing.authorizedAt?.toISOString() ?? null,
            evidenceHistory: publishingEvidenceHistory,
            activeEvidence: publishingEvidenceHistory.at(-1) ?? null,
            correctionReason:
              publishingEvidenceHistory.at(-1)?.correctionReason ?? null,
            complianceVerifiedAt:
              item.publishing.complianceVerifiedAt?.toISOString() ?? null,
            blockedReason: item.publishing.blockedReason,
          }
        : null,
      availableActions:
        row.canonicalStage === CollaborationStage.PUBLISHING_SETTLEMENT
          ? publishingActions(item, viewerRole)
          : deliverableActions(
              item.state,
              item.revisionRequestCount,
              viewerRole,
            ),
    };
  });

  return {
    projectionSource: projectionSource(row),
    identity: {
      collaborationId: row.id,
      sourceApplicationId: row.sourceApplicationId,
      campaignId: row.campaignId,
      campaignCreatorId: row.campaignCreatorId,
      campaignAssetId: row.campaignAssetId,
      briefId: row.briefId,
      brand: brandSummary(row),
      creator: creatorSummary(row),
    },
    sourceContext: {
      ...sourceContext(row),
      executionSnapshot: snapshot
        ? {
            campaign: snapshot.campaignContext,
            campaignAsset: snapshot.campaignAssetContext,
            brief: snapshot.briefContext,
            application: snapshot.applicationContext,
            creator: snapshot.creatorContext,
            brand: snapshot.brandContext,
            usageRights: snapshot.usageRights,
            creatorRequirements: snapshot.creatorRequirements,
            lockedAt: snapshot.lockedAt.toISOString(),
          }
        : null,
    },
    lifecycle: {
      state: effectiveLifecycle(row),
      completedAt: row.completedAt?.toISOString() ?? null,
      endedFromStage: row.endedFromStage,
      endedReason: row.endedReasonCode
        ? { code: row.endedReasonCode, text: row.endedReasonText }
        : null,
      endedByActorClass: row.endedByActorClass,
      endedByUserId: row.endedByUserId,
      endedAt: row.endedAt?.toISOString() ?? null,
    },
    workflow,
    commercial: agreement
      ? {
          negotiationState: agreement.negotiationState,
          applicationProposedFee: decimalOrNull(
            agreement.applicationProposedFee,
          ),
          brandCounterFee: decimalOrNull(agreement.brandCounterFee),
          agreedCreatorFee: decimalOrNull(agreement.agreedCreatorFee),
          currency: agreement.currency,
          advancePercentage: agreement.advancePercentageSnapshot,
          advanceAmount: decimalOrNull(agreement.advanceAmount),
          balanceAmount: decimalOrNull(agreement.balanceAmount),
          pricingTierSnapshot: agreement.pricingTierSnapshot,
          businessCountryCodeSnapshot: agreement.businessCountryCodeSnapshot,
          financialPolicyVersionSnapshot:
            agreement.financialPolicyVersionSnapshot,
          platformCommissionRate: decimalOrNull(
            agreement.platformCommissionRateSnapshot,
          ),
          platformCommissionAmount: decimalOrNull(
            agreement.platformCommissionAmount,
          ),
          platformCommissionGstRate: decimalOrNull(
            agreement.platformCommissionGstRateSnapshot,
          ),
          platformCommissionGstAmount: decimalOrNull(
            agreement.platformCommissionGstAmount,
          ),
          nonCashConsideration: agreement.nonCashConsideration,
          termsLocked: agreement.termsLockedAt !== null,
          termsLockedAt: agreement.termsLockedAt?.toISOString() ?? null,
        }
      : null,
    securement: agreement
      ? {
          paymentRail: agreement.paymentRail,
          state: agreement.securementState,
          requiredSecuredAmount: decimalOrNull(agreement.requiredSecuredAmount),
          confirmedSecuredAmount: decimalOrNull(
            agreement.confirmedSecuredAmount,
          ),
          currency: agreement.currency,
          escrowLockRef: agreement.escrowLockRef,
        }
      : null,
    fulfillment: row.fulfillment
      ? {
          applies: snapshot?.receivesBrandSupport ?? null,
          brandSupportType: snapshot?.brandSupportType ?? null,
          brandSupportEstimatedValue: decimalOrNull(
            snapshot?.brandSupportEstimatedValue,
          ),
          state: row.fulfillment.state,
          issueCount: row.fulfillment.issueCount,
          evidence: {
            shipmentTrackingRef: row.fulfillment.shipmentTrackingRef,
            courierName: row.fulfillment.courierName,
            accessEvidenceRef: row.fulfillment.accessEvidenceRef,
            redemptionCode: row.fulfillment.redemptionCode,
            serviceEvidenceRef: row.fulfillment.serviceEvidenceRef,
            genericFulfillmentEvidence:
              row.fulfillment.genericFulfillmentEvidence,
            brandFulfilledAt:
              row.fulfillment.brandFulfilledAt?.toISOString() ?? null,
          },
          confirmation: {
            creatorConfirmedAt:
              row.fulfillment.creatorConfirmedAt?.toISOString() ?? null,
            completedAt: row.fulfillment.completedAt?.toISOString() ?? null,
            hardStoppedAt: row.fulfillment.hardStoppedAt?.toISOString() ?? null,
          },
          issues: (row.fulfillment.issues ?? []).map((issue) => ({
            sequence: issue.sequence,
            issueCode: issue.issueCode,
            description: issue.description,
            evidenceRef: issue.evidenceRef,
            reportedAt: issue.reportedAt.toISOString(),
            remediationEvidenceRef: issue.remediationEvidenceRef,
            remediationAt: issue.remediationAt?.toISOString() ?? null,
          })),
        }
      : null,
    deliverables,
    publishing: deliverables.map((item) => ({
      deliverableExecutionId: item.deliverableExecutionId,
      publishingRequired: item.publishingRequired,
      ...item.publishing,
    })),
    publishingComplete,
    settlement: row.settlement
      ? {
          state: row.settlement.state,
          eligibleAt: row.settlement.eligibleAt?.toISOString() ?? null,
          processingAt: row.settlement.processingAt?.toISOString() ?? null,
          creatorSettlementAmount: decimalOrNull(
            row.settlement.creatorSettlementAmount,
          ),
          brandRefundAmount: decimalOrNull(row.settlement.brandRefundAmount),
          currency: row.settlement.currency,
          payoutInstructionRef: row.settlement.payoutInstructionRef,
          creatorPayoutState: row.settlement.creatorPayoutState,
          payoutExecutionRef: row.settlement.payoutExecutionRef,
          brandRefundState: row.settlement.brandRefundState,
          refundExecutionRef: row.settlement.refundExecutionRef,
          settledAt: row.settlement.settledAt?.toISOString() ?? null,
          blockedAt: row.settlement.blockedAt?.toISOString() ?? null,
          blockedReason: row.settlement.blockedReason,
          residualSettlementPending:
            row.settlement.state !== CollaborationSettlementState.SETTLED,
          actionRequiredBy:
            row.settlement.state === CollaborationSettlementState.ELIGIBLE ||
            row.settlement.state === CollaborationSettlementState.PROCESSING
              ? CollaborationActorClass.SYSTEM
              : "NONE",
        }
      : {
          state: CollaborationSettlementState.NOT_ELIGIBLE,
          actionRequiredBy: "NONE",
          residualSettlementPending: false,
        },
    resolution: row.financialResolution
      ? {
          status: row.financialResolution.status,
          outcome: row.financialResolution.outcome,
          creatorEntitlementAmount: decimalOrNull(
            row.financialResolution.creatorEntitlementAmount,
          ),
          brandRefundEntitlementAmount: decimalOrNull(
            row.financialResolution.brandRefundEntitlementAmount,
          ),
          creatorGrossEntitlementAmount: decimalOrNull(
            row.financialResolution.creatorGrossEntitlementAmount,
          ),
          creatorCommercialRefundAmount: decimalOrNull(
            row.financialResolution.creatorCommercialRefundAmount,
          ),
          platformCommissionRetainedAmount: decimalOrNull(
            row.financialResolution.platformCommissionRetainedAmount,
          ),
          platformCommissionRefundAmount: decimalOrNull(
            row.financialResolution.platformCommissionRefundAmount,
          ),
          platformCommissionGstRetainedAmount: decimalOrNull(
            row.financialResolution.platformCommissionGstRetainedAmount,
          ),
          platformCommissionGstRefundAmount: decimalOrNull(
            row.financialResolution.platformCommissionGstRefundAmount,
          ),
          brandCommercialRefundEntitlementAmount: decimalOrNull(
            row.financialResolution.brandCommercialRefundEntitlementAmount,
          ),
          currency: row.financialResolution.currency,
          reasonCode: row.financialResolution.reasonCode,
          reasonText: row.financialResolution.reasonText,
          residualObligations: row.financialResolution.residualObligations,
          decidedByActorClass: row.financialResolution.decidedByActorClass,
          decidedAt: row.financialResolution.decidedAt?.toISOString() ?? null,
          resolvedAt: row.financialResolution.resolvedAt?.toISOString() ?? null,
          residualSettlementPending:
            row.settlement?.state !== CollaborationSettlementState.SETTLED &&
            effectiveLifecycle(row) !== CollaborationLifecycle.ACTIVE,
        }
      : null,
    feedback: feedbackProjection(row, viewerRole),
    blocking: blockingProjection(row),
    inbox: {
      unreadCount:
        viewerRole === "BRAND" ? row.unreadCountBrand : row.unreadCountCreator,
      lastMessageSnippet: row.lastMessageSnippet,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    },
    legacyCompatibility: legacyCompatibility(row),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapCollaborationThreadRow(
  row: CollaborationReadSource,
  viewerRole: CollaborationViewerRole,
): CollaborationThreadRow {
  const creator = creatorSummary(row);
  return {
    collaboration_id: row.id,
    brand_profile_id: row.brandProfileId,
    creator_user_id: row.creatorUserId,
    campaign_id: row.campaignId,
    campaign_name: row.campaign.name,
    brief_id: row.briefId,
    brief_title: row.brief.internalTitle,
    creator_display_name: creator.displayName,
    creator_handle: creator.handle,
    brand_name: row.brandProfile.name,
    current_stage: row.currentStage,
    payout_mode: row.payoutMode,
    industry: row.industry,
    negotiation_round: row.negotiationRound,
    fulfillment_issue_count: row.fulfillmentIssueCount,
    revision_count: row.revisionCount,
    unread_count:
      viewerRole === "BRAND" ? row.unreadCountBrand : row.unreadCountCreator,
    last_message_snippet: row.lastMessageSnippet,
    last_message_at: row.lastMessageAt?.toISOString() ?? null,
    is_paused: row.isPaused,
    is_terminated: row.isTerminated,
  };
}

export function mapCollaborationDetail(row: CollaborationReadSource) {
  const commercials = row.commercials;
  const creator = creatorSummary(row);
  const finalQuote = decimalOrNull(commercials?.finalQuote);
  const brandCounter = decimalOrNull(commercials?.brandCounterOffer);
  const initialQuote = decimalOrNull(commercials?.initialQuote) ?? 0;

  return {
    thread: {
      id: row.id,
      currentStage: row.currentStage,
      payoutMode: row.payoutMode,
      industry: row.industry,
      negotiationRound: row.negotiationRound,
      fulfillmentIssueCount: row.fulfillmentIssueCount,
      revisionCount: row.revisionCount,
      isTerminated: row.isTerminated,
      isPaused: row.isPaused,
      campaign: { name: row.campaign.name },
      brief: {
        internalTitle: row.brief.internalTitle,
        creativeGuidelines: row.brief.creativeGuidelines,
      },
      brandProfile: { name: row.brandProfile.name },
      creatorUser: {
        name: row.creatorUser.name,
        email: row.creatorUser.email,
        creatorProfile: row.creatorUser.creatorProfile,
      },
      creatorHandle: creator.handle,
    },
    commercials: commercials
      ? {
          initial_quote: initialQuote,
          brand_counter_offer: brandCounter,
          final_quote: finalQuote ?? 0,
          product_retail_value:
            decimalOrNull(commercials.productRetailValue) ?? 0,
          is_final_offer: commercials.isFinalOffer,
          advance_30_amount: decimalOrNull(commercials.advance30Amount) ?? 0,
          balance_70_amount: decimalOrNull(commercials.balance70Amount) ?? 0,
          total_quote: finalQuote ?? brandCounter ?? initialQuote,
          escrow_status: commercials.escrowStatus,
          advance_receipt_url: commercials.advanceReceiptUrl,
          creator_bank_details_id: commercials.creatorBankDetailsId,
        }
      : null,
    logistics: row.logistics
      ? {
          trackingId: row.logistics.trackingId,
          courierName: row.logistics.courierName,
          digitalAccessCredentials: row.logistics.digitalAccessCredentials,
          redemptionCode: row.logistics.redemptionCode,
          isReceivedConfirmed: row.logistics.isReceivedConfirmed,
          lastReportedIssue: row.logistics.lastReportedIssue,
          issueDescription: row.logistics.issueDescription,
        }
      : null,
    finalization: row.finalization
      ? {
          livePostUrl: row.finalization.livePostUrl,
          isComplianceVerified: row.finalization.isComplianceVerified,
          brandRating: row.finalization.brandRating,
          creatorRating: row.finalization.creatorRating,
          brandReviewText: row.finalization.brandReviewText,
          creatorReviewText: row.finalization.creatorReviewText,
          reviewsVisible: row.finalization.reviewsVisible,
        }
      : null,
    media: row.media.map((item) => ({
      id: item.id,
      phase: item.phase,
      status: item.status,
      mediaUrl: item.mediaUrl,
      versionNumber: item.versionNumber,
      brandFeedback: item.brandFeedback,
    })),
  };
}

function decimalOrNull(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : decimalToNumber(value);
}

export function mapMessageRow(
  msg: CollaborationMessage,
): CollaborationMessageRow {
  return {
    message_id: msg.id,
    kind: msg.kind,
    body: msg.body,
    sender_user_id: msg.senderUserId,
    system_event_tag: msg.systemEventTag,
    created_at: msg.createdAt.toISOString(),
  };
}

export function toDecimal(value: number): Decimal {
  return new Decimal(value.toFixed(2));
}
