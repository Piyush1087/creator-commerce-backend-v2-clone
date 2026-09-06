import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CreatorPayoutDestinationState,
  CreatorPayoutDestinationType,
  CreatorPayoutObligationStatus,
  EscrowTransactionStatus,
  EscrowTransactionType,
  Prisma,
  RouteReversalState,
  RouteSettlementState,
  RouteTransferState,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { projectBrandPayoutsViewerV2 } from "../contracts/brand-payouts-authorization.contract";
import {
  BRAND_PAYOUTS_V2_SCHEMA_VERSION,
  type BrandPayoutsObligationDetailResponseV2,
  type BrandPayoutsObligationGate,
  type BrandPayoutsObligationItemV2,
  type BrandPayoutsObligationLifecycle,
  type BrandPayoutsObligationsResponseV2,
} from "../contracts/brand-payouts-v2.contract";
import type {
  BrandPayoutsDetailReadRequestV2,
  BrandPayoutsObligationsPageRequestV2,
} from "../ports/brand-payouts-read.port";
import {
  BrandPayoutsCursorCodec,
  stableFilterKey,
} from "../utils/brand-payouts-cursor";
import {
  decimalSum,
  exactMoney,
  maxObservedAt,
  utcInstant,
} from "../utils/brand-payouts-projection";
import { BrandPayoutsReadEnvironmentService } from "./brand-payouts-read-environment.service";

