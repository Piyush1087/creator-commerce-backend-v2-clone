import { Injectable } from "@nestjs/common";
import { CreatorPayoutDestinationState } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreatorLegalProfileRecord,
  CreatorPayoutDestinationRecord,
  CreatorPayoutSettingsRepository,
  PersistCreatorLegalProfile,
  PersistCreatorPayoutDestination,
} from "./creator-payout-settings.types";

@Injectable()
export class PrismaCreatorPayoutSettingsRepository implements CreatorPayoutSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPrimaryDestination(
    creatorProfileId: string,
  ): Promise<CreatorPayoutDestinationRecord | null> {
    return this.prisma.creatorPayoutDestination.findFirst({
      where: {
        creatorProfileId,
        isPrimary: true,
        disabledAt: null,
        state: { not: CreatorPayoutDestinationState.DISABLED },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  replacePrimaryDestination(
    input: PersistCreatorPayoutDestination,
  ): Promise<CreatorPayoutDestinationRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`c05:payout-destination:${input.creatorProfileId}`})
        )::text
      `;

      const latest = await transaction.creatorPayoutDestination.findFirst({
        where: { creatorProfileId: input.creatorProfileId },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      });
      const now = new Date();
      await transaction.creatorPayoutDestination.updateMany({
        where: {
          creatorProfileId: input.creatorProfileId,
          isPrimary: true,
          disabledAt: null,
        },
        data: {
          isPrimary: false,
          state: CreatorPayoutDestinationState.DISABLED,
          reasonCode: "REPLACED",
          disabledAt: now,
        },
      });

      return transaction.creatorPayoutDestination.create({
        data: {
          ...input,
          isPrimary: true,
          state: CreatorPayoutDestinationState.CONFIGURED_UNVERIFIED,
          reasonCode: null,
          version: (latest?.version ?? 0) + 1,
        },
      });
    });
  }

  disablePrimaryDestination(
    creatorProfileId: string,
    destinationId: string,
  ): Promise<CreatorPayoutDestinationRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`c05:payout-destination:${creatorProfileId}`})
        )::text
      `;
      const current = await transaction.creatorPayoutDestination.findFirst({
        where: {
          id: destinationId,
          creatorProfileId,
          isPrimary: true,
          disabledAt: null,
        },
      });
      if (!current) {
        return null;
      }
      return transaction.creatorPayoutDestination.update({
        where: { id: current.id },
        data: {
          isPrimary: false,
          state: CreatorPayoutDestinationState.DISABLED,
          reasonCode: "USER_DISABLED",
          disabledAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
  }

  findLegalProfile(
    creatorProfileId: string,
  ): Promise<CreatorLegalProfileRecord | null> {
    return this.prisma.creatorLegalProfile.findUnique({
      where: { creatorProfileId },
    });
  }

  upsertLegalProfile(
    input: PersistCreatorLegalProfile,
  ): Promise<CreatorLegalProfileRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`c05:legal-profile:${input.creatorProfileId}`})
        )::text
      `;
      return transaction.creatorLegalProfile.upsert({
        where: { creatorProfileId: input.creatorProfileId },
        create: input,
        update: {
          payeeType: input.payeeType,
          legalName: input.legalName,
          countryCode: input.countryCode,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          stateRegion: input.stateRegion,
          postalCode: input.postalCode,
          version: { increment: 1 },
        },
      });
    });
  }
}
