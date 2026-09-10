import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { commandConflict } from "../errors/collaboration-command.error";
import { financialAuthorityHash } from "./collaboration-financial-authority";

type AgreementAuthority = {
  id: string;
  agreementVersion: number;
  agreementHash: string | null;
  currency: string;
};

/** Reconstructs the byte-identical hash from the persisted canonical authority projection. */
export function reconstructFinancialAuthorityInstructionHash(
  persistedAuthority: Record<string, unknown>,
) {
  return financialAuthorityHash(persistedAuthority);
}

export async function appendFinancialAuthority(
  tx: Prisma.TransactionClient,
  input: {
    collaborationId: string;
    agreement: AgreementAuthority;
    creatorEntitlement: Prisma.Decimal;
    brandRefundEntitlement: Prisma.Decimal;
    settlementEligibleAt: Date | null;
    resolutionType: string;
    sourceFinancialRef: string;
    effectiveAt: Date;
    fundingConfirmationId?: string;
    reserveInstructionId?: string;
  },
) {
  if (!input.agreement.agreementHash) {
    commandConflict(
      "INVALID_STATE",
      "Immutable commercial agreement authority is incomplete",
    );
  }
  const definitions = [
    {
      kind: "CREATOR_ENTITLEMENT",
      amount: input.creatorEntitlement,
      creatorEffect: input.creatorEntitlement,
      brandEffect: new Prisma.Decimal(0),
    },
    {
      kind: "BRAND_REFUND_ENTITLEMENT",
      amount: input.brandRefundEntitlement,
      creatorEffect: new Prisma.Decimal(0),
      brandEffect: input.brandRefundEntitlement,
    },
    ...(input.resolutionType === "NORMAL_SUCCESS"
      ? []
      : [
          {
            kind: "ABNORMAL_RESOLUTION",
            amount: input.creatorEntitlement.add(input.brandRefundEntitlement),
            creatorEffect: input.creatorEntitlement,
            brandEffect: input.brandRefundEntitlement,
          },
        ]),
    ...(input.brandRefundEntitlement.greaterThan(0)
      ? [
          {
            kind: "FINANCIAL_RECOVERY",
            amount: input.brandRefundEntitlement,
            creatorEffect: input.creatorEntitlement,
            brandEffect: input.brandRefundEntitlement,
          },
        ]
      : []),
  ];
  for (const definition of definitions) {
    const canonicalCreatorLineage =
      definition.kind === "CREATOR_ENTITLEMENT" &&
      input.resolutionType === "NORMAL_SUCCESS";
    if (
      canonicalCreatorLineage &&
      (!input.fundingConfirmationId || !input.reserveInstructionId)
    )
      commandConflict(
        "INVALID_STATE",
        "Normal Creator entitlement requires exact protected-funding lineage",
      );
    const prior = await tx.collaborationFinancialAuthorityInstruction.findFirst(
      {
        where: {
          collaborationId: input.collaborationId,
          kind: definition.kind,
        },
        orderBy: { instructionVersion: "desc" },
        select: { id: true, instructionVersion: true },
      },
    );
    const id = randomUUID();
    const instructionVersion = (prior?.instructionVersion ?? 0) + 1;
    const effectScope = definition.amount.isZero()
      ? "NONE"
      : definition.creatorEffect.isZero() || definition.brandEffect.isZero()
        ? "FULL"
        : "PARTIAL";
    const authority = {
      id,
      collaborationId: input.collaborationId,
      commercialAgreementId: input.agreement.id,
      agreementVersion: input.agreement.agreementVersion,
      agreementHash: input.agreement.agreementHash,
      kind: definition.kind,
      instructionVersion,
      amount: definition.amount.toFixed(2),
      currency: input.agreement.currency,
      creatorEntitlementEffect: definition.creatorEffect.toFixed(2),
      brandRefundEffect: definition.brandEffect.toFixed(2),
      settlementEligibleAt: input.settlementEligibleAt?.toISOString() ?? null,
      resolutionType: input.resolutionType,
      effectScope,
      sourceFinancialRef: input.sourceFinancialRef,
      supersedesInstructionId: prior?.id ?? null,
      effectiveAt: input.effectiveAt.toISOString(),
      ...(canonicalCreatorLineage
        ? {
            fundingConfirmationId: input.fundingConfirmationId!,
            reserveInstructionId: input.reserveInstructionId!,
          }
        : {}),
    };
    await tx.collaborationFinancialAuthorityInstruction.create({
      data: {
        id,
        collaborationId: input.collaborationId,
        commercialAgreementId: input.agreement.id,
        agreementVersion: input.agreement.agreementVersion,
        agreementHash: input.agreement.agreementHash,
        kind: definition.kind,
        instructionVersion,
        instructionHash: reconstructFinancialAuthorityInstructionHash(authority),
        amount: definition.amount,
        currency: input.agreement.currency,
        creatorEntitlementEffect: definition.creatorEffect,
        brandRefundEffect: definition.brandEffect,
        settlementEligibleAt: input.settlementEligibleAt,
        resolutionType: input.resolutionType,
        effectScope,
        sourceFinancialRef: input.sourceFinancialRef,
        supersedesInstructionId: prior?.id,
        effectiveAt: input.effectiveAt,
        fundingLineageMode: canonicalCreatorLineage
          ? "CANONICAL_PAYOUTS_V1"
          : "LEGACY_UNRECONCILED",
        fundingConfirmationId: canonicalCreatorLineage
          ? input.fundingConfirmationId
          : undefined,
        reserveInstructionId: canonicalCreatorLineage
          ? input.reserveInstructionId
          : undefined,
      },
    });
  }
}
