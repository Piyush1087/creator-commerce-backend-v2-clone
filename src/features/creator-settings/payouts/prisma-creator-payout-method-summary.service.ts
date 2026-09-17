import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreatorPayoutMethodSummary,
  CreatorPayoutMethodSummaryPort,
} from "./creator-payout-method-summary.port";

@Injectable()
export class PrismaCreatorPayoutMethodSummaryService implements CreatorPayoutMethodSummaryPort {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    creatorProfileId: string,
    manageAuthorized: boolean,
  ): Promise<CreatorPayoutMethodSummary> {
    const rows = await this.prisma.creatorPayoutDestination.findMany({
      where: { creatorProfileId },
      select: {
        id: true,
        version: true,
        maskedDisplay: true,
        destinationType: true,
        countryCode: true,
        currencyCode: true,
        isPrimary: true,
        state: true,
        reasonCode: true,
        updatedAt: true,
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    });
    if (rows.length === 0) return empty("NONE", manageAuthorized);
    const activePrimary = rows.filter(
      (row) => row.isPrimary && row.state !== "DISABLED",
    );
    if (activePrimary.length > 1)
      return empty(
        "AMBIGUOUS",
        manageAuthorized,
        "PRIMARY_DESTINATION_AMBIGUOUS",
      );
    const row = activePrimary[0] ?? rows[0];
    const stale =
      activePrimary.length === 1 &&
      rows.some((candidate) => candidate.version > row.version);
    const supported =
      row.countryCode === "IN" &&
      row.currencyCode === "INR" &&
      row.destinationType === "BANK_ACCOUNT";
    const status =
      !row.isPrimary || row.state === "DISABLED"
        ? "DISABLED"
        : stale
          ? "STALE"
          : !supported
            ? "UNSUPPORTED"
            : row.state === "NEEDS_ATTENTION"
              ? "ATTENTION"
              : "CURRENT";
    return {
      status,
      destination_id: row.id,
      destination_version: row.version,
      masked_display: row.maskedDisplay,
      destination_type: row.destinationType,
      country_code: row.countryCode,
      currency_code: row.currencyCode,
      is_primary: row.isPrimary,
      destination_state: row.state,
      safe_reason_code: safeReason(status, row.reasonCode),
      updated_at: row.updatedAt.toISOString(),
      c06_rail_support: supported ? "SUPPORTED" : "UNSUPPORTED",
      manage_settings_href: manageAuthorized
        ? "/creator/settings/payouts"
        : null,
    };
  }
}

function empty(
  status: "NONE" | "AMBIGUOUS",
  authorized: boolean,
  reason: string | null = null,
): CreatorPayoutMethodSummary {
  return {
    status,
    destination_id: null,
    destination_version: null,
    masked_display: null,
    destination_type: null,
    country_code: null,
    currency_code: null,
    is_primary: null,
    destination_state: null,
    safe_reason_code: reason,
    updated_at: null,
    c06_rail_support: "UNAVAILABLE",
    manage_settings_href: authorized ? "/creator/settings/payouts" : null,
  };
}

function safeReason(
  status: CreatorPayoutMethodSummary["status"],
  stored: string | null,
): string | null {
  if (status === "ATTENTION") return stored ?? "DESTINATION_REQUIRES_ATTENTION";
  if (status === "STALE") return "DESTINATION_VERSION_STALE";
  if (status === "DISABLED") return "DESTINATION_DISABLED";
  if (status === "UNSUPPORTED") return "UNSUPPORTED_GEOGRAPHY_OR_RAIL";
  return null;
}
