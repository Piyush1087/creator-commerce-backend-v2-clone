import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { FailClosedBrandReturnRefundProvider } from "./brand-return-provider.adapter";
import type { BrandReturnProviderOutcome } from "./brand-return-provider.types";
import { BrandReturnService } from "./brand-return.service";

const now = new Date("2026-09-06T12:00:00.000Z");

function decimalUpdate(current: Decimal, value: unknown): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number" || typeof value === "string")
    return new Decimal(value);
  if (typeof value === "object" && value) {
    const operation = value as { increment?: Decimal; decrement?: Decimal };
    if (operation.increment) return current.add(operation.increment);
    if (operation.decrement) return current.sub(operation.decrement);
  }
  return current;
}

function harness(
  outcomes: BrandReturnProviderOutcome[] = [],
  providerEnabled = true,
) {
  const vault = {
    id: "vault-1",
    brandProfileId: "brand-1",
    currency: "INR",
    totalPooledBalance: new Decimal(200),
    availableBalance: new Decimal(200),
    lockedCampaignFunds: new Decimal(0),
    activeReturnCommitment: new Decimal(0),
  };
  const lots = [
    {
      id: "lot-a",
      vaultId: vault.id,
      sourceType: "GATEWAY",
      provenanceStatus: "PROVEN_SOURCE",
      currency: "INR",
      providerPaymentId: "pay-a",
      providerRefundableAmount: new Decimal(100),
      availableAmount: new Decimal(100),
      returnCommittedAmount: new Decimal(0),
      externallyReturnedAmount: new Decimal(0),
      economicAt: new Date("2026-09-01"),
    },
    {
      id: "lot-b",
      vaultId: vault.id,
      sourceType: "GATEWAY",
      provenanceStatus: "PROVEN_SOURCE",
      currency: "INR",
      providerPaymentId: "pay-b",
      providerRefundableAmount: new Decimal(100),
      availableAmount: new Decimal(100),
      returnCommittedAmount: new Decimal(0),
      externallyReturnedAmount: new Decimal(0),
      economicAt: new Date("2026-09-02"),
    },
  ];
  const requests: Array<Record<string, unknown>> = [];
  const allocations: Array<Record<string, unknown>> = [];
  const ledger: Array<Record<string, unknown>> = [];

  const includeAllocations = (request: Record<string, unknown>) => ({
    ...request,
    allocations: allocations.filter(
      (allocation) => allocation.requestId === request.id,
    ),
  });
  const requestFindUnique = ({ where }: { where: Record<string, string> }) => {
    const request = requests.find(
      (row) =>
        (where.id && row.id === where.id) ||
        (where.requestIdentity &&
          row.requestIdentity === where.requestIdentity),
    );
    return request ? includeAllocations(request) : null;
  };
  const allocationFindUnique = ({
    where,
  }: {
    where: Record<string, string>;
  }) => {
    const allocation = allocations.find(
      (row) =>
        (where.id && row.id === where.id) ||
        (where.providerRefundId &&
          row.providerRefundId === where.providerRefundId),
    );
    if (!allocation) return null;
    const request = requests.find((row) => row.id === allocation.requestId)!;
    return { ...allocation, request: { ...request } };
  };
  const updateVault = ({ data }: { data: Record<string, unknown> }) => {
    for (const field of [
      "totalPooledBalance",
      "availableBalance",
      "lockedCampaignFunds",
      "activeReturnCommitment",
    ] as const) {
      if (data[field] !== undefined)
        vault[field] = decimalUpdate(vault[field], data[field]);
    }
    return vault;
  };
  const updateLot = ({
    where,
    data,
  }: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => {
    const lot = lots.find((row) => row.id === where.id)!;
    for (const field of [
      "availableAmount",
      "returnCommittedAmount",
      "externallyReturnedAmount",
    ] as const) {
      if (data[field] !== undefined)
        lot[field] = decimalUpdate(lot[field], data[field]);
    }
    return lot;
  };
  const updateRequest = ({
    where,
    data,
  }: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => {
    const request = requests.find((row) => row.id === where.id)!;
    Object.assign(request, data, { updatedAt: now });
    return request;
  };
  const updateAllocation = ({
    where,
    data,
  }: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => {
    const allocation = allocations.find((row) => row.id === where.id)!;
    if (data.attemptCount && typeof data.attemptCount === "object") {
      data = {
        ...data,
        attemptCount:
          Number(allocation.attemptCount) +
          Number((data.attemptCount as { increment: number }).increment),
      };
    }
    Object.assign(allocation, data, { updatedAt: now });
    return allocation;
  };

  const tx = {
    $queryRaw: vi
      .fn()
      .mockImplementation((strings: TemplateStringsArray) =>
        strings.join(" ").includes("FROM brand_escrow_vaults")
          ? [{ vault_id: vault.id }]
          : [],
      ),
    brandEscrowVault: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(vault),
      update: vi.fn().mockImplementation(updateVault),
    },
    escrowFundingLot: {
      findMany: vi
        .fn()
        .mockImplementation(({ where } = {}) =>
          where?.provenanceStatus
            ? lots.filter(
                (lot) =>
                  lot.provenanceStatus === where.provenanceStatus &&
                  lot.providerPaymentId !== null &&
                  lot.availableAmount.greaterThan(0),
              )
            : lots,
        ),
      update: vi.fn().mockImplementation(updateLot),
    },
    brandReturnRequest: {
      findUnique: vi.fn().mockImplementation(requestFindUnique),
      findUniqueOrThrow: vi.fn().mockImplementation((args) => {
        const found = requestFindUnique(args);
        if (!found) throw new Error("missing request");
        return found;
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const request = {
          id: `return-${requests.length + 1}`,
          ...data,
          successfulAmount: new Decimal(0),
          releasedAmount: new Decimal(0),
          requestedAt: now,
          processingAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        requests.push(request);
        return request;
      }),
      update: vi.fn().mockImplementation(updateRequest),
    },
    brandReturnAllocation: {
      create: vi.fn().mockImplementation(({ data }) => {
        const allocation = {
          id: `allocation-${allocations.length + 1}`,
          ...data,
          state: "READY",
          actionRequiredReason: null,
          providerRefundId: null,
          providerState: null,
          attemptCount: 0,
          diagnosticPayload: null,
          lastAttemptAt: null,
          succeededAt: null,
          releasedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        allocations.push(allocation);
        return allocation;
      }),
      findUnique: vi.fn().mockImplementation(allocationFindUnique),
      findUniqueOrThrow: vi.fn().mockImplementation((args) => {
        const found = allocationFindUnique(args);
        if (!found) throw new Error("missing allocation");
        return found;
      }),
      update: vi.fn().mockImplementation(updateAllocation),
    },
    escrowTransactionLedger: {
      create: vi.fn().mockImplementation(({ data }) => {
        ledger.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    brandEscrowVault: {
      findUnique: vi.fn().mockResolvedValue(vault),
    },
    escrowFundingLot: {
      findMany: vi.fn().mockImplementation(() => lots),
    },
    brandReturnRequest: {
      findUnique: vi.fn().mockImplementation(requestFindUnique),
      findFirst: vi.fn().mockImplementation(requestFindUnique),
      findMany: vi
        .fn()
        .mockImplementation(() => requests.map(includeAllocations)),
    },
    brandReturnAllocation: {
      findUnique: vi.fn().mockImplementation(allocationFindUnique),
      findUniqueOrThrow: vi.fn().mockImplementation((args) => {
        const found = allocationFindUnique(args);
        if (!found) throw new Error("missing allocation");
        return found;
      }),
    },
  };
  const createRefund = vi
    .fn()
    .mockImplementation(() => Promise.resolve(outcomes.shift()));
  const fetchRefund = vi.fn();
  const provider = providerEnabled
    ? {
        capabilities: vi
          .fn()
          .mockResolvedValue([{ sourceType: "GATEWAY", currency: "INR" }]),
        assertExecutionAvailable: vi.fn().mockResolvedValue(undefined),
        createRefund,
        fetchRefund,
        verifyTrustedFundingEvidence: vi.fn(),
      }
    : new FailClosedBrandReturnRefundProvider();
  const enqueueWithinTransaction = vi.fn();
  const service = new BrandReturnService(
    prisma as never,
    provider as never,
    { enqueueWithinTransaction } as never,
  );
  return {
    service,
    vault,
    lots,
    requests,
    allocations,
    ledger,
    createRefund,
    fetchRefund,
    enqueueWithinTransaction,
  };
}

describe("BS04 Brand Return", () => {
  it("fails provider preflight before committing money", async () => {
    const { service, vault, requests } = harness([], false);
    await expect(service.getSummary("brand-1")).resolves.toMatchObject({
      proven_source_available_balance: 200,
      self_service_returnable_balance: 0,
    });
    await expect(
      service.requestReturn({
        brandProfileId: "brand-1",
        requestedByUserId: "owner-1",
        amount: 50,
        requestIdentity: "identity-1",
      }),
    ).rejects.toMatchObject({ response: { code: "PROVIDER_SETUP_REQUIRED" } });
    expect(vault.availableBalance.toNumber()).toBe(200);
    expect(vault.activeReturnCommitment.toNumber()).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it("allocates proven sources FIFO, fences AVAILABLE and replays identical identity", async () => {
    const { service, vault, allocations } = harness();
    const input = {
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 150,
      requestIdentity: "identity-1",
    };
    const first = await service.requestReturn(input);
    const replay = await service.requestReturn(input);

    expect(first.brand_return_request_id).toBe(replay.brand_return_request_id);
    expect(
      allocations.map((row) => Number((row.amount as Decimal).toNumber())),
    ).toEqual([100, 50]);
    expect(allocations.map((row) => row.fundingLotId)).toEqual([
      "lot-a",
      "lot-b",
    ]);
    expect(vault.availableBalance.toNumber()).toBe(50);
    expect(vault.activeReturnCommitment.toNumber()).toBe(150);
    await expect(
      service.requestReturn({ ...input, amount: 149 }),
    ).rejects.toThrow("different economics");
  });

  it("accounts partial success and terminal zero-side-effect release exactly once", async () => {
    const { service, vault, lots, ledger, enqueueWithinTransaction } = harness([
      {
        kind: "SUCCEEDED",
        providerRefundId: "refund-a",
        providerState: "confirmed",
      },
      { kind: "TERMINAL_REJECTION", diagnosticCode: "NOT_CREATED" },
    ]);
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "finance-1",
      amount: 150,
      requestIdentity: "identity-1",
    });
    const result = await service.executeRequest(
      request.brand_return_request_id,
    );

    expect(result.status).toBe("PARTIAL");
    expect(result.successful_amount).toBe(100);
    expect(result.released_amount).toBe(50);
    expect(result.unresolved_amount).toBe(0);
    expect(vault.totalPooledBalance.toNumber()).toBe(100);
    expect(vault.availableBalance.toNumber()).toBe(100);
    expect(vault.activeReturnCommitment.toNumber()).toBe(0);
    expect(lots[0].externallyReturnedAmount.toNumber()).toBe(100);
    expect(lots[1].availableAmount.toNumber()).toBe(100);
    expect(ledger).toHaveLength(1);
    expect(enqueueWithinTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "escrow.brand_return_partial" }),
    );
  });

  it("keeps ambiguous money committed and requires reconciliation", async () => {
    const { service, vault } = harness([{ kind: "AMBIGUOUS" }]);
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 100,
      requestIdentity: "identity-1",
    });
    const result = await service.executeRequest(
      request.brand_return_request_id,
    );

    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.action_required_reason).toBe("PROVIDER_OUTCOME_AMBIGUOUS");
    expect(result.unresolved_amount).toBe(100);
    expect(vault.availableBalance.toNumber()).toBe(100);
    expect(vault.activeReturnCommitment.toNumber()).toBe(100);
    expect(vault.totalPooledBalance.toNumber()).toBe(200);
  });

  it("reports all-terminal zero-side-effect rejection as FAILED", async () => {
    const { service, vault } = harness([
      { kind: "TERMINAL_REJECTION", diagnosticCode: "NOT_CREATED" },
    ]);
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 100,
      requestIdentity: "identity-1",
    });
    const result = await service.executeRequest(
      request.brand_return_request_id,
    );
    expect(result.status).toBe("FAILED");
    expect(vault.availableBalance.toNumber()).toBe(200);
    expect(vault.activeReturnCommitment.toNumber()).toBe(0);
    expect(vault.totalPooledBalance.toNumber()).toBe(200);
  });

  it("keeps retryable failures committed and retries the stable allocation identity", async () => {
    const { service, vault, allocations, createRefund } = harness([
      { kind: "RETRYABLE_FAILURE", diagnosticCode: "TEMPORARY" },
      {
        kind: "SUCCEEDED",
        providerRefundId: "refund-a",
        providerState: "confirmed",
      },
    ]);
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 100,
      requestIdentity: "identity-1",
    });

    const retryable = await service.executeRequest(
      request.brand_return_request_id,
    );
    expect(retryable.status).toBe("PROCESSING");
    expect(retryable.allocations[0].state).toBe("READY");
    expect(vault.activeReturnCommitment.toNumber()).toBe(100);

    const completed = await service.executeRequest(
      request.brand_return_request_id,
    );
    expect(completed.status).toBe("COMPLETED");
    expect(createRefund).toHaveBeenCalledTimes(2);
    expect(createRefund.mock.calls[0][0].semanticIdentity).toBe(
      createRefund.mock.calls[1][0].semanticIdentity,
    );
    expect(allocations[0].attemptCount).toBe(2);
    expect(vault.activeReturnCommitment.toNumber()).toBe(0);
  });

  it("treats provider success replay as monotonic and does not debit twice", async () => {
    const { service, vault, ledger } = harness([
      {
        kind: "SUCCEEDED",
        providerRefundId: "refund-a",
        providerState: "confirmed",
      },
    ]);
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 100,
      requestIdentity: "identity-1",
    });
    await service.executeRequest(request.brand_return_request_id);
    await service.reconcileProviderRefund("refund-a", {
      kind: "SUCCEEDED",
      providerRefundId: "refund-a",
      providerState: "confirmed",
    });
    await service.reconcileProviderRefund("refund-a", {
      kind: "TERMINAL_REJECTION",
      providerState: "stale-rejection",
    });

    expect(vault.totalPooledBalance.toNumber()).toBe(100);
    expect(vault.activeReturnCommitment.toNumber()).toBe(0);
    expect(ledger).toHaveLength(1);
  });

  it("reconciles a PROCESSING allocation after a crash without issuing a second create", async () => {
    const { service, allocations, createRefund, fetchRefund, vault } =
      harness();
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "owner-1",
      amount: 100,
      requestIdentity: "identity-1",
    });
    allocations[0].state = "PROCESSING";
    allocations[0].attemptCount = 1;
    fetchRefund.mockResolvedValue({
      kind: "SUCCEEDED",
      providerRefundId: "refund-after-crash",
      providerState: "confirmed",
    });

    const completed = await service.executeRequest(
      request.brand_return_request_id,
    );
    expect(completed.status).toBe("COMPLETED");
    expect(createRefund).not.toHaveBeenCalled();
    expect(fetchRefund).toHaveBeenCalledWith({
      semanticIdentity: allocations[0].semanticIdentity,
      providerRefundId: null,
    });
    expect(vault.totalPooledBalance.toNumber()).toBe(100);
  });

  it("skips an older legacy source, exposes reconciliation-required AVAILABLE, and uses the later proven source", async () => {
    const { service, lots, allocations } = harness();
    Object.assign(lots[0], {
      sourceType: "LEGACY_SOURCE_UNKNOWN",
      provenanceStatus: "LEGACY_SOURCE_UNKNOWN",
      providerPaymentId: null,
      providerRefundableAmount: new Decimal(0),
    });

    const summary = await service.getSummary("brand-1");
    expect(summary).toMatchObject({
      available_balance: 200,
      proven_source_available_balance: 100,
      self_service_returnable_balance: 100,
      source_reconciliation_required_amount: 100,
    });
    await expect(
      service.requestReturn({
        brandProfileId: "brand-1",
        requestedByUserId: "finance-1",
        amount: 101,
        requestIdentity: "identity-1",
      }),
    ).rejects.toMatchObject({
      response: { code: "SOURCE_PROVENANCE_REQUIRED" },
    });
    const request = await service.requestReturn({
      brandProfileId: "brand-1",
      requestedByUserId: "finance-1",
      amount: 100,
      requestIdentity: "identity-2",
    });
    expect(request.requested_amount).toBe(100);
    expect(allocations.map((allocation) => allocation.fundingLotId)).toEqual([
      "lot-b",
    ]);
  });

  it("rejects a request above aggregate AVAILABLE before source allocation", async () => {
    const { service } = harness();
    await expect(
      service.requestReturn({
        brandProfileId: "brand-1",
        requestedByUserId: "owner-1",
        amount: 201,
        requestIdentity: "identity-1",
      }),
    ).rejects.toMatchObject({
      response: { code: "INSUFFICIENT_AVAILABLE_BALANCE" },
    });
  });
});
