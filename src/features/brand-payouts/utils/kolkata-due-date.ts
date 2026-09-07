import { BadRequestException } from "@nestjs/common";

import type { CollaborationPaymentTermV1 } from "../ports/collaboration-payout-instruction.port";

export const PAYOUT_DUE_RULE_VERSION = "KOLKATA_CALENDAR_V1" as const;

const TERM_DAYS: Record<CollaborationPaymentTermV1, number> = {
  NET_7: 7,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
};

/** Asia/Kolkata has a fixed +05:30 offset; preserve the local wall clock across calendar-day addition. */
export function kolkataPaymentDueAt(
  settlementEligibleAt: Date,
  term: CollaborationPaymentTermV1,
): Date {
  if (
    !(settlementEligibleAt instanceof Date) ||
    Number.isNaN(settlementEligibleAt.getTime())
  )
    throw new BadRequestException(
      "Settlement eligibility timestamp is invalid",
    );
  const days = TERM_DAYS[term];
  if (!days) throw new BadRequestException("Payment term is not supported");
  return new Date(settlementEligibleAt.getTime() + days * 86_400_000);
}
