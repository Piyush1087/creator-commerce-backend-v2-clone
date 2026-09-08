import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import { financialAuthorityHash } from "../utils/collaboration-financial-authority";
import { CollaborationSecurementService } from "./collaboration-securement.service";

export const canonicalAuthorityReference = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const reference = z.string().regex(canonicalAuthorityReference);
const hash = z.string().regex(/^[a-f0-9]{64}$/i);
const exactAmount = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  .refine((value) => new Prisma.Decimal(value).greaterThan(0));

export const trustedEscrowConfirmationSchema = z
  .object({
    confirmationId: reference,
    bodyDigest: hash,
    collaborationId: z.string().uuid(),
    expectedAggregateVersion: z.number().int().nonnegative(),
    fundingConfirmationRef: reference,
    escrowLockRef: z.string().uuid(),
    confirmedAmount: exactAmount,
    currency: z.string().regex(/^[A-Z]{3}$/),
    reserveInstructionId: z.string().uuid(),
    reserveRequestId: reference,
    reserveInstructionVersion: z.number().int().positive(),
    reserveInstructionHash: hash,
    commercialAgreementId: z.string().uuid(),
    agreementVersion: z.number().int().positive(),
    agreementHash: hash,
    payoutsApprovalRef: reference,
    reserveExecutionAttemptRef: reference,
    reserveLedgerTransactionId: z.string().uuid(),
    brandProfileId: z.string().uuid(),
    campaignId: z.string().uuid(),
    creatorProfileId: z.string().uuid(),
  })
  .strict();

export type TrustedEscrowConfirmation = z.infer<
  typeof trustedEscrowConfirmationSchema
>;

const normalizedTuple = (input: TrustedEscrowConfirmation) => ({
  confirmationType: "ESCROW_FUNDING",
  confirmationId: input.confirmationId,
  fundingConfirmationRef: input.fundingConfirmationRef,
  collaborationId: input.collaborationId,
  reserveInstructionId: input.reserveInstructionId,
  reserveRequestId: input.reserveRequestId,
  reserveInstructionVersion: input.reserveInstructionVersion,
  reserveInstructionHash: input.reserveInstructionHash.toLowerCase(),
  commercialAgreementId: input.commercialAgreementId,
  agreementVersion: input.agreementVersion,
  agreementHash: input.agreementHash.toLowerCase(),
  payoutsApprovalRef: input.payoutsApprovalRef,
  reserveExecutionAttemptRef: input.reserveExecutionAttemptRef,
  escrowLockId: input.escrowLockRef,
  reserveLedgerTransactionId: input.reserveLedgerTransactionId,
  brandProfileId: input.brandProfileId,
  campaignId: input.campaignId,
  creatorProfileId: input.creatorProfileId,
  confirmedAmount: new Prisma.Decimal(input.confirmedAmount).toFixed(2),
  currency: input.currency,
  disposition: "COMPLETED_SUFFICIENT" as const,
});

export function trustedEscrowConfirmationDigest(raw: unknown): string {
  const input = trustedEscrowConfirmationSchema.parse(raw);
  return financialAuthorityHash(normalizedTuple(input)).toLowerCase();
}

const sameTuple = (
  row: Record<string, any>,
  tuple: ReturnType<typeof normalizedTuple>,
) =>
  Object.entries(tuple).every(([key, value]) =>
    key === "confirmedAmount"
      ? new Prisma.Decimal(row[key]).equals(new Prisma.Decimal(value))
      : row[key] === value,
  );

const isConfirmationIdentityConflict = (
  error: Prisma.PrismaClientKnownRequestError,
) => {
  const target = error.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : [String(target ?? "")];
  return (
    fields.some((field) => field.includes("confirmation_type")) &&
    fields.some((field) => field.includes("confirmation_id"))
  );
};

/** The final-shape row is invisible until the transaction and deferred projection invariant commit. */
@Injectable()
export class CollaborationTrustedConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securement: CollaborationSecurementService,
  ) {}

  async consumeEscrow(raw: unknown) {
    const input = trustedEscrowConfirmationSchema.parse(raw);
    const tuple = normalizedTuple(input);
    const digest = trustedEscrowConfirmationDigest(input);
    if (digest !== input.bodyDigest.toLowerCase())
      throw new ConflictException(
        "Trusted confirmation digest does not match its canonical tuple",
      );
    try {
      const result = await this.prisma.$transaction((tx) =>
        this.consumeEscrowInTransaction(tx, input),
      );
      await this.securement.broadcastConfirmationApplied(input.collaborationId);
      return { ...result, replayed: false };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      if (!isConfirmationIdentityConflict(error))
        throw new ConflictException(
          "Trusted confirmation conflicts with existing financial authority",
        );
      const winner =
        await this.prisma.collaborationTrustedConfirmation.findUnique({
          where: {
            confirmationType_confirmationId: {
              confirmationType: "ESCROW_FUNDING",
              confirmationId: input.confirmationId,
            },
          },
        });
      if (
        !winner ||
        winner.applicationState !== "APPLIED" ||
        winner.bodyDigest !== digest ||
        !sameTuple(winner, tuple)
      )
        throw new ConflictException("Trusted confirmation identity was reused");
      return { collaborationId: input.collaborationId, replayed: true };
    }
  }

  async consumeEscrowInTransaction(tx: Prisma.TransactionClient, raw: unknown) {
    const input = trustedEscrowConfirmationSchema.parse(raw);
    const tuple = normalizedTuple(input);
    const digest = trustedEscrowConfirmationDigest(input);
    if (digest !== input.bodyDigest.toLowerCase())
      throw new ConflictException(
        "Trusted confirmation digest does not match its canonical tuple",
      );
    const confirmation = await tx.collaborationTrustedConfirmation.create({
      data: {
        ...tuple,
        bodyDigest: digest,
        lineageMode: "CANONICAL_PAYOUTS_V1",
        applicationState: "APPLIED",
      },
    });
    const applied = await this.securement.confirmEscrowFunding(
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
      tx,
    );
    return { ...applied, trustedConfirmationId: confirmation.id };
  }

  broadcastEscrowApplied(collaborationId: string) {
    return this.securement.broadcastConfirmationApplied(collaborationId);
  }
}
