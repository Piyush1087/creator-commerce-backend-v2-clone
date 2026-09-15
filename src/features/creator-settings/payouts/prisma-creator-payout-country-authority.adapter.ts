import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { finalizePayoutCountryAuthority } from "./creator-payout-country-authority.contract";
import type { CreatorPayoutCountryAuthorityPort } from "./creator-payout-country-authority.port";

@Injectable()
export class PrismaCreatorPayoutCountryAuthorityAdapter implements CreatorPayoutCountryAuthorityPort {
  constructor(private readonly prisma: PrismaService) {}
  readCurrent(input: { creatorProfileId: string }) {
    return this.prisma.$transaction(
      (tx) => this.readInTransaction(tx, input.creatorProfileId),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async readInTransaction(
    tx: Prisma.TransactionClient,
    creatorProfileId: string,
  ) {
    const [destinations, legal, latest] = await Promise.all([
      tx.creatorPayoutDestination.findMany({
        where: {
          creatorProfileId,
          isPrimary: true,
          disabledAt: null,
          state: { not: "DISABLED" },
        },
        orderBy: { id: "asc" },
        take: 2,
        select: {
          id: true,
          creatorProfileId: true,
          payeeType: true,
          destinationType: true,
          countryCode: true,
          currencyCode: true,
          isPrimary: true,
          state: true,
          version: true,
          disabledAt: true,
        },
      }),
      tx.creatorLegalProfile.findUnique({
        where: { creatorProfileId },
        select: {
          creatorProfileId: true,
          payeeType: true,
          countryCode: true,
          version: true,
        },
      }),
      tx.creatorPayoutDestination.findFirst({
        where: { creatorProfileId },
        orderBy: [{ version: "desc" }, { id: "asc" }],
        select: { version: true },
      }),
    ]);
    return finalizePayoutCountryAuthority({
      creatorProfileId,
      destinations,
      legal,
      observedAt: new Date(),
      latestDestinationVersion: latest?.version,
    });
  }
}
