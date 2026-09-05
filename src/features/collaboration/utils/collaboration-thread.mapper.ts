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
  UceApplicationSnapshot,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import type {
  CollaborationMessageRow,
  CollaborationThreadRow,
} from "../types/collaboration.types";

type ThreadSource = Collaboration & {
  campaign: Pick<UceCampaign, "name">;
  brief: Pick<UceCampaignBrief, "internalTitle" | "creativeGuidelines"> | null;
  sourceApplication?: {
    canonicalBriefId: string | null;
    snapshot: UceApplicationSnapshot | null;
  } | null;
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

function snapshotText(
  value: Prisma.JsonValue | undefined,
  key: string,
): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value[key] === "string" ? value[key] : null;
}
function historicalContext(row: ThreadSource) {
  const snapshot = row.sourceApplication?.snapshot;
  if (row.sourceApplicationId && !snapshot)
    throw new Error("C03_COLLABORATION_SNAPSHOT_MISSING");
  return {
    campaignName: snapshot
      ? (snapshotText(snapshot.campaignContext, "name") ?? "Campaign")
      : row.campaign.name,
    briefId: row.sourceApplication?.canonicalBriefId ?? row.briefId,
    briefTitle: snapshot
      ? (snapshotText(snapshot.briefContext, "briefName") ?? "Brief")
      : (row.brief?.internalTitle ?? "Brief"),
    creativeGuidelines: snapshot
      ? snapshotText(snapshot.briefContext, "creatorBrief")
      : (row.brief?.creativeGuidelines ?? null),
  };
}

export function mapCollaborationThreadRow(
  row: ThreadSource,
  viewerRole: "BRAND" | "CREATOR",
): CollaborationThreadRow {
  const historical = historicalContext(row);
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
    campaign_name: historical.campaignName,
    brief_id: historical.briefId,
    brief_title: historical.briefTitle,
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
      viewerRole === "BRAND" ? row.unreadCountBrand : row.unreadCountCreator,
    last_message_snippet: row.lastMessageSnippet,
    last_message_at: row.lastMessageAt?.toISOString() ?? null,
    is_paused: row.isPaused,
    is_terminated: row.isTerminated,
  };
}

export function mapCollaborationDetail(row: ThreadSource) {
  const historical = historicalContext(row);
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
    : row.sourceApplicationId
      ? null
      : 0;

  const displayQuote =
    finalQuoteNum ??
    brandCounterNum ??
    initialQuoteNum ??
    (row.sourceApplicationId ? null : 0);

  return {
    thread: {
      id: row.id,
      currentStage: row.currentStage,
      payoutMode: row.payoutMode,
      industry: row.industry,
      negotiationRound: row.negotiationRound,
      ...(row.sourceApplicationId
        ? {
            sourceApplicationId: row.sourceApplicationId,
            handoffCommercialState: row.handoffCommercialState,
          }
        : {}),
      fulfillmentIssueCount: row.fulfillmentIssueCount,
      revisionCount: row.revisionCount,
      isTerminated: row.isTerminated,
      isPaused: row.isPaused,
      campaign: { name: historical.campaignName },
      brief: {
        internalTitle: historical.briefTitle,
        creativeGuidelines: historical.creativeGuidelines,
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
          final_quote: finalQuoteNum ?? (row.sourceApplicationId ? null : 0),
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
