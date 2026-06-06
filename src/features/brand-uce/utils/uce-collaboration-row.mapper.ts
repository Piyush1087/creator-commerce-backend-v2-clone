import type { UceCampaignCollaboration, UceCampaignBrief, UceCampaignProduct } from "@prisma/client";

import { decimalToNumber } from "./uce-decimal.util";

type CollaborationWithRelations = UceCampaignCollaboration & {
  brief: Pick<UceCampaignBrief, "internalTitle">;
  product: Pick<UceCampaignProduct, "skuCode" | "productName"> | null;
};

export function mapCollaborationRow(collab: CollaborationWithRelations) {
  const now = Date.now();
  let calculatedHoursRemainingReview: number | null = null;
  if (
    collab.currentMilestone === "STAGE_4_CONTENT_REVIEW" &&
    collab.autoApprovalDeadline72h
  ) {
    const remainingMs =
      collab.autoApprovalDeadline72h.getTime() - now;
    calculatedHoursRemainingReview =
      remainingMs > 0 ? Math.floor(remainingMs / (1000 * 60 * 60)) : 0;
  }

  let calculatedDaysOverdue: number | null = null;
  if (collab.pipelineHealth === "ACTION_OVERDUE") {
    const delayMs = now - collab.currentMilestoneDeadline.getTime();
    calculatedDaysOverdue =
      delayMs > 0 ? Math.floor(delayMs / (1000 * 60 * 60 * 24)) : 0;
  }

  return {
    collaboration_id: collab.id,
    workflow_collaboration_id: null as string | null,
    campaign_id: collab.campaignId,
    brief_id: collab.briefId,
    brief_internal_title: collab.brief.internalTitle,
    product_id: collab.productId,
    product_sku_name: collab.product
      ? `${collab.product.skuCode} — ${collab.product.productName}`
      : null,
    instagram_handle: collab.instagramHandle,
    creator_email: collab.creatorEmail,
    match_score: decimalToNumber(collab.matchScore),
    vetting_remark: collab.vettingRemark,
    rejection_reason: collab.rejectionReason,
    collab_status: collab.collabStatus,
    current_milestone: collab.currentMilestone,
    pipeline_health: collab.pipelineHealth,
    negotiation_state: collab.negotiationState,
    securement_state: collab.securementState,
    logistics_state: collab.logisticsState,
    review_state: collab.reviewState,
    publishing_state: collab.publishingState,
    negotiation_round_count: collab.negotiationRoundCount,
    fulfillment_issue_count: collab.fulfillmentIssueCount,
    revision_round_count: collab.revisionRoundCount,
    total_quote: decimalToNumber(collab.totalQuote),
    advance_30_value: decimalToNumber(collab.advance30Value),
    balance_70_value: decimalToNumber(collab.balance70Value),
    logistics_carrier: collab.logisticsCarrier,
    logistics_tracking_number: collab.logisticsTrackingNumber,
    content_draft_url: collab.contentDraftUrl,
    live_published_url: collab.livePublishedUrl,
    compliance_verified: collab.complianceVerified,
    auto_approval_deadline_72h: collab.autoApprovalDeadline72h?.toISOString() ?? null,
    current_milestone_deadline: collab.currentMilestoneDeadline.toISOString(),
    calculated_hours_remaining_review: calculatedHoursRemainingReview,
    calculated_days_overdue: calculatedDaysOverdue,
  };
}
