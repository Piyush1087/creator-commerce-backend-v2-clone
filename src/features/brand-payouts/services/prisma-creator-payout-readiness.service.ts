import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreatorPayoutReadinessPort,
  CreatorPayoutReadinessV1,
} from "../ports/creator-payout-readiness.port";

@Injectable()
export class PrismaCreatorPayoutReadinessService implements CreatorPayoutReadinessPort {
  constructor(private readonly prisma: PrismaService) {}

  async readCurrent(request: {
    creatorProfileId: string;
  }): Promise<CreatorPayoutReadinessV1> {
    const observedAt = new Date();
    const profile = await this.prisma.creatorPayoutProfile.findUnique({
      where: { creatorProfileId: request.creatorProfileId },
    });
    const destination = await this.prisma.creatorPayoutDestination.findFirst({
      where: {
        creatorProfileId: request.creatorProfileId,
        isPrimary: true,
        disabledAt: null,
        state: { not: "DISABLED" },
      },
      include: {
        providerMappings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ version: "desc" }, { id: "asc" }],
    });
    const mapping = destination?.providerMappings.find(
      (row) => row.destinationVersion === destination.version,
    );
    const ready = Boolean(
      profile &&
      destination &&
      mapping &&
      profile.operationalEligibility === "ELIGIBLE_FOR_TRANSFER" &&
      profile.bankStatus === "BANK_VALIDATED" &&
      destination.destinationType === "BANK_ACCOUNT" &&
      destination.countryCode === "IN" &&
      destination.currencyCode === "INR",
    );
    const unsupported = Boolean(
      destination &&
      (destination.destinationType !== "BANK_ACCOUNT" ||
        destination.countryCode !== "IN" ||
        destination.currencyCode !== "INR"),
    );
    return {
      creatorProfileId: request.creatorProfileId,
      destination: destination
        ? {
            reference: destination.id,
            version: destination.version,
            countryCode: destination.countryCode,
            currency: destination.currencyCode,
            rail: destination.destinationType,
          }
        : null,
      setupStatus: ready ? "READY" : "ACTION_REQUIRED",
      providerStatus: ready ? "READY" : "NOT_STARTED",
      blockingReasonCode: ready
        ? null
        : unsupported
          ? "UNSUPPORTED_GEOGRAPHY_OR_RAIL"
          : "CREATOR_PAYOUT_SETUP_REQUIRED",
      recoveryTarget: ready ? null : "CREATOR_PAYOUT_SETTINGS",
      stateVersion: `${profile?.stateVersion ?? -1}:${destination?.version ?? -1}:${mapping?.id ?? "none"}`,
      observedAt,
    };
  }
}
