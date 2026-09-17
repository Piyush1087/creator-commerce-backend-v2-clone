import { Injectable, NotFoundException } from "@nestjs/common";
import {
  EscrowTransactionStatus,
  EscrowTransactionType,
  Prisma,
  RouteReversalState,
  RouteSettlementState,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  PAYOUT_DUE_RULE_VERSION,
  kolkataPaymentDueAt,
} from "../../brand-payouts/utils/kolkata-due-date";
import {
  decimalSum,
  exactMoney,
  maxObservedAt,
} from "../../brand-payouts/utils/brand-payouts-projection";
import type {
  CreatorPayoutObligationItem,
  CreatorPayoutSummaryFamily,
  CreatorPayoutsAuthorizationScope,
} from "../contracts/creator-payouts.contract";
import { CreatorPayoutsCursorCodec } from "../utils/creator-payouts-cursor";

const obligationSelect =
  Prisma.validator<Prisma.CreatorPayoutObligationSelect>()({
    id: true,
    settlementInstructionId: true,
    collaborationId: true,
    vaultId: true,
    brandProfileId: true,
    creatorProfileId: true,
    payoutProfileId: true,
    entitlementAmount: true,
    currency: true,
    status: true,
    paymentDueAt: true,
    blockedReason: true,
    settledAt: true,
    createdAt: true,
    updatedAt: true,
    provenanceMode: true,
    authorityInstructionId: true,
    authorityInstructionKind: true,
    authorityInstructionVersion: true,
    authorityInstructionHash: true,
    commercialAgreementId: true,
    agreementVersion: true,
    agreementHash: true,
    reserveInstructionId: true,
    fundingConfirmationId: true,
    settlementEligibleAt: true,
    paymentTermSnapshot: true,
    dueRuleVersion: true,
    dueEvidenceRecordedAt: true,
    lifecycle: true,
    currentGate: true,
    amountSettled: true,
    amountOutstanding: true,
    collaboration: {
      select: {
        id: true,
        creatorProfileId: true,
        creatorWorkspaceId: true,
        brandProfileId: true,
        campaignId: true,
        updatedAt: true,
      },
    },
    vault: {
      select: {
        id: true,
        brandProfileId: true,
        currency: true,
        updatedAt: true,
      },
    },
    creatorProfile: { select: { id: true, updatedAt: true } },
    payoutProfile: {
      select: { id: true, creatorProfileId: true, updatedAt: true },
    },
    authorityInstruction: {
      select: {
        id: true,
        collaborationId: true,
        commercialAgreementId: true,
        agreementVersion: true,
        agreementHash: true,
        kind: true,
        instructionVersion: true,
        instructionHash: true,
        amount: true,
        currency: true,
        creatorEntitlementEffect: true,
        settlementEligibleAt: true,
        fundingLineageMode: true,
        fundingConfirmationId: true,
        reserveInstructionId: true,
        effectiveAt: true,
        supersededBy: { select: { id: true, effectiveAt: true } },
        commercialAgreement: {
          select: {
            id: true,
            collaborationId: true,
            agreementVersion: true,
            agreementHash: true,
            currency: true,
            campaignPaymentTermSnapshot: true,
          },
        },
        reserveInstruction: {
          select: {
            id: true,
            collaborationId: true,
            commercialAgreementId: true,
            agreementVersion: true,
            agreementHash: true,
            instructionVersion: true,
            instructionHash: true,
            brandProfileId: true,
            campaignId: true,
            creatorProfileId: true,
            currency: true,
            reserveAmount: true,
            status: true,
          },
        },
        fundingConfirmation: {
          select: {
            id: true,
            collaborationId: true,
            lineageMode: true,
            reserveInstructionId: true,
            reserveInstructionVersion: true,
            reserveInstructionHash: true,
            commercialAgreementId: true,
            agreementVersion: true,
            agreementHash: true,
            brandProfileId: true,
            campaignId: true,
            creatorProfileId: true,
            confirmedAmount: true,
            currency: true,
            disposition: true,
            observedAt: true,
            lineageAppliedAt: true,
            applicationState: true,
          },
        },
      },
    },
    fundingAllocations: {
      select: {
        obligationId: true,
        collaborationAllocationId: true,
        fundingLotId: true,
        allocatedAmount: true,
        consumedAmount: true,
        reversedAmount: true,
        updatedAt: true,
        collaborationAllocation: {
          select: { id: true, collaborationId: true, fundingLotId: true },
        },
        fundingLot: {
          select: {
            id: true,
            vaultId: true,
            brandProfileId: true,
            currency: true,
          },
        },
      },
    },
    transfers: {
      select: {
        id: true,
        amount: true,
        currency: true,
        state: true,
        settlementState: true,
        snapshotMode: true,
        destinationId: true,
        destinationVersion: true,
        settlementId: true,
        initiatedAt: true,
        processedAt: true,
        settledAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
        reconciledReceipts: {
          select: {
            id: true,
            eventClass: true,
            receivedAt: true,
            reconciledAt: true,
          },
        },
        reversals: {
          select: {
            id: true,
            amount: true,
            currency: true,
            state: true,
            processedAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
  });

type ObligationRow = Prisma.CreatorPayoutObligationGetPayload<{
  select: typeof obligationSelect;
}>;
type ProjectedRow = {
  readonly item: CreatorPayoutObligationItem;
  readonly createdAt: Date;
  readonly canonical: boolean;
};

@Injectable()
export class CreatorPayoutsObligationProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursors: CreatorPayoutsCursorCodec,
  ) {}

  async list(input: {
    authorization: CreatorPayoutsAuthorizationScope;
    asOf: Date;
    limit: number;
    cursor?: string;
  }) {
    const boundary = this.cursors.decode({
      cursor: input.cursor,
      endpoint: "obligations",
      filterKey: "{}",
      authorization: input.authorization,
      requestAsOf: input.asOf,
    });
    const where: Prisma.CreatorPayoutObligationWhereInput = {
      creatorProfileId: input.authorization.subjectCreatorProfileId,
      collaboration: {
        creatorProfileId: input.authorization.subjectCreatorProfileId,
        creatorWorkspaceId: input.authorization.workspaceId,
      },
      createdAt: { lte: boundary.lastRecordedAt ?? boundary.asOf },
      ...(boundary.lastRecordedAt && boundary.lastStableId
        ? {
            OR: [
              { createdAt: { lt: boundary.lastRecordedAt } },
              {
                createdAt: boundary.lastRecordedAt,
                id: { lt: stripReference(boundary.lastStableId) },
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.creatorPayoutObligation.findMany({
      where,
      select: obligationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    const projected = await this.projectRows(
      rows.slice(0, input.limit),
      boundary.asOf,
      input.authorization,
    );
    const hasNext = rows.length > input.limit;
    const last = projected.at(-1);
    return {
      items: projected.map((row) => row.item),
      canonicalRows: projected.filter((row) => row.canonical),
      asOf: boundary.asOf,
      coverage: projected.every((row) => row.canonical)
        ? ("COMPLETE" as const)
        : ("PARTIAL" as const),
      nextCursor:
        hasNext && last
          ? this.cursors.encode({
              endpoint: "obligations",
              filterKey: "{}",
              authorization: input.authorization,
              asOf: boundary.asOf,
              lastRecordedAt: last.createdAt,
              lastStableId: last.item.public_reference,
            })
          : null,
    };
  }

  async allCanonical(input: {
    authorization: CreatorPayoutsAuthorizationScope;
    asOf: Date;
  }) {
    const rows = await this.prisma.creatorPayoutObligation.findMany({
      where: {
        creatorProfileId: input.authorization.subjectCreatorProfileId,
        collaboration: {
          creatorProfileId: input.authorization.subjectCreatorProfileId,
          creatorWorkspaceId: input.authorization.workspaceId,
        },
        createdAt: { lte: input.asOf },
      },
      select: obligationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return this.projectRows(rows, input.asOf, input.authorization);
  }

  async detail(input: {
    authorization: CreatorPayoutsAuthorizationScope;
    asOf: Date;
    resourceId: string;
  }) {
    const row = await this.prisma.creatorPayoutObligation.findFirst({
      where: {
        id: stripReference(input.resourceId),
        creatorProfileId: input.authorization.subjectCreatorProfileId,
        collaboration: {
          creatorProfileId: input.authorization.subjectCreatorProfileId,
          creatorWorkspaceId: input.authorization.workspaceId,
        },
        createdAt: { lte: input.asOf },
      },
      select: obligationSelect,
    });
    if (!row) throw notFound();
    return (
      (await this.projectRows([row], input.asOf, input.authorization))[0]
        ?.item ??
      (() => {
        throw notFound();
      })()
    );
  }

  private async projectRows(
    rows: readonly ObligationRow[],
    asOf: Date,
    authorization: CreatorPayoutsAuthorizationScope,
  ): Promise<ProjectedRow[]> {
    const settlementIds = rows.flatMap((row) =>
      row.transfers
        .map((transfer) => transfer.settlementId)
        .filter((id): id is string => Boolean(id)),
    );
    const ledgers =
      settlementIds.length === 0
        ? []
        : await this.prisma.escrowTransactionLedger.findMany({
            where: {
              gatewayReferenceId: { in: settlementIds },
              transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
              transactionStatus: EscrowTransactionStatus.CLEARED,
              createdAt: { lte: asOf },
            },
            select: {
              id: true,
              gatewayReferenceId: true,
              brandProfileId: true,
              vaultId: true,
              collaborationId: true,
              amount: true,
              currency: true,
              createdAt: true,
            },
          });
    return rows.map((row) => project(row, asOf, authorization, ledgers));
  }
}

function project(
  row: ObligationRow,
  asOf: Date,
  authorization: CreatorPayoutsAuthorizationScope,
  ledgers: readonly {
    id: string;
    gatewayReferenceId: string | null;
    brandProfileId: string;
    vaultId: string;
    collaborationId: string | null;
    amount: Decimal;
    currency: string;
    createdAt: Date;
  }[],
): ProjectedRow {
  const canonical = canonicalIntegrity(row, asOf, authorization);
  const observedAt =
    maxObservedAt([
      row.updatedAt,
      row.collaboration.updatedAt,
      row.vault.updatedAt,
      row.creatorProfile.updatedAt,
      row.payoutProfile.updatedAt,
      row.dueEvidenceRecordedAt,
      ...row.fundingAllocations.map((allocation) => allocation.updatedAt),
      ...row.transfers.flatMap((transfer) => [
        transfer.updatedAt,
        ...transfer.reconciledReceipts.map((receipt) => receipt.reconciledAt),
        ...transfer.reversals.map((reversal) => reversal.updatedAt),
      ]),
    ]) ?? row.updatedAt;
  if (!canonical.ok) {
    return {
      canonical: false,
      createdAt: row.createdAt,
      item: {
        obligation_id: row.id,
        public_reference: `payout-obligation:${row.id}`,
        resource_version: `observed:${observedAt.toISOString()}`,
        campaign_reference: row.collaboration.campaignId,
        collaboration_reference: row.collaborationId,
        lifecycle: "LEGACY_UNRECONCILED",
        effective_gate: "RESOLUTION_BLOCKED",
        blocking_reason_code: canonical.reason,
        entitlement_value: null,
        settled_value: null,
        outstanding_value: null,
        payment_due_at: null,
        settlement_eligible_at: null,
        payment_term: null,
        last_observed_at: observedAt.toISOString(),
        legacy: {
          classification:
            row.provenanceMode === "CANONICAL_C04"
              ? "DISPLAY_WITH_LIMITATION"
              : "LEGACY_UNRECONCILED",
          limitation_reason_code: canonical.reason,
        },
      },
    };
  }
  const execution = executionTruth(row, ledgers);
  if (!execution.ok) {
    return {
      canonical: false,
      createdAt: row.createdAt,
      item: {
        obligation_id: row.id,
        public_reference: `payout-obligation:${row.id}`,
        resource_version: `observed:${observedAt.toISOString()}`,
        campaign_reference: row.collaboration.campaignId,
        collaboration_reference: row.collaborationId,
        lifecycle: "LEGACY_UNRECONCILED",
        effective_gate: "RESOLUTION_BLOCKED",
        blocking_reason_code: "SETTLEMENT_OR_REVERSAL_LINEAGE_CONFLICT",
        entitlement_value: null,
        settled_value: null,
        outstanding_value: null,
        payment_due_at: null,
        settlement_eligible_at: null,
        payment_term: null,
        last_observed_at: observedAt.toISOString(),
        legacy: {
          classification: "DISPLAY_WITH_LIMITATION",
          limitation_reason_code: "SETTLEMENT_OR_REVERSAL_LINEAGE_CONFLICT",
        },
      },
    };
  }
  const storedGate = row.currentGate ?? "RESOLUTION_BLOCKED";
  const effectiveGate = resolveProviderDisabledGate(
    storedGate,
    row.paymentDueAt!,
    asOf,
  );
  return {
    canonical: true,
    createdAt: row.createdAt,
    item: {
      obligation_id: row.id,
      public_reference: `payout-obligation:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      campaign_reference: row.collaboration.campaignId,
      collaboration_reference: row.collaborationId,
      lifecycle: row.lifecycle!,
      effective_gate: effectiveGate,
      blocking_reason_code:
        effectiveGate === "PROVIDER_UNAVAILABLE"
          ? "PROVIDER_DISABLED"
          : row.blockedReason,
      entitlement_value: exactMoney(row.entitlementAmount, row.currency),
      settled_value: exactMoney(execution.netSettled, row.currency),
      outstanding_value: exactMoney(
        Decimal.max(
          new Decimal(0),
          row.entitlementAmount.sub(execution.netSettled),
        ),
        row.currency,
      ),
      payment_due_at: row.paymentDueAt!.toISOString(),
      settlement_eligible_at: row.settlementEligibleAt!.toISOString(),
      payment_term: row.paymentTermSnapshot,
      last_observed_at: observedAt.toISOString(),
      legacy: null,
    },
  };
}

function canonicalIntegrity(
  row: ObligationRow,
  asOf: Date,
  authorization: CreatorPayoutsAuthorizationScope,
): { ok: true } | { ok: false; reason: string } {
  const authority = row.authorityInstruction;
  const agreement = authority?.commercialAgreement;
  const reserve = authority?.reserveInstruction;
  const confirmation = authority?.fundingConfirmation;
  if (
    row.creatorProfileId !== authorization.subjectCreatorProfileId ||
    row.collaboration.creatorProfileId !==
      authorization.subjectCreatorProfileId ||
    row.collaboration.creatorWorkspaceId !== authorization.workspaceId ||
    row.collaborationId !== row.collaboration.id ||
    row.brandProfileId !== row.collaboration.brandProfileId ||
    row.brandProfileId !== row.vault.brandProfileId ||
    row.creatorProfileId !== row.creatorProfile.id ||
    row.creatorProfileId !== row.payoutProfile.creatorProfileId ||
    row.vaultId !== row.vault.id ||
    row.currency !== row.vault.currency
  )
    return { ok: false, reason: "OWNERSHIP_OR_CURRENCY_LINEAGE_CONFLICT" };
  if (
    row.provenanceMode !== "CANONICAL_C04" ||
    !authority ||
    !agreement ||
    !reserve ||
    !confirmation
  )
    return { ok: false, reason: "CANONICAL_C04_PROVENANCE_UNAVAILABLE" };
  if (
    row.authorityInstructionId !== authority.id ||
    row.settlementInstructionId !== authority.id ||
    row.authorityInstructionKind !== authority.kind ||
    row.authorityInstructionVersion !== authority.instructionVersion ||
    row.authorityInstructionHash !== authority.instructionHash ||
    authority.supersededBy.some((candidate) => candidate.effectiveAt <= asOf) ||
    authority.collaborationId !== row.collaborationId ||
    authority.currency !== row.currency ||
    !authority.creatorEntitlementEffect.equals(row.entitlementAmount) ||
    !authority.amount.equals(row.entitlementAmount)
  )
    return { ok: false, reason: "CURRENT_AUTHORITY_INSTRUCTION_MISMATCH" };
  if (
    row.commercialAgreementId !== agreement.id ||
    row.agreementVersion !== agreement.agreementVersion ||
    row.agreementHash !== agreement.agreementHash ||
    authority.commercialAgreementId !== agreement.id ||
    authority.agreementVersion !== agreement.agreementVersion ||
    authority.agreementHash !== agreement.agreementHash ||
    agreement.collaborationId !== row.collaborationId ||
    agreement.currency !== row.currency
  )
    return { ok: false, reason: "COMMERCIAL_AGREEMENT_MISMATCH" };
  if (
    row.reserveInstructionId !== reserve.id ||
    authority.reserveInstructionId !== reserve.id ||
    reserve.collaborationId !== row.collaborationId ||
    reserve.commercialAgreementId !== agreement.id ||
    reserve.agreementVersion !== agreement.agreementVersion ||
    reserve.agreementHash !== agreement.agreementHash ||
    reserve.brandProfileId !== row.brandProfileId ||
    reserve.campaignId !== row.collaboration.campaignId ||
    reserve.creatorProfileId !== row.creatorProfileId ||
    reserve.currency !== row.currency
  )
    return { ok: false, reason: "RESERVE_INSTRUCTION_MISMATCH" };
  if (
    row.fundingConfirmationId !== confirmation.id ||
    authority.fundingConfirmationId !== confirmation.id ||
    authority.fundingLineageMode !== "CANONICAL_PAYOUTS_V1" ||
    confirmation.lineageMode !== "CANONICAL_PAYOUTS_V1" ||
    confirmation.applicationState !== "APPLIED" ||
    confirmation.disposition !== "COMPLETED_SUFFICIENT" ||
    confirmation.collaborationId !== row.collaborationId ||
    confirmation.reserveInstructionId !== reserve.id ||
    confirmation.reserveInstructionVersion !== reserve.instructionVersion ||
    confirmation.reserveInstructionHash !== reserve.instructionHash ||
    confirmation.commercialAgreementId !== agreement.id ||
    confirmation.agreementVersion !== agreement.agreementVersion ||
    confirmation.agreementHash !== agreement.agreementHash ||
    confirmation.brandProfileId !== row.brandProfileId ||
    confirmation.campaignId !== row.collaboration.campaignId ||
    confirmation.creatorProfileId !== row.creatorProfileId ||
    confirmation.currency !== row.currency ||
    confirmation.confirmedAmount !== reserve.reserveAmount.toFixed(2)
  )
    return { ok: false, reason: "FUNDING_CONFIRMATION_MISMATCH" };
  const allocationTotal = decimalSum(
    row.fundingAllocations.map((allocation) => allocation.allocatedAmount),
  );
  if (
    row.fundingAllocations.length === 0 ||
    !allocationTotal.equals(row.entitlementAmount) ||
    row.fundingAllocations.some(
      (allocation) =>
        allocation.obligationId !== row.id ||
        allocation.collaborationAllocationId !==
          allocation.collaborationAllocation.id ||
        allocation.fundingLotId !== allocation.fundingLot.id ||
        allocation.collaborationAllocation.collaborationId !==
          row.collaborationId ||
        allocation.collaborationAllocation.fundingLotId !==
          allocation.fundingLotId ||
        allocation.fundingLot.vaultId !== row.vaultId ||
        allocation.fundingLot.brandProfileId !== row.brandProfileId ||
        allocation.fundingLot.currency !== row.currency ||
        !allocation.allocatedAmount.greaterThan(0),
    )
  )
    return { ok: false, reason: "POSITIVE_ALLOCATION_LINEAGE_MISMATCH" };
  if (
    !row.settlementEligibleAt ||
    !row.paymentTermSnapshot ||
    row.paymentTermSnapshot === "IMMEDIATE" ||
    !row.paymentDueAt ||
    row.dueRuleVersion !== PAYOUT_DUE_RULE_VERSION ||
    !row.dueEvidenceRecordedAt ||
    authority.settlementEligibleAt?.getTime() !==
      row.settlementEligibleAt.getTime() ||
    agreement.campaignPaymentTermSnapshot !== row.paymentTermSnapshot ||
    kolkataPaymentDueAt(
      row.settlementEligibleAt,
      row.paymentTermSnapshot,
    ).getTime() !== row.paymentDueAt.getTime()
  )
    return { ok: false, reason: "PERSISTED_DUE_EVIDENCE_MISMATCH" };
  return { ok: true };
}

function executionTruth(
  row: ObligationRow,
  ledgers: readonly {
    gatewayReferenceId: string | null;
    brandProfileId: string;
    vaultId: string;
    collaborationId: string | null;
    amount: Decimal;
    currency: string;
  }[],
): { ok: boolean; netSettled: Decimal } {
  if (row.lifecycle !== "SETTLED")
    return { ok: row.lifecycle !== null, netSettled: new Decimal(0) };
  const settled = row.transfers.filter(
    (transfer) => transfer.settlementState === RouteSettlementState.SETTLED,
  );
  if (settled.length !== 1) return { ok: false, netSettled: new Decimal(0) };
  const transfer = settled[0];
  const matching = ledgers.filter(
    (ledger) => ledger.gatewayReferenceId === transfer.settlementId,
  );
  const reversalTotal = decimalSum(
    transfer.reversals
      .filter((reversal) => reversal.state === RouteReversalState.PROCESSED)
      .map((reversal) => reversal.amount),
  );
  const receipt = transfer.reconciledReceipts.some(
    (candidate) => candidate.eventClass === "SETTLEMENT_RECORDED",
  );
  const coherent =
    matching.length === 1 &&
    receipt &&
    transfer.snapshotMode === "CURRENT_C05" &&
    transfer.currency === row.currency &&
    transfer.amount.equals(row.entitlementAmount) &&
    Boolean(transfer.settledAt) &&
    transfer.reversals.every(
      (reversal) =>
        reversal.state === RouteReversalState.PROCESSED &&
        reversal.currency === row.currency &&
        reversal.processedAt,
    ) &&
    !reversalTotal.greaterThan(transfer.amount) &&
    matching[0].brandProfileId === row.brandProfileId &&
    matching[0].vaultId === row.vaultId &&
    matching[0].collaborationId === row.collaborationId &&
    matching[0].currency === row.currency &&
    matching[0].amount.equals(transfer.amount);
  return {
    ok: coherent,
    netSettled: coherent ? transfer.amount.sub(reversalTotal) : new Decimal(0),
  };
}

export function classifySummary(
  item: CreatorPayoutObligationItem,
  asOf: Date,
): CreatorPayoutSummaryFamily | null {
  if (item.legacy || !item.outstanding_value) return null;
  if (new Decimal(item.outstanding_value.amount).equals(0)) return null;
  if (item.lifecycle === "PROCESSING" || item.lifecycle === "READY_QUEUED")
    return "PROCESSING";
  if (
    item.lifecycle === "ACTION_REQUIRED" ||
    item.lifecycle === "FAILED_RETRYABLE" ||
    item.effective_gate !== "NOT_YET_DUE" ||
    new Date(item.payment_due_at!).getTime() <= asOf.getTime()
  )
    return "DUE_OR_ACTION_REQUIRED";
  return "UPCOMING";
}

export function resolveProviderDisabledGate(
  storedGate: CreatorPayoutObligationItem["effective_gate"],
  paymentDueAt: Date,
  asOf: Date,
): CreatorPayoutObligationItem["effective_gate"] {
  if (storedGate !== "READY" && storedGate !== "NOT_YET_DUE") return storedGate;
  return paymentDueAt.getTime() > asOf.getTime()
    ? "NOT_YET_DUE"
    : "PROVIDER_UNAVAILABLE";
}

function stripReference(value: string): string {
  return value.startsWith("payout-obligation:")
    ? value.slice("payout-obligation:".length)
    : value;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: "CREATOR_PAYOUT_RESOURCE_NOT_FOUND",
    message: "The requested payout resource was not found.",
  });
}
