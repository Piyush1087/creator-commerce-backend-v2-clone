import {
  Collaboration,
  CollaborationCommercial,
  CollaborationFinalization,
  CollaborationLogistics,
  CollaborationMedia,
  CollaborationMessage,
  UceCampaign,
  UceCampaignBrief,
  BrandProfile,
  User,
  CreatorProfile,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import type {
  CollaborationMessageRow,
  CollaborationThreadRow,
} from "../types/collaboration.types";

type ThreadSource = Collaboration & {
  campaign: Pick<UceCampaign, "name">;
  brief: Pick<UceCampaignBrief, "internalTitle" | "creativeGuidelines">;
  brandProfile: Pick<BrandProfile, "name">;
  creatorUser: Pick<User, "name" | "email"> & {
    creatorProfile: Pick<
      CreatorProfile,
      "displayName" | "instagramHandle"
    > | null;
  };
  commercials: CollaborationCommercial | null;
  logistics: CollaborationLogistics | null;
  finalization: CollaborationFinalization | null;
  media: CollaborationMedia[];
};

export function mapCollaborationThreadRow(
  row: ThreadSource,
  viewerRole: "BRAND" | "CREATOR",
): CollaborationThreadRow {
  const profile = row.creatorUser.creatorProfile;
  const handle =
    profile?.instagramHandle ??
    row.creatorUser.email.split("@")[0] ??
    "creator";

  return {
    collaboration_id: row.id,
    brand_profile_id: row.brandProfileId,
    creator_user_id: row.creatorUserId,
    campaign_id: row.campaignId,
    campaign_name: row.campaign.name,
    brief_id: row.briefId,
    brief_title: row.brief.internalTitle,
    creator_display_name: profile?.displayName ?? row.creatorUser.name,
    creator_handle: handle,
    brand_name: row.brandProfile.name,
    current_stage: row.currentStage,
    payout_mode: row.payoutMode,
    industry: row.industry,
    negotiation_round: row.negotiationRound,
    fulfillment_issue_count: row.fulfillmentIssueCount,
    revision_count: row.revisionCount,
    unread_count:
      viewerRole === "BRAND"
        ? row.unreadCountBrand
        : row.unreadCountCreator,
    last_message_snippet: row.lastMessageSnippet,
    last_message_at: row.lastMessageAt?.toISOString() ?? null,
    is_paused: row.isPaused,
    is_terminated: row.isTerminated,
  };
}

export function mapCollaborationDetail(row: ThreadSource) {
  const commercials = row.commercials;
  const profile = row.creatorUser.creatorProfile;
  const handle =
    profile?.instagramHandle ??
    row.creatorUser.email.split("@")[0] ??
    "creator";

  const finalQuoteNum = commercials?.finalQuote
    ? decimalToNumber(commercials.finalQuote)
    : null;
  const brandCounterNum = commercials?.brandCounterOffer
    ? decimalToNumber(commercials.brandCounterOffer)
    : null;
  const initialQuoteNum = commercials?.initialQuote
    ? decimalToNumber(commercials.initialQuote)
    : 0;

  const displayQuote =
    finalQuoteNum ?? brandCounterNum ?? initialQuoteNum ?? 0;

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
        creatorProfile: profile
          ? {
              displayName: profile.displayName,
              instagramHandle: profile.instagramHandle,
            }
          : null,
      },
      creatorHandle: handle,
    },
    commercials: commercials
      ? {
          initial_quote: initialQuoteNum,
          brand_counter_offer: brandCounterNum,
          final_quote: finalQuoteNum ?? 0,
          product_retail_value: decimalToNumber(commercials.productRetailValue),
          is_final_offer: commercials.isFinalOffer,
          advance_30_amount: decimalToNumber(commercials.advance30Amount),
          balance_70_amount: decimalToNumber(commercials.balance70Amount),
          total_quote: displayQuote,
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
    media: row.media.map((m) => ({
      id: m.id,
      phase: m.phase,
      status: m.status,
      mediaUrl: m.mediaUrl,
      versionNumber: m.versionNumber,
      brandFeedback: m.brandFeedback,
    })),
  };
}

export function mapMessageRow(msg: CollaborationMessage): CollaborationMessageRow {
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
