import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeRouteProfile } from "./razorpay-route-state.normalizer";
import type { RouteProfileEvidence } from "./razorpay-route.types";

@Injectable()
export class CreatorPayoutProfileService {
  constructor(private readonly prisma: PrismaService) {}

  ensureProfile(creatorProfileId: string) {
    return this.prisma.creatorPayoutProfile.upsert({
      where: { creatorProfileId },
      create: {
        creatorProfileId,
        externalReferenceId: `creator:${creatorProfileId}`,
      },
      update: {},
    });
  }

  async getProfile(creatorProfileId: string) {
    const profile = await this.prisma.creatorPayoutProfile.findUnique({
      where: { creatorProfileId },
    });
    if (!profile)
      throw new NotFoundException("Creator payout profile not found");
    return profile;
  }

  async reconcileProviderEvidence(
    creatorProfileId: string,
    evidence: RouteProfileEvidence,
  ) {
    const normalized = normalizeRouteProfile(evidence);
    await this.ensureProfile(creatorProfileId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-profile:${creatorProfileId}`}))::text`;
      return tx.creatorPayoutProfile.update({
        where: { creatorProfileId },
        data: {
          linkedAccountId: evidence.linkedAccountId,
          stakeholderId: evidence.stakeholderId,
          productConfigurationId: evidence.productConfigurationId,
          providerAccountStatus: evidence.accountStatus,
          providerProductStatus: evidence.productStatus,
          providerBankStatus: evidence.bankStatus,
          maskedBankDisplay: evidence.maskedBankDisplay,
          ...normalized,
          eligibilityInvalidatedAt:
            normalized.operationalEligibility === "ELIGIBLE_FOR_TRANSFER"
              ? null
              : new Date(),
          lastProviderReconciledAt: new Date(),
          stateVersion: { increment: 1 },
        },
      });
    });
  }

  async invalidateReadiness(
    creatorProfileId: string,
    reason: "IDENTITY_CHANGED" | "BANK_CHANGED" | "LINKED_ACCOUNT_REPLACED",
  ) {
    await this.ensureProfile(creatorProfileId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-profile:${creatorProfileId}`}))::text`;
      const profile = await tx.creatorPayoutProfile.findUniqueOrThrow({
        where: { creatorProfileId },
      });
      return tx.creatorPayoutProfile.update({
        where: { id: profile.id },
        data: {
          onboardingStatus:
            reason === "BANK_CHANGED"
              ? profile.onboardingStatus
              : "IN_PROGRESS",
          bankStatus:
            reason === "BANK_CHANGED"
              ? "BANK_VALIDATION_PENDING"
              : profile.bankStatus,
          operationalEligibility:
            reason === "BANK_CHANGED" && profile.linkedAccountId
              ? "BANK_VALIDATION_PENDING"
              : profile.linkedAccountId
                ? "ACCOUNT_CREATED"
                : "NO_LINKED_ACCOUNT",
          eligibilityInvalidatedAt: new Date(),
          stateVersion: { increment: 1 },
        },
      });
    });
  }
}
