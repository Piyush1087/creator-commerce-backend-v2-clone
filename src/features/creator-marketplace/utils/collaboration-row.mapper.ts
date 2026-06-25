import {
  UceCollabStatus,
  UceLogisticsSubState,
  UceMilestoneStage,
  UceReviewSubState,
  type UceCampaignCollaboration,
} from "@prisma/client";

import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";

type CollabWithRelations = UceCampaignCollaboration & {
  campaign: {
    name: string;
    brandProfile: { name: string; logoUrl: string | null };
    strategy: {
      platformDeliverables: unknown;
    } | null;
  };
  brief: { internalTitle: string; deliverableFormatTags: string[] };
  product: { productName: string } | null;
};

export function mapContentFormat(collab: CollabWithRelations): string | null {
  const tags = collab.brief.deliverableFormatTags;
  if (tags.length > 0) {
    return tags.join(", ");
  }
  const deliverables = collab.campaign.strategy?.platformDeliverables;
  if (Array.isArray(deliverables) && deliverables.length > 0) {
    const first = deliverables[0] as { platform?: string; formats?: string[] };
    if (first.platform && first.formats?.length) {
      return `${first.platform} ${first.formats[0]}`;
    }
    if (first.platform) return first.platform;
  }
  return null;
}

export function mapActiveMilestone(collab: CollabWithRelations): {
  milestone_label: string | null;
  milestone_subtext: string | null;
  cta_label: string | null;
  cta_variant: "primary" | "outline" | "ghost" | "disabled" | null;
} {
  if (collab.collabStatus !== UceCollabStatus.ACTIVE_WORKFLOW) {
    return {
      milestone_label: null,
      milestone_subtext: null,
      cta_label: null,
      cta_variant: null,
    };
  }

  switch (collab.currentMilestone) {
    case UceMilestoneStage.STAGE_3_LOGISTICS:
      if (collab.logisticsState === UceLogisticsSubState.IN_TRANSIT) {
        const carrier = collab.logisticsCarrier?.trim() || null;
        const tracking = collab.logisticsTrackingNumber?.trim() || null;
        return {
          milestone_label: "Sample Status: In Transit",
          milestone_subtext:
            carrier || tracking
              ? `Courier: ${carrier ?? "-"} | Tracking: ${tracking ?? "-"}`
              : null,
          cta_label: "Track Package",
          cta_variant: "outline",
        };
      }
      return {
        milestone_label: "Logistics: Awaiting Dispatch",
        milestone_subtext: null,
        cta_label: "Confirm Delivery Receipt",
        cta_variant: "primary",
      };
    case UceMilestoneStage.STAGE_4_CONTENT_REVIEW:
      if (collab.reviewState === UceReviewSubState.REVISION_ROUND_ACTIVE) {
        return {
          milestone_label: "Revision Loop: Fix Required",
          milestone_subtext: null,
          cta_label: "View Fix Requirements",
          cta_variant: "primary",
        };
      }
      if (collab.contentDraftUrl) {
        return {
          milestone_label: "Content Security Review: Awaiting Brand Action",
          milestone_subtext: null,
          cta_label: "Lock Content for Review",
          cta_variant: "disabled",
        };
      }
      return {
        milestone_label: "Production Runway: Content Drafting",
        milestone_subtext: collab.currentMilestoneDeadline
          ? `Deadline: ${collab.currentMilestoneDeadline.toISOString()}`
          : null,
        cta_label: "Submit Draft",
        cta_variant: "primary",
      };
    case UceMilestoneStage.STAGE_5_PUBLISHING:
      return {
        milestone_label: "Distribution Track: Active & Scraping",
        milestone_subtext: collab.livePublishedUrl ? collab.livePublishedUrl : null,
        cta_label: "View Live Telemetry",
        cta_variant: "ghost",
      };
    default:
      return {
        milestone_label: `Active: ${collab.currentMilestone}`,
        milestone_subtext: null,
        cta_label: "Open Collaboration",
        cta_variant: "outline",
      };
  }
}

export function mapPendingStatus(collab: CollabWithRelations): {
  status_label: string | null;
  context_copy: string | null;
  cta_label: string | null;
  kind: "invitation" | "application" | null;
} {
  if (
    collab.collabStatus === UceCollabStatus.PROSPECT_INVITED ||
    collab.collabStatus === UceCollabStatus.PROSPECT_CURATED
  ) {
    const quote = decimalToNumber(collab.totalQuote);
    return {
      status_label: "Priority Invitation Received",
      context_copy:
        quote > 0
          ? `Escrow secured compensation allocation: ${quote}`
          : null,
      cta_label: "Claim Invitation Brief",
      kind: "invitation",
    };
  }
  if (collab.collabStatus === UceCollabStatus.APPLICANT_SHORTLISTED) {
    return {
      status_label: "Shortlisted: Awaiting Final Terms",
      context_copy: null,
      cta_label: "View Submission Brief",
      kind: "application",
    };
  }
  if (collab.collabStatus === UceCollabStatus.APPLICANT_PENDING) {
    const score = decimalToNumber(collab.matchScore);
    return {
      status_label: "Application Submitted: Under Review",
      context_copy:
        score > 0
          ? `Match score confidence: ${score}%`
          : `Applied: ${collab.createdAt.toISOString()}`,
      cta_label: "View Submission Brief",
      kind: "application",
    };
  }
  return {
    status_label: collab.collabStatus,
    context_copy: null,
    cta_label: null,
    kind: null,
  };
}

export function mapHistoryClosedLabel(status: UceCollabStatus): string | null {
  switch (status) {
    case UceCollabStatus.ARCHIVED_COMPLETE:
      return "Completed & Released";
    case UceCollabStatus.APPLICANT_REJECTED:
      return "Brand Rejected";
    case UceCollabStatus.TERMINATED_CANCELED:
      return "Mutually Cancelled";
    default:
      return status;
  }
}
