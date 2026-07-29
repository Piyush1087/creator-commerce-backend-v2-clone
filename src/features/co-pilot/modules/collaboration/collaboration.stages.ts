import { UceMilestoneStage } from "@prisma/client";

import type { WriteIntentKind } from "../../core/write-intent.types";

/** Doc-friendly stage aliases → real Prisma milestone stages. */
export const COLLABORATION_STAGES = [
  UceMilestoneStage.STAGE_1_NEGOTIATION,
  UceMilestoneStage.STAGE_2_SECUREMENT,
  UceMilestoneStage.STAGE_3_LOGISTICS,
  UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
  UceMilestoneStage.STAGE_5_PUBLISHING,
  UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
] as const;

export type CollaborationPersona = "BRAND" | "CREATOR";

/** Brand co-pilot write intents allowed per stage. */
export const BRAND_WRITE_INTENTS_BY_STAGE: Record<
  UceMilestoneStage,
  readonly WriteIntentKind[]
> = {
  STAGE_1_NEGOTIATION: ["COLLAB_COUNTER_OFFER", "COLLAB_ACCEPT_TERMS"],
  STAGE_2_SECUREMENT: ["COLLAB_FUND_ESCROW"],
  STAGE_3_LOGISTICS: ["COLLAB_DISPATCH"],
  STAGE_4_CONTENT_REVIEW: [
    "COLLAB_APPROVE_CONTENT",
    "COLLAB_REQUEST_REVISION",
  ],
  STAGE_5_PUBLISHING: ["COLLAB_VERIFY_COMPLIANCE"],
  STAGE_6_FEEDBACK_SYNC: [],
};

export const STAGE_LABELS: Record<UceMilestoneStage, string> = {
  STAGE_1_NEGOTIATION: "Negotiation",
  STAGE_2_SECUREMENT: "Securement",
  STAGE_3_LOGISTICS: "Logistics",
  STAGE_4_CONTENT_REVIEW: "Content Review",
  STAGE_5_PUBLISHING: "Publishing",
  STAGE_6_FEEDBACK_SYNC: "Feedback",
};

export function extractStageFilter(
  normalized: string,
): UceMilestoneStage | undefined {
  if (
    /\bnegotiat/.test(normalized) ||
    /\bquote\b/.test(normalized) ||
    /\bcounter/.test(normalized)
  ) {
    return UceMilestoneStage.STAGE_1_NEGOTIATION;
  }
  if (
    /\bescrow\b/.test(normalized) ||
    /\bsecur/.test(normalized) ||
    /\bfund/.test(normalized)
  ) {
    return UceMilestoneStage.STAGE_2_SECUREMENT;
  }
  if (
    /\blogistics\b/.test(normalized) ||
    /\bship/.test(normalized) ||
    /\bdispatch\b/.test(normalized) ||
    /\btracking\b/.test(normalized) ||
    /\bfulfilil?ment\b/.test(normalized)
  ) {
    return UceMilestoneStage.STAGE_3_LOGISTICS;
  }
  if (
    /\bcontent review\b/.test(normalized) ||
    /\bmedia\b/.test(normalized) ||
    /\brevision\b/.test(normalized) ||
    /\bdeliverable\b/.test(normalized)
  ) {
    return UceMilestoneStage.STAGE_4_CONTENT_REVIEW;
  }
  if (
    /\bpublish/.test(normalized) ||
    /\blive (post|url)\b/.test(normalized) ||
    /\bcompliance\b/.test(normalized)
  ) {
    return UceMilestoneStage.STAGE_5_PUBLISHING;
  }
  if (/\bfeedback\b/.test(normalized) || /\brating\b/.test(normalized)) {
    return UceMilestoneStage.STAGE_6_FEEDBACK_SYNC;
  }
  return undefined;
}

export function isBrandWriteAllowedAtStage(
  intent: WriteIntentKind,
  stage: UceMilestoneStage,
): boolean {
  return (BRAND_WRITE_INTENTS_BY_STAGE[stage] ?? []).includes(intent);
}
