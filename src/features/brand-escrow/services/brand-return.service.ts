import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  BrandReturnActionRequiredReason,
  BrandReturnAllocation,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { BrandReturnRefundProvider } from "./brand-return-provider.adapter";
import type {
  BrandReturnProviderCapability,
  BrandReturnProviderOutcome,
} from "./brand-return-provider.types";
import {
  BrandReturnProviderReconciliationRequiredError,
  BrandReturnProviderSetupRequiredError,
} from "./brand-return-provider.types";

const ZERO = new Decimal(0);

type VaultLockRow = {
  vault_id: string;
};

const minorUnits = (amount: Decimal): number => {
  const value = amount.mul(100);
  if (!value.isInteger() || value.greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new BadRequestException(
      "Brand Return amount cannot be represented in minor units",
    );
  }
  return value.toNumber();
};

@Injectable()
export class BrandReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: BrandReturnRefundProvider,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async getSummary(brandProfileId: string) {
    const vault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId },
    });
    if (!vault) {
      return {
        available_balance: 0,
        proven_source_available_balance: 0,
        self_service_returnable_balance: 0,
        active_return_commitment: 0,
        source_reconciliation_required_amount: 0,
        currency: null,
      };
    }
    const lots = await this.prisma.escrowFundingLot.findMany({
      where: { vaultId: vault.id, availableAmount: { gt: ZERO } },
    });
    const capabilities = await this.provider.capabilities();
    const proven = lots
      .filter((lot) => lot.provenanceStatus === "PROVEN_SOURCE")
      .reduce((total, lot) => total.add(lot.availableAmount), ZERO);
    const executable = lots
      .filter(
        (lot) =>
          lot.provenanceStatus === "PROVEN_SOURCE" &&
          Boolean(lot.providerPaymentId) &&
          this.supports(capabilities, lot.sourceType, lot.currency),
      )
      .reduce(
        (total, lot) =>
          total.add(
            Decimal.min(
              lot.availableAmount,
              Decimal.max(
                ZERO,
                lot.providerRefundableAmount
                  .sub(lot.externallyReturnedAmount)
                  .sub(lot.returnCommittedAmount),
              ),
            ),
          ),
        ZERO,
      );
    return {
      available_balance: vault.availableBalance.toNumber(),
      proven_source_available_balance: proven.toNumber(),
      self_service_returnable_balance: executable.toNumber(),
      active_return_commitment: vault.activeReturnCommitment.toNumber(),
      source_reconciliation_required_amount: Decimal.max(
        ZERO,
        vault.availableBalance.sub(proven),
      ).toNumber(),
      currency: vault.currency,
    };
  }

  async listRequests(brandProfileId: string, limit = 50) {
    const requests = await this.prisma.brandReturnRequest.findMany({
      where: { brandProfileId },
      include: { allocations: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
    return requests.map((request) => this.mapRequest(request));
  }

  async getRequest(brandProfileId: string, requestId: string) {
    const request = await this.prisma.brandReturnRequest.findFirst({
      where: { id: requestId, brandProfileId },
      include: { allocations: true },
    });
    if (!request) throw new NotFoundException("Brand Return request not found");
    return this.mapRequest(request);
  }

  async requestReturn(input: {
    brandProfileId: string;
    requestedByUserId: string;
    amount: Decimal.Value;
    requestIdentity: string;
  }) {
    const amount = new Decimal(input.amount);
    if (!amount.greaterThan(0)) {
      throw new BadRequestException("Brand Return amount must be positive");
    }
    const existing = await this.prisma.brandReturnRequest.findUnique({
      where: { requestIdentity: input.requestIdentity },
      include: { allocations: true },
    });
    if (existing) {
      this.assertSameRequest(existing, input.brandProfileId, amount);
      return this.mapRequest(existing);
    }

    try {
      await this.provider.assertExecutionAvailable();
    } catch (error) {
      if (error instanceof BrandReturnProviderSetupRequiredError) {
        throw new ServiceUnavailableException({
          code: "PROVIDER_SETUP_REQUIRED",
          message: error.message,
        });
      }
      throw error;
    }
    const capabilities = await this.provider.capabilities();
    if (!capabilities.length) {
      throw new ServiceUnavailableException({
        code: "PROVIDER_SETUP_REQUIRED",
        message: "No Brand Return provider capability is enabled",
      });
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const vaultRows = await tx.$queryRaw<VaultLockRow[]>`
          SELECT vault_id
          FROM brand_escrow_vaults
          WHERE brand_id = ${input.brandProfileId}
          FOR UPDATE
        `;
      if (!vaultRows.length)
        throw new NotFoundException("Brand escrow vault not found");
      const vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { id: vaultRows[0].vault_id },
      });
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`brand-return-request:${input.requestIdentity}`}))::text`;
      const replay = await tx.brandReturnRequest.findUnique({
        where: { requestIdentity: input.requestIdentity },
        include: { allocations: true },
      });
      if (replay) {
        this.assertSameRequest(replay, input.brandProfileId, amount);
        return replay;
      }
      if (vault.availableBalance.lessThan(amount)) {
        throw new BadRequestException({
          code: "INSUFFICIENT_AVAILABLE_BALANCE",
          available: vault.availableBalance.toNumber(),
        });
      }

      const lots = await tx.escrowFundingLot.findMany({
        where: {
          vaultId: vault.id,
          currency: vault.currency,
          provenanceStatus: "PROVEN_SOURCE",
          providerPaymentId: { not: null },
          availableAmount: { gt: ZERO },
        },
        orderBy: [{ economicAt: "asc" }, { id: "asc" }],
      });
      const candidates = lots
        .filter((lot) =>
          this.supports(capabilities, lot.sourceType, lot.currency),
        )
        .map((lot) => ({
          lot,
          capacity: Decimal.min(
            lot.availableAmount,
            Decimal.max(
              ZERO,
              lot.providerRefundableAmount
                .sub(lot.externallyReturnedAmount)
                .sub(lot.returnCommittedAmount),
            ),
          ),
        }))
        .filter(({ capacity }) => capacity.greaterThan(0));
      const capacity = candidates.reduce(
        (total, row) => total.add(row.capacity),
        ZERO,
      );
      if (capacity.lessThan(amount)) {
        throw new BadRequestException({
          code: "SOURCE_PROVENANCE_REQUIRED",
          proven_returnable_balance: capacity.toNumber(),
          requested_amount: amount.toNumber(),
        });
      }

      const created = await tx.brandReturnRequest.create({
        data: {
          requestIdentity: input.requestIdentity,
          vaultId: vault.id,
          brandProfileId: input.brandProfileId,
          requestedAmount: amount,
          committedAmount: amount,
          unresolvedAmount: amount,
          currency: vault.currency,
          status: "RETURN_REQUESTED",
          requestedByUserId: input.requestedByUserId,
        },
      });
      await tx.brandReturnRequest.update({
        where: { id: created.id },
        data: { status: "ALLOCATING_SOURCES" },
      });
      let remaining = amount;
      for (const { lot, capacity: lotCapacity } of candidates) {
        if (!remaining.greaterThan(0)) break;
        const allocated = Decimal.min(remaining, lotCapacity);
        await tx.escrowFundingLot.update({
          where: { id: lot.id },
          data: {
            availableAmount: { decrement: allocated },
            returnCommittedAmount: { increment: allocated },
          },
        });
        await tx.brandReturnAllocation.create({
          data: {
            requestId: created.id,
            fundingLotId: lot.id,
            semanticIdentity: `brand-return:${created.id}:${lot.id}`,
            providerPaymentId: lot.providerPaymentId!,
            amount: allocated,
            currency: vault.currency,
          },
        });
        remaining = remaining.sub(allocated);
      }
      if (remaining.greaterThan(0)) {
        throw new ConflictException(
          "Brand Return allocation did not consume its committed amount",
        );
      }
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          availableBalance: { decrement: amount },
          activeReturnCommitment: { increment: amount },
        },
      });
      await tx.brandReturnRequest.update({
        where: { id: created.id },
        data: { status: "PROCESSING", processingAt: new Date() },
      });
      return tx.brandReturnRequest.findUniqueOrThrow({
        where: { id: created.id },
        include: { allocations: true },
      });
    });
    return this.mapRequest(request);
  }

  async executeRequest(requestId: string) {
    const request = await this.prisma.brandReturnRequest.findUnique({
      where: { id: requestId },
      include: { allocations: { orderBy: { createdAt: "asc" } } },
    });
    if (!request) throw new NotFoundException("Brand Return request not found");
    for (const allocation of request.allocations) {
      if (allocation.state === "READY") {
        const prepared = await this.markProcessing(allocation.id);
        if (!prepared) continue;
        try {
          const outcome = await this.provider.createRefund({
            semanticIdentity: prepared.semanticIdentity,
            providerPaymentId: prepared.providerPaymentId,
            amountMinor: minorUnits(prepared.amount),
            currency: prepared.currency,
          });
          await this.applyProviderOutcome(prepared.id, outcome);
        } catch (error) {
          await this.handleProviderError(prepared.id, error);
        }
      } else if (allocation.state === "PROCESSING") {
        try {
          const outcome = await this.provider.fetchRefund({
            semanticIdentity: allocation.semanticIdentity,
            providerRefundId: allocation.providerRefundId,
          });
          await this.applyProviderOutcome(allocation.id, outcome);
        } catch (error) {
          await this.handleProviderError(allocation.id, error);
        }
      }
    }
    return this.getRequest(request.brandProfileId, request.id);
  }

  async reconcileProviderRefund(
    providerRefundId: string,
    outcome: BrandReturnProviderOutcome,
  ) {
    const allocation = await this.prisma.brandReturnAllocation.findUnique({
      where: { providerRefundId },
    });
    if (!allocation)
      throw new NotFoundException("Brand Return provider refund not found");
    return this.applyProviderOutcome(allocation.id, outcome);
  }

  private async markProcessing(allocationId: string) {
    const authority = await this.prisma.brandReturnAllocation.findUnique({
      where: { id: allocationId },
      include: { request: true },
    });
    if (!authority) return null;
    return this.prisma.$transaction(async (tx) => {
      await this.lockVault(tx, authority.request.vaultId);
      const allocation = await tx.brandReturnAllocation.findUnique({
        where: { id: allocationId },
      });
      if (!allocation || allocation.state !== "READY") return null;
      return tx.brandReturnAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "PROCESSING",
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
    });
  }

  private async applyProviderOutcome(
    allocationId: string,
    outcome: BrandReturnProviderOutcome,
  ) {
    if (outcome.kind === "SUCCEEDED") {
      return this.applySuccess(
        allocationId,
        outcome.providerRefundId,
        outcome.providerState,
      );
    }
    if (outcome.kind === "TERMINAL_REJECTION") {
      return this.applyTerminalRelease(
        allocationId,
        outcome.providerState,
        outcome.diagnosticCode,
      );
    }
    if (outcome.kind === "AMBIGUOUS") {
      return this.markActionRequired(allocationId, {
        reason: "PROVIDER_OUTCOME_AMBIGUOUS",
        providerRefundId: outcome.providerRefundId,
        providerState: outcome.providerState,
        diagnosticCode: outcome.diagnosticCode,
      });
    }
    return this.markRetryable(
      allocationId,
      outcome.providerState,
      outcome.diagnosticCode,
    );
  }

  private async applySuccess(
    allocationId: string,
    providerRefundId: string,
    providerState: string,
  ) {
    const authority = await this.allocationAuthority(allocationId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockVault(tx, authority.request.vaultId);
      const allocation = await tx.brandReturnAllocation.findUniqueOrThrow({
        where: { id: allocationId },
      });
      if (allocation.state === "SUCCEEDED") return allocation;
      if (allocation.state === "RELEASED") {
        throw new ConflictException(
          "Released Brand Return allocation cannot later succeed automatically",
        );
      }
      await tx.escrowFundingLot.update({
        where: { id: allocation.fundingLotId },
        data: {
          returnCommittedAmount: { decrement: allocation.amount },
          externallyReturnedAmount: { increment: allocation.amount },
        },
      });
      await tx.brandEscrowVault.update({
        where: { id: authority.request.vaultId },
        data: {
          activeReturnCommitment: { decrement: allocation.amount },
          totalPooledBalance: { decrement: allocation.amount },
        },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: authority.request.vaultId,
          brandProfileId: authority.request.brandProfileId,
          transactionType: "BRAND_RETURN",
          amount: allocation.amount,
          currency: allocation.currency,
          idempotencyKey: `brand-return-allocation:${allocation.id}`,
          gatewayReferenceId: providerRefundId,
          transactionStatus: "CLEARED",
        },
      });
      const updated = await tx.brandReturnAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "SUCCEEDED",
          actionRequiredReason: null,
          providerRefundId,
          providerState,
          succeededAt: new Date(),
        },
      });
      await this.refreshRequestAggregate(tx, authority.request.id);
      return updated;
    });
  }

  private async applyTerminalRelease(
    allocationId: string,
    providerState?: string,
    diagnosticCode?: string,
  ) {
    const authority = await this.allocationAuthority(allocationId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockVault(tx, authority.request.vaultId);
      const allocation = await tx.brandReturnAllocation.findUniqueOrThrow({
        where: { id: allocationId },
      });
      if (["RELEASED", "SUCCEEDED"].includes(allocation.state))
        return allocation;
      await tx.escrowFundingLot.update({
        where: { id: allocation.fundingLotId },
        data: {
          returnCommittedAmount: { decrement: allocation.amount },
          availableAmount: { increment: allocation.amount },
        },
      });
      await tx.brandEscrowVault.update({
        where: { id: authority.request.vaultId },
        data: {
          activeReturnCommitment: { decrement: allocation.amount },
          availableBalance: { increment: allocation.amount },
        },
      });
      const updated = await tx.brandReturnAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "RELEASED",
          providerState,
          diagnosticPayload: diagnosticCode
            ? { code: diagnosticCode }
            : undefined,
          releasedAt: new Date(),
        },
      });
      await this.refreshRequestAggregate(tx, authority.request.id);
      return updated;
    });
  }

  private async markActionRequired(
    allocationId: string,
    input: {
      reason: BrandReturnActionRequiredReason;
      providerRefundId?: string;
      providerState?: string;
      diagnosticCode?: string;
    },
  ) {
    const authority = await this.allocationAuthority(allocationId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockVault(tx, authority.request.vaultId);
      const allocation = await tx.brandReturnAllocation.findUniqueOrThrow({
        where: { id: allocationId },
      });
      if (["SUCCEEDED", "RELEASED"].includes(allocation.state))
        return allocation;
      const updated = await tx.brandReturnAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "ACTION_REQUIRED",
          actionRequiredReason: input.reason,
          providerRefundId: input.providerRefundId,
          providerState: input.providerState,
          diagnosticPayload: input.diagnosticCode
            ? { code: input.diagnosticCode }
            : undefined,
        },
      });
      await this.refreshRequestAggregate(tx, authority.request.id);
      return updated;
    });
  }

  private async markRetryable(
    allocationId: string,
    providerState?: string,
    diagnosticCode?: string,
  ) {
    const authority = await this.allocationAuthority(allocationId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockVault(tx, authority.request.vaultId);
      const allocation = await tx.brandReturnAllocation.findUniqueOrThrow({
        where: { id: allocationId },
      });
      if (["SUCCEEDED", "RELEASED"].includes(allocation.state))
        return allocation;
      const updated = await tx.brandReturnAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "READY",
          providerState,
          diagnosticPayload: diagnosticCode
            ? { code: diagnosticCode }
            : undefined,
        },
      });
      await this.refreshRequestAggregate(tx, authority.request.id);
      return updated;
    });
  }

  private async handleProviderError(allocationId: string, error: unknown) {
    const reason: BrandReturnActionRequiredReason =
      error instanceof BrandReturnProviderSetupRequiredError
        ? "PROVIDER_SETUP_REQUIRED"
        : error instanceof BrandReturnProviderReconciliationRequiredError
          ? "PROVIDER_RECONCILIATION_REQUIRED"
          : "PROVIDER_OUTCOME_AMBIGUOUS";
    return this.markActionRequired(allocationId, {
      reason,
      diagnosticCode:
        error instanceof Error ? error.name : "UNKNOWN_PROVIDER_ERROR",
    });
  }

  private async refreshRequestAggregate(
    tx: Prisma.TransactionClient,
    requestId: string,
  ) {
    const request = await tx.brandReturnRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { allocations: true },
    });
    let successful = ZERO;
    let released = ZERO;
    let unresolved = ZERO;
    let reason: BrandReturnActionRequiredReason | null = null;
    for (const allocation of request.allocations) {
      if (allocation.state === "SUCCEEDED")
        successful = successful.add(allocation.amount);
      else if (allocation.state === "RELEASED")
        released = released.add(allocation.amount);
      else {
        unresolved = unresolved.add(allocation.amount);
        reason ??= allocation.actionRequiredReason;
      }
    }
    const hasActionRequired = request.allocations.some(
      (allocation) => allocation.state === "ACTION_REQUIRED",
    );
    const status = successful.equals(request.requestedAmount)
      ? "COMPLETED"
      : unresolved.isZero()
        ? successful.greaterThan(0)
          ? "PARTIAL"
          : "FAILED"
        : successful.greaterThan(0)
          ? "PARTIAL"
          : hasActionRequired
            ? "ACTION_REQUIRED"
            : "PROCESSING";
    const updated = await tx.brandReturnRequest.update({
      where: { id: request.id },
      data: {
        status,
        committedAmount: unresolved,
        successfulAmount: successful,
        unresolvedAmount: unresolved,
        releasedAmount: released,
        actionRequiredReason: reason,
        completedAt:
          unresolved.isZero() &&
          ["COMPLETED", "PARTIAL", "FAILED"].includes(status)
            ? (request.completedAt ?? new Date())
            : null,
      },
    });
    if (updated.status !== request.status) {
      const eventType =
        updated.status === "COMPLETED"
          ? "escrow.brand_return_completed"
          : updated.status === "PARTIAL"
            ? "escrow.brand_return_partial"
            : updated.status === "ACTION_REQUIRED"
              ? "escrow.brand_return_action_required"
              : null;
      if (eventType) {
        await this.notifications.enqueueWithinTransaction(tx, {
          workspaceId: request.brandProfileId,
          eventType,
          source: {
            sourceType: "brand_return_request",
            sourceId: request.id,
            transitionId: updated.status.toLowerCase(),
          },
          payload: {
            brand_return_request_id: request.id,
            status: updated.status,
            successful_amount: successful.toNumber(),
            unresolved_amount: unresolved.toNumber(),
            released_amount: released.toNumber(),
            action_required_reason: reason,
          },
        });
      }
    }
    return updated;
  }

  private allocationAuthority(allocationId: string) {
    return this.prisma.brandReturnAllocation.findUniqueOrThrow({
      where: { id: allocationId },
      include: { request: true },
    });
  }

  private async lockVault(tx: Prisma.TransactionClient, vaultId: string) {
    await tx.$queryRaw`
      SELECT vault_id
      FROM brand_escrow_vaults
      WHERE vault_id = ${vaultId}
      FOR UPDATE
    `;
  }

  private supports(
    capabilities: BrandReturnProviderCapability[],
    sourceType: string,
    currency: string,
  ) {
    return capabilities.some(
      (capability) =>
        capability.sourceType === sourceType &&
        capability.currency.toUpperCase() === currency.toUpperCase(),
    );
  }

  private assertSameRequest(
    request: { brandProfileId: string; requestedAmount: Decimal },
    brandProfileId: string,
    amount: Decimal,
  ) {
    if (
      request.brandProfileId !== brandProfileId ||
      !request.requestedAmount.equals(amount)
    ) {
      throw new ConflictException(
        "Brand Return request identity was reused with different economics",
      );
    }
  }

  private mapRequest(request: {
    id: string;
    requestIdentity: string;
    requestedAmount: Decimal;
    committedAmount: Decimal;
    successfulAmount: Decimal;
    unresolvedAmount: Decimal;
    releasedAmount: Decimal;
    currency: string;
    status: string;
    actionRequiredReason: string | null;
    requestedAt: Date;
    processingAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
    allocations: BrandReturnAllocation[];
  }) {
    return {
      brand_return_request_id: request.id,
      idempotency_identity: request.requestIdentity,
      requested_amount: request.requestedAmount.toNumber(),
      committed_amount: request.committedAmount.toNumber(),
      successful_amount: request.successfulAmount.toNumber(),
      unresolved_amount: request.unresolvedAmount.toNumber(),
      released_amount: request.releasedAmount.toNumber(),
      currency: request.currency,
      status: request.status,
      action_required_reason: request.actionRequiredReason,
      allocation_count: request.allocations.length,
      allocations: request.allocations.map((allocation) => ({
        allocation_id: allocation.id,
        amount: allocation.amount.toNumber(),
        currency: allocation.currency,
        state: allocation.state,
        action_required_reason: allocation.actionRequiredReason,
        attempt_count: allocation.attemptCount,
        created_at: allocation.createdAt.toISOString(),
        updated_at: allocation.updatedAt.toISOString(),
      })),
      requested_at: request.requestedAt.toISOString(),
      processing_at: request.processingAt?.toISOString() ?? null,
      completed_at: request.completedAt?.toISOString() ?? null,
      updated_at: request.updatedAt.toISOString(),
    };
  }
}
