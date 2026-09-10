import { createHash } from "node:crypto";

import { ConflictException } from "@nestjs/common";
import { UcePayoutTerms } from "@prisma/client";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function financialAuthorityHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function exactCampaignPaymentTerm(
  value: UcePayoutTerms | null | undefined,
): Exclude<UcePayoutTerms, "IMMEDIATE"> {
  if (
    value !== UcePayoutTerms.NET_7 &&
    value !== UcePayoutTerms.NET_15 &&
    value !== UcePayoutTerms.NET_30 &&
    value !== UcePayoutTerms.NET_45 &&
    value !== UcePayoutTerms.NET_60
  ) {
    throw new ConflictException({
      code: "C04_EXACT_CAMPAIGN_PAYMENT_TERM_UNAVAILABLE",
    });
  }
  return value;
}
