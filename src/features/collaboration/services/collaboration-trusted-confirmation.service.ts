import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CollaborationSecurementService } from "./collaboration-securement.service";

export type TrustedEscrowConfirmation = {
  confirmationId: string;
  bodyDigest: string;
  collaborationId: string;
  expectedAggregateVersion: number;
  fundingConfirmationRef: string;
  escrowLockRef: string;
  confirmedAmount: number;
  currency: string;
};

/** Provider-neutral boundary. Provider request bodies never cross this service. */
@Injectable()
export class CollaborationTrustedConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securement: CollaborationSecurementService,
  ) {}

  async consumeEscrow(input: TrustedEscrowConfirmation) {
    if (!/^[a-f0-9]{64}$/i.test(input.bodyDigest)) {
      throw new ConflictException("Trusted confirmation digest is invalid");
    }
    const existing =
      await this.prisma.collaborationTrustedConfirmation.findUnique({
        where: {
          confirmationType_confirmationId: {
            confirmationType: "ESCROW_FUNDING",
            confirmationId: input.confirmationId,
          },
        },
      });
    if (existing) {
      if (
        existing.collaborationId !== input.collaborationId ||
        existing.bodyDigest !== input.bodyDigest
      ) {
        throw new ConflictException("Trusted confirmation identity was reused");
      }
      return { collaborationId: input.collaborationId, replayed: true };
    }
    const result = await this.securement.confirmEscrowFunding(
      { actorClass: "SYSTEM" },
      input.collaborationId,
      {
        commandId: `trusted:escrow:${input.confirmationId}`,
        expectedAggregateVersion: input.expectedAggregateVersion,
        fundingConfirmationRef: input.fundingConfirmationRef,
        escrowLockRef: input.escrowLockRef,
        confirmedAmount: input.confirmedAmount,
        currency: input.currency,
      },
    );
    try {
      await this.prisma.collaborationTrustedConfirmation.create({
        data: {
          collaborationId: input.collaborationId,
          confirmationType: "ESCROW_FUNDING",
          confirmationId: input.confirmationId,
          bodyDigest: input.bodyDigest.toLowerCase(),
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
    }
    return { ...result, replayed: false };
  }
}
