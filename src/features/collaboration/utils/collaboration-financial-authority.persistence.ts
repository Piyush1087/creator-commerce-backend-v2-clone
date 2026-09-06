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
        instructionHash: financialAuthorityHash(authority),
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
      },
    });
  }
}