const obligationSelect =
  Prisma.validator<Prisma.CreatorPayoutObligationSelect>()({
    id: true,
    settlementInstructionId: true,
    collaborationId: true,
    vaultId: true,
    brandProfileId: true,
    creatorProfileId: true,
    entitlementAmount: true,
    currency: true,
    status: true,
    instructionIssuedAt: true,
    paymentDueAt: true,
    blockedReason: true,
    settledAt: true,
    terminalAt: true,
    createdAt: true,
    updatedAt: true,
    vault: {
      select: {
        id: true,
        brandProfileId: true,
        currency: true,
        updatedAt: true,
      },
    },
    collaboration: {
      select: {
        id: true,
        brandProfileId: true,
        campaignId: true,
        updatedAt: true,
        creatorUser: {
          select: {
            creatorProfile: { select: { id: true, updatedAt: true } },
          },
        },
      },
    },
    creatorProfile: {
      select: {
        id: true,
        updatedAt: true,
        payoutDestinations: {
          select: {
            id: true,
            isPrimary: true,
            version: true,
            countryCode: true,
            currencyCode: true,
            destinationType: true,
            state: true,
            reasonCode: true,
            updatedAt: true,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        },
      },
    },
    payoutProfile: {
      select: {
        creatorProfileId: true,
        onboardingStatus: true,
        bankStatus: true,
        operationalEligibility: true,
        eligibilityInvalidatedAt: true,
        lastProviderReconciledAt: true,
        stateVersion: true,
        updatedAt: true,
      },
    },
    fundingAllocations: {
      select: {
        obligationId: true,
        collaborationAllocationId: true,
        allocatedAmount: true,
        consumedAmount: true,
        reversedAmount: true,
        fundingLotId: true,
        updatedAt: true,
        fundingLot: {
          select: {
            id: true,
            vaultId: true,
            brandProfileId: true,
            currency: true,
            updatedAt: true,
          },
        },
        collaborationAllocation: {
          select: {
            id: true,
            collaborationId: true,
            fundingLotId: true,
            updatedAt: true,
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
        onHold: true,
        settlementId: true,
        initiatedAt: true,
        providerAcceptedAt: true,
        processedAt: true,
        releasedAt: true,
        settledAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
        reversals: {
          select: {
            id: true,
            amount: true,
            currency: true,
            state: true,
            initiatedAt: true,
            processedAt: true,
            failedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
  });

const settlementLedgerSelect =
  Prisma.validator<Prisma.EscrowTransactionLedgerSelect>()({
    id: true,
    gatewayReferenceId: true,
    brandProfileId: true,
    vaultId: true,
    collaborationId: true,
    transactionType: true,
    transactionStatus: true,
    amount: true,
    currency: true,
    createdAt: true,
  });

type ObligationRow = Prisma.CreatorPayoutObligationGetPayload<{
  select: typeof obligationSelect;
}>;
type SettlementRow = Prisma.EscrowTransactionLedgerGetPayload<{
  select: typeof settlementLedgerSelect;
}>;
type SettlementEvidence = ReadonlyMap<string, readonly SettlementRow[]>;

@Injectable()
export class PayoutObligationProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursors: BrandPayoutsCursorCodec,
    private readonly environment: BrandPayoutsReadEnvironmentService,
  ) {}

  async listObligations(
    request: BrandPayoutsObligationsPageRequestV2,
  ): Promise<BrandPayoutsObligationsResponseV2> {
    const lifecycles = [...new Set(request.lifecycles ?? [])].sort();
    const gates = [...new Set(request.gates ?? [])].sort();
    const filterKey = stableFilterKey({ lifecycles, gates });
    const boundary = this.cursors.decode({
      cursor: request.cursor,
      endpoint: "obligations",
      filterKey,
      authorization: request.authorization,
      requestAsOf: request.asOf,
    });
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      return emptyCampaignManagerObligations(request, boundary.asOf);
    }
    await this.environment.assertDatabaseUtc();
    const limit = Math.min(Math.max(request.limit, 1), 100);
    const target = limit + 1;
    const batchSize = Math.max(target, 100);
    let scanAt = boundary.lastRecordedAt;
    let scanId = boundary.lastStableId
      ? stripReference(boundary.lastStableId, "payout-obligation:")
      : null;
    let sourceExhausted = false;
    let integrityRowsOmitted = false;
    const projected: Array<{
      readonly item: BrandPayoutsObligationItemV2;
      readonly createdAt: Date;
    }> = [];

    while (projected.length < target && !sourceExhausted) {
      const rows = await this.prisma.creatorPayoutObligation.findMany({
        where: {
          brandProfileId: request.authorization.brandProfileId,
          collaboration: {
            brandProfileId: request.authorization.brandProfileId,
          },
          vault: { brandProfileId: request.authorization.brandProfileId },
          createdAt: { lte: scanAt ?? boundary.asOf },
          ...(scanAt && scanId
            ? {
                OR: [
                  { createdAt: { lt: scanAt } },
                  { createdAt: scanAt, id: { lt: scanId } },
                ],
              }
            : {}),
        },
        select: obligationSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: batchSize,
      });
      sourceExhausted = rows.length < batchSize;
      const evidence = await this.readSettlementEvidence(
        request.authorization.brandProfileId,
        rows,
        boundary.asOf,
      );
      for (const row of rows) {
        const result = projectObligation(row, evidence);
        if (!result.item) {
          integrityRowsOmitted ||= result.integrityConflict;
          continue;
        }
        if (
          (lifecycles.length === 0 ||
            lifecycles.includes(result.item.lifecycle)) &&
          (gates.length === 0 || gates.includes(result.item.current_gate))
        ) {
          projected.push({ item: result.item, createdAt: row.createdAt });
        }
      }
      const last = rows.at(-1);
      if (!last) break;
      scanAt = last.createdAt;
      scanId = last.id;
    }

    const pageRows = projected.slice(0, limit);
    const hasNext = projected.length > limit || !sourceExhausted;
    const last = pageRows.at(-1);
    const observedAt = maxObservedAt(
      pageRows.map(({ item }) => new Date(item.last_observed_at)),
    );
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(boundary.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "OBLIGATIONS",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: observedAt ? utcInstant(observedAt) : null,
          source_coverage: obligationSourceCoverage(integrityRowsOmitted),
          legacy_limitations: [
            obligationLegacyLimitation(),
            ...(integrityRowsOmitted
              ? [obligationOwnershipConflictLimitation()]
              : []),
          ],
          available_actions: [],
          payload: pageRows.map(({ item }) => item),
          page: {
            next_cursor:
              hasNext && last
                ? this.cursors.encode({
                    endpoint: "obligations",
                    filterKey,
                    authorization: request.authorization,
                    asOf: boundary.asOf,
                    lastRecordedAt: last.createdAt,
                    lastStableId: last.item.public_reference,
                  })
                : null,
            page_complete: !hasNext,
            source_complete: false,
          },
        },
      ],
    };
  }

  async readObligation(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsObligationDetailResponseV2> {
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      throw obligationNotFound();
    }
    await this.environment.assertDatabaseUtc();
    const id = stripReference(request.resourceId, "payout-obligation:");
    const row = await this.prisma.creatorPayoutObligation.findFirst({
      where: {
        id,
        brandProfileId: request.authorization.brandProfileId,
        collaboration: {
          brandProfileId: request.authorization.brandProfileId,
        },
        vault: { brandProfileId: request.authorization.brandProfileId },
        createdAt: { lte: request.asOf },
      },
      select: obligationSelect,
    });
    if (!row) throw obligationNotFound();
    const evidence = await this.readSettlementEvidence(
      request.authorization.brandProfileId,
      [row],
      request.asOf,
    );
    const projected = projectObligation(row, evidence);
    if (!projected.item) throw obligationNotFound();
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(request.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "OBLIGATIONS",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: projected.item.last_observed_at,
          source_coverage: obligationSourceCoverage(false),
          legacy_limitations: [obligationLegacyLimitation()],
          available_actions: [
            {
              action: "VIEW_DETAIL",
              resource_reference: projected.item.public_reference,
              resource_version: projected.item.resource_version,
              authorized_as_of: utcInstant(request.asOf),
            },
          ],
          payload: projected.item,
        },
      ],
    };
  }

  private async readSettlementEvidence(
    brandProfileId: string,
    rows: readonly ObligationRow[],
    asOf: Date,
  ): Promise<SettlementEvidence> {
    const settlementIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.transfers
            .map((transfer) => transfer.settlementId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    if (settlementIds.length === 0) return new Map();
    const ledgers = await this.prisma.escrowTransactionLedger.findMany({
      where: {
        brandProfileId,
        gatewayReferenceId: { in: settlementIds },
        transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
        transactionStatus: EscrowTransactionStatus.CLEARED,
        createdAt: { lte: asOf },
      },
      select: settlementLedgerSelect,
    });
    const grouped = new Map<string, SettlementRow[]>();
    for (const ledger of ledgers) {
      if (!ledger.gatewayReferenceId) continue;
      grouped.set(ledger.gatewayReferenceId, [
        ...(grouped.get(ledger.gatewayReferenceId) ?? []),
        ledger,
      ]);
    }
    return grouped;
  }
}

function projectObligation(
  row: ObligationRow,
  evidence: SettlementEvidence,
): {
  readonly item: BrandPayoutsObligationItemV2 | null;
  readonly integrityConflict: boolean;
} {
  const integrity = inspectIntegrity(row);
  if (!integrity.referencesExposable) {
    return { item: null, integrityConflict: true };
  }
  const execution = inspectExecution(row, evidence, integrity.valid);
  const gate = integrity.valid ? inspectGate(row) : unavailableIntegrityGate();
  const limitation = integrity.valid
    ? (execution.limitationReason ?? "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE")
    : integrity.reason;
  const observedAt = maxProjectionObservedAt(row, evidence);
  return {
    integrityConflict: !integrity.valid,
    item: {
      obligation_id: row.id,
      public_reference: `payout-obligation:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      campaign_id: row.collaboration.campaignId,
      collaboration_id: row.collaborationId,
      creator_reference: row.creatorProfileId,
      lifecycle: execution.lifecycle,
      current_gate: gate.gate,
      blocking_reason_code: gate.reason ?? limitation,
      recovery_reference: gate.recoveryReference,
      entitlement_value: integrity.valid
        ? exactMoney(row.entitlementAmount, row.currency)
        : null,
      settled_value:
        integrity.valid && execution.settledAmount
          ? exactMoney(execution.settledAmount, row.currency)
          : null,
      reversed_value:
        integrity.valid && execution.reversedAmount
          ? exactMoney(execution.reversedAmount, row.currency)
          : null,
      outstanding_value:
        integrity.valid && execution.outstandingAmount
          ? exactMoney(execution.outstandingAmount, row.currency)
          : null,
      // Current rows do not prove the immutable C-04 term and eligibility
      // anchor. A stored legacy value must not be upgraded into Product truth.
      payment_due_at: null,
      last_observed_at: utcInstant(observedAt),
      legacy: {
        classification: integrity.valid
          ? "DISPLAY_WITH_LIMITATION"
          : "LEGACY_UNRECONCILED",
        limitation_reason_code: limitation,
      },
    },
  };
}

function inspectIntegrity(row: ObligationRow): {
  readonly valid: boolean;
  readonly reason: string;
  readonly referencesExposable: boolean;
} {
  if (
    !row.entitlementAmount.greaterThan(0) ||
    row.collaborationId !== row.collaboration.id ||
    row.brandProfileId !== row.collaboration.brandProfileId ||
    row.brandProfileId !== row.vault.brandProfileId ||
    row.creatorProfileId !== row.creatorProfile.id ||
    row.creatorProfileId !== row.payoutProfile.creatorProfileId ||
    row.creatorProfileId !== row.collaboration.creatorUser.creatorProfile?.id ||
    row.vaultId !== row.vault.id ||
    row.currency !== row.vault.currency
  ) {
    return {
      valid: false,
      reason: "LEGACY_OWNERSHIP_OR_CURRENCY_CONFLICT",
      referencesExposable: false,
    };
  }
  if (row.fundingAllocations.length === 0) {
    return {
      valid: false,
      reason: "PROTECTED_FUNDING_EVIDENCE_UNAVAILABLE",
      referencesExposable: true,
    };
  }
  const allocationsValid = row.fundingAllocations.every(
    (allocation) =>
      allocation.obligationId === row.id &&
      allocation.collaborationAllocation.id ===
        allocation.collaborationAllocationId &&
      allocation.fundingLot.id === allocation.fundingLotId &&
      allocation.fundingLot.brandProfileId === row.brandProfileId &&
      allocation.fundingLot.vaultId === row.vaultId &&
      allocation.fundingLot.currency === row.currency &&
      allocation.collaborationAllocation.collaborationId ===
        row.collaborationId &&
      allocation.collaborationAllocation.fundingLotId ===
        allocation.fundingLotId &&
      allocation.allocatedAmount.greaterThan(0) &&
      allocation.consumedAmount.greaterThanOrEqualTo(0) &&
      allocation.reversedAmount.greaterThanOrEqualTo(0) &&
      allocation.consumedAmount.lessThanOrEqualTo(allocation.allocatedAmount) &&
      allocation.reversedAmount.lessThanOrEqualTo(allocation.consumedAmount),
  );
  const allocated = decimalSum(
    row.fundingAllocations.map((allocation) => allocation.allocatedAmount),
  );
  if (!allocationsValid || !allocated.equals(row.entitlementAmount)) {
    return {
      valid: false,
      reason: "PROTECTED_FUNDING_LINEAGE_CONFLICT",
      referencesExposable: true,
    };
  }
  return {
    valid: true,
    reason: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
    referencesExposable: true,
  };
}

function inspectExecution(
  row: ObligationRow,
  evidence: SettlementEvidence,
  integrityValid: boolean,
): {
  readonly lifecycle: BrandPayoutsObligationLifecycle;
  readonly settledAmount: Decimal | null;
  readonly reversedAmount: Decimal | null;
  readonly outstandingAmount: Decimal | null;
  readonly limitationReason: string | null;
} {
  if (!integrityValid) return legacyExecution();
  const settledTransfers = row.transfers.filter(
    (transfer) => transfer.settlementState === RouteSettlementState.SETTLED,
  );
  let settledAmount = new Decimal(0);
  let reversedAmount = new Decimal(0);
  let settlementCoherent = settledTransfers.length === 0;

  if (settledTransfers.length === 1) {
    const transfer = settledTransfers[0];
    const ledgers = transfer.settlementId
      ? evidence.get(transfer.settlementId)
      : undefined;
    const ledger = ledgers?.length === 1 ? ledgers[0] : undefined;
    const processedReversals = transfer.reversals.filter(
      (reversal) => reversal.state === RouteReversalState.PROCESSED,
    );
    const reversalTotal = decimalSum(
      processedReversals.map((reversal) => reversal.amount),
    );
    const expectedStatus = reversalTotal.equals(transfer.amount)
      ? CreatorPayoutObligationStatus.REVERSED
      : reversalTotal.greaterThan(0)
        ? CreatorPayoutObligationStatus.PARTIALLY_REVERSED
        : CreatorPayoutObligationStatus.SETTLED;
    const expectedTransferState = reversalTotal.equals(transfer.amount)
      ? RouteTransferState.REVERSED
      : reversalTotal.greaterThan(0)
        ? RouteTransferState.PARTIALLY_REVERSED
        : RouteTransferState.PROCESSED;
    const reversalsCoherent = transfer.reversals.every(
      (reversal) =>
        reversal.state === RouteReversalState.PROCESSED &&
        reversal.currency === row.currency &&
        reversal.amount.greaterThan(0) &&
        Boolean(reversal.processedAt) &&
        !reversal.failedAt &&
        reversal.initiatedAt.getTime() >=
          (transfer.settledAt?.getTime() ?? Number.POSITIVE_INFINITY) &&
        reversal.initiatedAt.getTime() <=
          (reversal.processedAt?.getTime() ?? Number.NEGATIVE_INFINITY) &&
        (reversal.processedAt?.getTime() ?? Number.POSITIVE_INFINITY) <=
          reversal.updatedAt.getTime(),
    );
    settlementCoherent = Boolean(
      transfer.settledAt &&
      transferTimestampsCoherent(transfer) &&
      ledger &&
      reversalsCoherent &&
      row.status === expectedStatus &&
      transfer.state === expectedTransferState &&
      ledger.brandProfileId === row.brandProfileId &&
      ledger.vaultId === row.vaultId &&
      ledger.collaborationId === row.collaborationId &&
      ledger.currency === row.currency &&
      ledger.amount.equals(transfer.amount) &&
      transfer.currency === row.currency &&
      transfer.amount.equals(row.entitlementAmount) &&
      !reversalTotal.greaterThan(transfer.amount),
    );
    if (settlementCoherent) {
      settledAmount = transfer.amount;
      reversedAmount = reversalTotal;
    }
  } else if (settledTransfers.length > 1) {
    settlementCoherent = false;
  }

  if (!settlementCoherent) {
    return {
      ...legacyExecution(),
      limitationReason: "SETTLEMENT_OR_REVERSAL_LINEAGE_CONFLICT",
    };
  }
  const outstandingAmount = Decimal.max(
    new Decimal(0),
    row.entitlementAmount.sub(settledAmount.sub(reversedAmount)),
  );
  if (settledAmount.greaterThan(0)) {
    return {
      lifecycle: reversedAmount.equals(settledAmount)
        ? "FULL_REVERSAL"
        : reversedAmount.greaterThan(0)
          ? "PARTIAL_REVERSAL"
          : "SETTLED",
      settledAmount,
      reversedAmount,
      outstandingAmount,
      limitationReason: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
    };
  }

  const activeTransfer = row.transfers[0] ?? null;
  const activeLifecycle = activeTransfer
    ? classifyInFlightTransfer(activeTransfer)
    : null;
  if (
    row.status === CreatorPayoutObligationStatus.EXECUTING &&
    activeTransfer &&
    activeTransfer.amount.equals(row.entitlementAmount) &&
    activeTransfer.currency === row.currency &&
    decimalSum(
      row.fundingAllocations.map((allocation) => allocation.consumedAmount),
    ).equals(activeTransfer.amount) &&
    activeLifecycle
  ) {
    return {
      lifecycle: activeLifecycle,
      settledAmount,
      reversedAmount,
      outstandingAmount,
      limitationReason: "IMMUTABLE_TRANSFER_MILESTONES_INCOMPLETE",
    };
  }
  if (
    row.status === CreatorPayoutObligationStatus.BLOCKED &&
    isSafeBlockedReason(row.blockedReason)
  ) {
    return {
      lifecycle: "ACTION_REQUIRED",
      settledAmount,
      reversedAmount,
      outstandingAmount,
      limitationReason: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
    };
  }
  return {
    lifecycle: "LEGACY_UNRECONCILED",
    settledAmount,
    reversedAmount,
    outstandingAmount,
    limitationReason: "CANONICAL_EXECUTION_STATE_UNPROVEN",
  };
}

function legacyExecution() {
  return {
    lifecycle: "LEGACY_UNRECONCILED" as const,
    settledAmount: null,
    reversedAmount: null,
    outstandingAmount: null,
    limitationReason: "CANONICAL_EXECUTION_STATE_UNPROVEN",
  };
}

function classifyInFlightTransfer(
  transfer: ObligationRow["transfers"][number],
): "PROCESSING" | "HELD_RELEASE_PENDING" | null {
  if (
    !transferTimestampsCoherent(transfer) ||
    transfer.failedAt ||
    transfer.settledAt ||
    transfer.reversals.length > 0 ||
    new Set<RouteTransferState>([
      RouteTransferState.FAILED,
      RouteTransferState.UNKNOWN,
      RouteTransferState.REVERSED,
      RouteTransferState.PARTIALLY_REVERSED,
    ]).has(transfer.state) ||
    new Set<RouteSettlementState>([
      RouteSettlementState.BLOCKED,
      RouteSettlementState.UNKNOWN,
      RouteSettlementState.SETTLED,
    ]).has(transfer.settlementState)
  ) {
    return null;
  }
  const held = transfer.settlementState === RouteSettlementState.HELD;
  if (transfer.onHold !== held) return null;
  if (transfer.state === RouteTransferState.CREATED) {
    return !held &&
      transfer.settlementState === RouteSettlementState.PENDING &&
      !transfer.providerAcceptedAt &&
      !transfer.processedAt
      ? "PROCESSING"
      : null;
  }
  if (transfer.state === RouteTransferState.PENDING) {
    return transfer.providerAcceptedAt &&
      !transfer.processedAt &&
      !transfer.releasedAt
      ? held
        ? "HELD_RELEASE_PENDING"
        : "PROCESSING"
      : null;
  }
  if (transfer.state === RouteTransferState.PROCESSED) {
    if (!transfer.providerAcceptedAt || !transfer.processedAt) return null;
    if (held) return !transfer.releasedAt ? "HELD_RELEASE_PENDING" : null;
    return "PROCESSING";
  }
  return null;
}

function transferTimestampsCoherent(
  transfer: ObligationRow["transfers"][number],
): boolean {
  const sequence = [
    transfer.initiatedAt,
    transfer.providerAcceptedAt,
    transfer.processedAt,
    transfer.releasedAt,
    transfer.settledAt,
  ].filter((value): value is Date => Boolean(value));
  return (
    transfer.createdAt.getTime() <= transfer.initiatedAt.getTime() &&
    !Boolean(transfer.failedAt && transfer.settledAt) &&
    (!transfer.failedAt ||
      (transfer.failedAt.getTime() >= transfer.initiatedAt.getTime() &&
        transfer.failedAt.getTime() <= transfer.updatedAt.getTime())) &&
    sequence.every(
      (value, index) =>
        value.getTime() <= transfer.updatedAt.getTime() &&
        (index === 0 || value.getTime() >= sequence[index - 1].getTime()),
    )
  );
}

function inspectGate(row: ObligationRow): {
  readonly gate: BrandPayoutsObligationGate;
  readonly reason: string;
  readonly recoveryReference: string | null;
} {
  const destinations = row.creatorProfile.payoutDestinations.filter(
    (destination) =>
      destination.isPrimary &&
      destination.state !== CreatorPayoutDestinationState.DISABLED,
  );
  if (destinations.length === 0) {
    return {
      gate: "CREATOR_SETUP_REQUIRED",
      reason: "CREATOR_PAYOUT_DESTINATION_REQUIRED",
      recoveryReference: "creator-payout-setup",
    };
  }
  if (destinations.length > 1) {
    return {
      gate: "DEPENDENCY_UNAVAILABLE",
      reason: "CREATOR_PRIMARY_DESTINATION_AMBIGUOUS",
      recoveryReference: null,
    };
  }
  const destination = destinations[0];
  if (
    destination.countryCode !== "IN" ||
    destination.currencyCode !== "INR" ||
    destination.destinationType !== CreatorPayoutDestinationType.BANK_ACCOUNT
  ) {
    return {
      gate: "UNSUPPORTED_GEOGRAPHY_OR_RAIL",
      reason: "UNSUPPORTED_GEOGRAPHY_OR_RAIL",
      recoveryReference: null,
    };
  }
  if (
    destination.state !== CreatorPayoutDestinationState.CONFIGURED_UNVERIFIED
  ) {
    return {
      gate: "CREATOR_SETUP_REQUIRED",
      reason: "CREATOR_PAYOUT_DESTINATION_REQUIRES_ATTENTION",
      recoveryReference: "creator-payout-setup",
    };
  }
  if (
    row.payoutProfile.onboardingStatus === "UNDER_REVIEW" ||
    row.payoutProfile.operationalEligibility === "UNDER_REVIEW" ||
    row.payoutProfile.bankStatus === "BANK_VALIDATION_PENDING"
  ) {
    return {
      gate: "PROVIDER_REVIEW",
      reason: "CREATOR_PAYOUT_PROVIDER_REVIEW",
      recoveryReference: null,
    };
  }
  return {
    gate: "DEPENDENCY_UNAVAILABLE",
    reason: "DESTINATION_VERSION_FENCE_UNAVAILABLE",
    recoveryReference: null,
  };
}

function unavailableIntegrityGate() {
  return {
    gate: "DEPENDENCY_UNAVAILABLE" as const,
    reason: "OBLIGATION_INTEGRITY_UNPROVEN",
    recoveryReference: null,
  };
}

function isSafeBlockedReason(reason: string | null): boolean {
  return new Set([
    "PROVIDER_SETUP_REQUIRED",
    "STALE_PROVIDER_ELIGIBILITY",
    "PROVIDER_CAPABILITY_UNAVAILABLE",
    "PROTECTED_FUNDING_REQUIRED",
    "RESOLUTION_BLOCKED",
  ]).has(reason ?? "");
}

function maxProjectionObservedAt(
  row: ObligationRow,
  evidence: SettlementEvidence,
): Date {
  return (
    maxObservedAt([
      row.updatedAt,
      row.vault.updatedAt,
      row.collaboration.updatedAt,
      row.collaboration.creatorUser.creatorProfile?.updatedAt,
      row.creatorProfile.updatedAt,
      row.payoutProfile.updatedAt,
      row.payoutProfile.lastProviderReconciledAt,
      ...row.creatorProfile.payoutDestinations.map(
        (destination) => destination.updatedAt,
      ),
      ...row.fundingAllocations.flatMap((allocation) => [
        allocation.updatedAt,
        allocation.collaborationAllocation.updatedAt,
        allocation.fundingLot.updatedAt,
      ]),
      ...row.transfers.flatMap((transfer) => [
        transfer.updatedAt,
        ...transfer.reversals.map((reversal) => reversal.updatedAt),
        ...(transfer.settlementId
          ? (evidence.get(transfer.settlementId) ?? []).map(
              (ledger) => ledger.createdAt,
            )
          : []),
      ]),
    ]) ?? row.updatedAt
  );
}

function obligationSourceCoverage(integrityRowsOmitted: boolean) {
  return [
    {
      source: "PAYOUT_OBLIGATIONS" as const,
      status: "PARTIAL" as const,
      limitation_reason_code: integrityRowsOmitted
        ? "OWNERSHIP_OR_SUBJECT_INTEGRITY_ROWS_OMITTED"
        : "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
      recovery_hint: null,
    },
  ];
}

function obligationLegacyLimitation() {
  return {
    source: "PAYOUT_OBLIGATIONS" as const,
    reason_code: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
    detail:
      "Current rows do not preserve the immutable C-04 term, eligibility anchor, due rule, and destination-version evidence required for canonical execution.",
  };
}

function obligationOwnershipConflictLimitation() {
  return {
    source: "PAYOUT_OBLIGATIONS" as const,
    reason_code: "OWNERSHIP_OR_SUBJECT_INTEGRITY_ROWS_OMITTED",
    detail:
      "Rows whose Brand, vault, Collaboration, Creator, or currency lineage cannot be proven are omitted.",
  };
}

function emptyCampaignManagerObligations(
  request: BrandPayoutsObligationsPageRequestV2,
  asOf: Date,
): BrandPayoutsObligationsResponseV2 {
  return {
    schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
    as_of: utcInstant(asOf),
    viewer: projectBrandPayoutsViewerV2(request.authorization),
    sections: [
      {
        section_id: "OBLIGATIONS",
        coverage: "UNAVAILABLE",
        freshness: "CURRENT",
        source_observed_at: null,
        source_coverage: [
          {
            source: "PAYOUT_OBLIGATIONS",
            status: "UNAVAILABLE",
            limitation_reason_code: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
            recovery_hint: null,
          },
        ],
        legacy_limitations: [],
        available_actions: [],
        payload: [],
        page: {
          next_cursor: null,
          page_complete: true,
          source_complete: false,
        },
      },
    ],
  };
}

function stripReference(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function obligationNotFound(): NotFoundException {
  return new NotFoundException({
    code: "BRAND_PAYOUTS_OBLIGATION_NOT_FOUND",
    message: "Payout obligation was not found",
  });
}
