import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EscrowTransactionStatus,
  EscrowTransactionType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { resolveBrandFinancialCommandSurface } from "../../../shared/config/brand-financial-command-surface";
import {
  projectBrandPayoutsViewerV2,
  type BrandPayoutsFullFinancialAuthorizationScopeV1,
} from "../contracts/brand-payouts-authorization.contract";
import {
  BRAND_PAYOUTS_V2_SCHEMA_VERSION,
  type BrandPayoutsAvailableActionV2,
  type BrandPayoutsBrandReturnDetailResponseV2,
  type BrandPayoutsBrandReturnItemV2,
  type BrandPayoutsBrandReturnsResponseV2,
  type BrandPayoutsOverviewResponseV2,
  type BrandPayoutsReserveRequestsResponseV2,
} from "../contracts/brand-payouts-v2.contract";
import type {
  BrandPayoutsActivityCsvReadRequestV2,
  BrandPayoutsActivityPageRequestV2,
  BrandPayoutsBrandReturnsPageRequestV2,
  BrandPayoutsDetailReadRequestV2,
  BrandPayoutsObligationsPageRequestV2,
  BrandPayoutsOverviewReadRequestV2,
  BrandPayoutsQueryPortV2,
  BrandPayoutsReserveRequestsPageRequestV2,
} from "../ports/brand-payouts-read.port";
import {
  BrandPayoutsCursorCodec,
  stableFilterKey,
} from "../utils/brand-payouts-cursor";
import {
  decimalSum,
  exactMoney,
  mapBrandReturnStatus,
  maxObservedAt,
  utcInstant,
} from "../utils/brand-payouts-projection";
import { BrandPayoutsReadEnvironmentService } from "./brand-payouts-read-environment.service";
import { FinancialActivityProjectionService } from "./financial-activity-projection.service";
import { PayoutObligationProjectionService } from "./payout-obligation-projection.service";

const vaultSelect = Prisma.validator<Prisma.BrandEscrowVaultSelect>()({
  id: true,
  brandProfileId: true,
  currency: true,
  availableBalance: true,
  lockedCampaignFunds: true,
  activeReturnCommitment: true,
  updatedAt: true,
});

const brandReturnSelect = Prisma.validator<Prisma.BrandReturnRequestSelect>()({
  id: true,
  brandProfileId: true,
  vaultId: true,
  requestedAmount: true,
  committedAmount: true,
  successfulAmount: true,
  unresolvedAmount: true,
  releasedAmount: true,
  currency: true,
  status: true,
  actionRequiredReason: true,
  requestedAt: true,
  processingAt: true,
  completedAt: true,
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
});

type VaultRow = Prisma.BrandEscrowVaultGetPayload<{
  select: typeof vaultSelect;
}>;
type BrandReturnRow = Prisma.BrandReturnRequestGetPayload<{
  select: typeof brandReturnSelect;
}>;

@Injectable()
export class BrandPayoutsQueryService implements BrandPayoutsQueryPortV2 {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursors: BrandPayoutsCursorCodec,
    private readonly environment: BrandPayoutsReadEnvironmentService,
    private readonly activity: FinancialActivityProjectionService,
    private readonly obligations: PayoutObligationProjectionService,
  ) {}

  async readOverview(
    request: BrandPayoutsOverviewReadRequestV2,
  ): Promise<BrandPayoutsOverviewResponseV2> {
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      return campaignManagerOverview(request);
    }
    await this.environment.assertDatabaseUtc();
    const scope = request.authorization;
    const vault = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId: scope.brandProfileId },
      select: vaultSelect,
    });
    if (!vault) return missingVaultOverview(request, scope);
    if (vault.updatedAt.getTime() > request.asOf.getTime()) {
      throw snapshotInvalidated();
    }

    const settlements = await this.prisma.escrowTransactionLedger.findMany({
      where: {
        brandProfileId: scope.brandProfileId,
        vaultId: vault.id,
        currency: vault.currency,
        transactionType: EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
        transactionStatus: EscrowTransactionStatus.CLEARED,
        createdAt: { lte: request.asOf },
      },
      select: {
        id: true,
        brandProfileId: true,
        vaultId: true,
        currency: true,
        amount: true,
        createdAt: true,
      },
    });
    const vaultFence = await this.prisma.brandEscrowVault.findUnique({
      where: { brandProfileId: scope.brandProfileId },
      select: vaultSelect,
    });
    if (
      !vaultFence ||
      vaultFence.id !== vault.id ||
      vaultFence.currency !== vault.currency ||
      vaultFence.updatedAt.getTime() !== vault.updatedAt.getTime() ||
      !vaultFence.availableBalance.equals(vault.availableBalance) ||
      !vaultFence.lockedCampaignFunds.equals(vault.lockedCampaignFunds) ||
      !vaultFence.activeReturnCommitment.equals(vault.activeReturnCommitment)
    ) {
      throw snapshotInvalidated();
    }

    const lineageCoherent = settlements.every(
      (entry) =>
        entry.brandProfileId === scope.brandProfileId &&
        entry.vaultId === vault.id &&
        entry.currency === vault.currency,
    );
    const amountsValid = settlements.every((entry) =>
      entry.amount.greaterThan(0),
    );
    const settlementsCoherent = lineageCoherent && amountsValid;
    const settlementLimitation = lineageCoherent
      ? "SETTLEMENT_LEDGER_AMOUNT_INVALID"
      : "SETTLEMENT_LEDGER_LINEAGE_CONFLICT";
    const settledAmount = decimalSum(settlements.map((entry) => entry.amount));
    const observedAt = maxObservedAt([
      vault.updatedAt,
      ...settlements.map((entry) => entry.createdAt),
    ]);
    const unavailable = (reason: string) => ({
      status: "UNAVAILABLE" as const,
      value: null,
      limitation_reason_code: reason,
    });
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(request.asOf),
      viewer: projectBrandPayoutsViewerV2(scope),
      sections: [
        {
          section_id: "OVERVIEW",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: observedAt
            ? utcInstant(observedAt)
            : utcInstant(request.asOf),
          source_coverage: [
            availableSource("VAULT"),
            unavailableSource(
              "FUNDING",
              "PENDING_FUNDING_SNAPSHOT_UNAVAILABLE",
            ),
            settlementsCoherent
              ? availableSource("FINANCIAL_LEDGER")
              : partialSource("FINANCIAL_LEDGER", settlementLimitation),
            partialSource(
              "PAYOUT_OBLIGATIONS",
              "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
            ),
            availableSource("BRAND_RETURNS"),
            unavailableSource(
              "COLLABORATION_RESERVE_REQUESTS",
              "C04_RESERVE_REQUEST_SOURCE_NOT_AVAILABLE",
            ),
          ],
          legacy_limitations: [
            {
              source: "PAYOUT_OBLIGATIONS",
              reason_code: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
              detail:
                "Scheduled and processing totals cannot be canonicalized before the accepted C-04 provenance contract.",
            },
          ],
          available_actions: overviewActions(scope, request.asOf, vault),
          payload: {
            projection: "FULL_FINANCIAL",
            available_funds: {
              status: "AUTHORITATIVE",
              value: exactMoney(vault.availableBalance, vault.currency),
            },
            pending_funding: unavailable(
              "PENDING_FUNDING_SNAPSHOT_UNAVAILABLE",
            ),
            committed_protected_funds: {
              status: "AUTHORITATIVE",
              value: exactMoney(vault.lockedCampaignFunds, vault.currency),
            },
            active_brand_return_commitment: {
              status: "AUTHORITATIVE",
              value: exactMoney(vault.activeReturnCommitment, vault.currency),
            },
            scheduled_creator_obligations: unavailable(
              "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
            ),
            processing_creator_obligations: unavailable(
              "IMMUTABLE_TRANSFER_MILESTONES_INCOMPLETE",
            ),
            settled_activity: settlementsCoherent
              ? {
                  status: "AUTHORITATIVE",
                  value: exactMoney(settledAmount, vault.currency),
                  basis: "LIFETIME",
                }
              : {
                  ...unavailable(settlementLimitation),
                  basis: "LIFETIME",
                },
            action_required_count: {
              status: "UNAVAILABLE",
              value: null,
              limitation_reason_code:
                "C04_RESERVE_REQUEST_SOURCE_NOT_AVAILABLE",
            },
          },
        },
      ],
    };
  }

  listActivity(request: BrandPayoutsActivityPageRequestV2) {
    return this.activity.listActivity(request);
  }

  listObligations(request: BrandPayoutsObligationsPageRequestV2) {
    return this.obligations.listObligations(request);
  }

  readObligation(request: BrandPayoutsDetailReadRequestV2) {
    return this.obligations.readObligation(request);
  }

  readActivity(request: BrandPayoutsDetailReadRequestV2) {
    return this.activity.readActivity(request);
  }

  readActivityCsv(request: BrandPayoutsActivityCsvReadRequestV2) {
    return this.activity.readActivityCsv(request);
  }

  async listBrandReturns(
    request: BrandPayoutsBrandReturnsPageRequestV2,
  ): Promise<BrandPayoutsBrandReturnsResponseV2> {
    const statuses = [...new Set(request.statuses ?? [])].sort();
    const filterKey = stableFilterKey({ statuses });
    const boundary = this.cursors.decode({
      cursor: request.cursor,
      endpoint: "brand-returns",
      filterKey,
      authorization: request.authorization,
      requestAsOf: request.asOf,
    });
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      return emptyCampaignManagerReturns(request, boundary.asOf);
    }
    await this.environment.assertDatabaseUtc();
    const limit = Math.min(Math.max(request.limit, 1), 100);
    const target = limit + 1;
    const batchSize = Math.max(target, 100);
    let scanAt = boundary.lastRecordedAt;
    let scanId = boundary.lastStableId
      ? stripReference(boundary.lastStableId, "brand-return:")
      : null;
    let exhausted = false;
    let integrityOmitted = false;
    const projected: Array<{
      readonly item: BrandPayoutsBrandReturnItemV2;
      readonly createdAt: Date;
    }> = [];
    while (projected.length < target && !exhausted) {
      const rows = await this.prisma.brandReturnRequest.findMany({
        where: {
          brandProfileId: request.authorization.brandProfileId,
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
        select: brandReturnSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: batchSize,
      });
      exhausted = rows.length < batchSize;
      for (const row of rows) {
        const item = projectBrandReturn(row);
        if (!item) {
          integrityOmitted = true;
          continue;
        }
        if (statuses.length === 0 || statuses.includes(item.status)) {
          projected.push({ item, createdAt: row.createdAt });
        }
      }
      const last = rows.at(-1);
      if (!last) break;
      scanAt = last.createdAt;
      scanId = last.id;
    }
    const pageRows = projected.slice(0, limit);
    const hasNext = projected.length > limit || !exhausted;
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
          section_id: "BRAND_RETURNS",
          coverage: integrityOmitted ? "PARTIAL" : "COMPLETE",
          freshness: "CURRENT",
          source_observed_at: observedAt ? utcInstant(observedAt) : null,
          source_coverage: [
            integrityOmitted
              ? partialSource("BRAND_RETURNS", "RETURN_INTEGRITY_ROWS_OMITTED")
              : availableSource("BRAND_RETURNS"),
          ],
          legacy_limitations: integrityOmitted
            ? [
                {
                  source: "BRAND_RETURNS",
                  reason_code: "RETURN_INTEGRITY_ROWS_OMITTED",
                  detail:
                    "Rows with unproven Brand, vault, currency, amount, or chronology were omitted.",
                },
              ]
            : [],
          available_actions: [],
          payload: pageRows.map(({ item }) => item),
          page: {
            next_cursor:
              hasNext && last
                ? this.cursors.encode({
                    endpoint: "brand-returns",
                    filterKey,
                    authorization: request.authorization,
                    asOf: boundary.asOf,
                    lastRecordedAt: last.createdAt,
                    lastStableId: last.item.public_reference,
                  })
                : null,
            page_complete: !hasNext,
            source_complete: !integrityOmitted,
          },
        },
      ],
    };
  }

  async readBrandReturn(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsBrandReturnDetailResponseV2> {
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      throw brandReturnNotFound();
    }
    await this.environment.assertDatabaseUtc();
    const id = stripReference(request.resourceId, "brand-return:");
    const row = await this.prisma.brandReturnRequest.findFirst({
      where: {
        id,
        brandProfileId: request.authorization.brandProfileId,
        vault: { brandProfileId: request.authorization.brandProfileId },
        createdAt: { lte: request.asOf },
      },
      select: brandReturnSelect,
    });
    const item = row ? projectBrandReturn(row) : null;
    if (!item) throw brandReturnNotFound();
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(request.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "BRAND_RETURNS",
          coverage: "COMPLETE",
          freshness: "CURRENT",
          source_observed_at: item.last_observed_at,
          source_coverage: [availableSource("BRAND_RETURNS")],
          legacy_limitations: [],
          available_actions: [
            {
              action: "VIEW_DETAIL",
              resource_reference: item.public_reference,
              resource_version: item.resource_version,
              authorized_as_of: utcInstant(request.asOf),
            },
          ],
          payload: item,
        },
      ],
    };
  }

  async listReserveRequests(
    request: BrandPayoutsReserveRequestsPageRequestV2,
  ): Promise<BrandPayoutsReserveRequestsResponseV2> {
    const statuses = [...new Set(request.statuses ?? [])].sort();
    const filterKey = stableFilterKey({ statuses });
    const boundary = this.cursors.decode({
      cursor: request.cursor,
      endpoint: "reserve-requests",
      filterKey,
      authorization: request.authorization,
      requestAsOf: request.asOf,
    });
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(boundary.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "RESERVE_REQUESTS",
          coverage: "UNAVAILABLE",
          freshness: "CURRENT",
          source_observed_at: null,
          source_coverage: [
            unavailableSource(
              "COLLABORATION_RESERVE_REQUESTS",
              request.authorization.kind === "NO_FINANCIAL_ROWS"
                ? "CANONICAL_ENTITY_SCOPE_UNAVAILABLE"
                : "C04_RESERVE_REQUEST_SOURCE_NOT_AVAILABLE",
            ),
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
}

function projectBrandReturn(
  row: BrandReturnRow,
): BrandPayoutsBrandReturnItemV2 | null {
  if (
    row.brandProfileId !== row.vault.brandProfileId ||
    row.vaultId !== row.vault.id ||
    row.currency !== row.vault.currency ||
    row.requestedAmount.lessThan(0) ||
    row.committedAmount.lessThan(0) ||
    row.successfulAmount.lessThan(0) ||
    row.unresolvedAmount.lessThan(0) ||
    row.releasedAmount.lessThan(0) ||
    row.requestedAt.getTime() > row.updatedAt.getTime() ||
    Boolean(
      row.processingAt &&
      row.processingAt.getTime() < row.requestedAt.getTime(),
    ) ||
    Boolean(
      row.completedAt && row.completedAt.getTime() < row.requestedAt.getTime(),
    )
  ) {
    return null;
  }
  const observedAt =
    maxObservedAt([
      row.updatedAt,
      row.vault.updatedAt,
      row.processingAt,
      row.completedAt,
    ]) ?? row.updatedAt;
  return {
    brand_return_id: row.id,
    public_reference: `brand-return:${row.id}`,
    resource_version: `observed:${observedAt.toISOString()}`,
    status: mapBrandReturnStatus(row.status),
    requested_value: exactMoney(row.requestedAmount, row.currency),
    completed_value: exactMoney(row.successfulAmount, row.currency),
    unresolved_value: exactMoney(row.unresolvedAmount, row.currency),
    requested_at: utcInstant(row.requestedAt),
    last_observed_at: utcInstant(observedAt),
    action_required_reason_code: row.actionRequiredReason,
    legacy: null,
  };
}

function campaignManagerOverview(
  request: BrandPayoutsOverviewReadRequestV2,
): BrandPayoutsOverviewResponseV2 {
  return {
    schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
    as_of: utcInstant(request.asOf),
    viewer: projectBrandPayoutsViewerV2(request.authorization),
    sections: [
      {
        section_id: "OVERVIEW",
        coverage: "UNAVAILABLE",
        freshness: "CURRENT",
        source_observed_at: null,
        source_coverage: [
          unavailableSource("VAULT", "CANONICAL_ENTITY_SCOPE_UNAVAILABLE"),
          unavailableSource(
            "PAYOUT_OBLIGATIONS",
            "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
          ),
        ],
        legacy_limitations: [],
        available_actions: [],
        payload: {
          projection: "CAMPAIGN_OPERATIONAL",
          treasury_capacity: "UNAVAILABLE",
          action_required_count: {
            status: "UNAVAILABLE",
            value: null,
            limitation_reason_code: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
          },
        },
      },
    ],
  };
}

function missingVaultOverview(
  request: BrandPayoutsOverviewReadRequestV2,
  scope: BrandPayoutsFullFinancialAuthorizationScopeV1,
): BrandPayoutsOverviewResponseV2 {
  const unavailable = (reason: string) => ({
    status: "UNAVAILABLE" as const,
    value: null,
    limitation_reason_code: reason,
  });
  return {
    schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
    as_of: utcInstant(request.asOf),
    viewer: projectBrandPayoutsViewerV2(scope),
    sections: [
      {
        section_id: "OVERVIEW",
        coverage: "PARTIAL",
        freshness: "CURRENT",
        source_observed_at: null,
        source_coverage: [
          unavailableSource("VAULT", "VAULT_NOT_ESTABLISHED"),
          unavailableSource("FUNDING", "VAULT_NOT_ESTABLISHED"),
          unavailableSource("FINANCIAL_LEDGER", "VAULT_NOT_ESTABLISHED"),
          partialSource(
            "PAYOUT_OBLIGATIONS",
            "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
          ),
          availableSource("BRAND_RETURNS"),
        ],
        legacy_limitations: [],
        available_actions: overviewActions(scope, request.asOf, null),
        payload: {
          projection: "FULL_FINANCIAL",
          available_funds: unavailable("VAULT_NOT_ESTABLISHED"),
          pending_funding: unavailable("VAULT_NOT_ESTABLISHED"),
          committed_protected_funds: unavailable("VAULT_NOT_ESTABLISHED"),
          active_brand_return_commitment: unavailable("VAULT_NOT_ESTABLISHED"),
          scheduled_creator_obligations: unavailable(
            "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
          ),
          processing_creator_obligations: unavailable(
            "IMMUTABLE_TRANSFER_MILESTONES_INCOMPLETE",
          ),
          settled_activity: {
            ...unavailable("VAULT_NOT_ESTABLISHED"),
            basis: "LIFETIME",
          },
          action_required_count: unavailable(
            "C04_RESERVE_REQUEST_SOURCE_NOT_AVAILABLE",
          ),
        },
      },
    ],
  };
}

function emptyCampaignManagerReturns(
  request: BrandPayoutsBrandReturnsPageRequestV2,
  asOf: Date,
): BrandPayoutsBrandReturnsResponseV2 {
  return {
    schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
    as_of: utcInstant(asOf),
    viewer: projectBrandPayoutsViewerV2(request.authorization),
    sections: [
      {
        section_id: "BRAND_RETURNS",
        coverage: "UNAVAILABLE",
        freshness: "CURRENT",
        source_observed_at: null,
        source_coverage: [
          unavailableSource(
            "BRAND_RETURNS",
            "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
          ),
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

function overviewActions(
  scope: BrandPayoutsFullFinancialAuthorizationScopeV1,
  asOf: Date,
  vault: VaultRow | null,
): BrandPayoutsAvailableActionV2[] {
  const version = vault
    ? `vault:${vault.updatedAt.toISOString()}`
    : `vault:not-established:${scope.authorizationVersion}`;
  const activeSurface = resolveBrandFinancialCommandSurface();
  const actions: BrandPayoutsAvailableActionV2[] = [
    {
      action:
        activeSurface === "PAYOUTS" ? "ADD_FUNDS" : "OPEN_SETTINGS_ADD_FUNDS",
      resource_reference:
        activeSurface === "PAYOUTS"
          ? "brand-payouts:vault:add-funds"
          : "brand-settings:secure-escrow:add-funds",
      resource_version: version,
      authorized_as_of: utcInstant(asOf),
    },
  ];
  if (vault) {
    actions.push({
      action:
        activeSurface === "PAYOUTS"
          ? "REQUEST_BRAND_RETURN"
          : "OPEN_SETTINGS_BRAND_RETURN",
      resource_reference:
        activeSurface === "PAYOUTS"
          ? "brand-payouts:vault:brand-return"
          : "brand-settings:secure-escrow:brand-return",
      resource_version: `${version}:${scope.authorizationVersion}`,
      authorized_as_of: utcInstant(asOf),
    });
  }
  return actions;
}

function availableSource(
  source: "VAULT" | "FINANCIAL_LEDGER" | "BRAND_RETURNS",
) {
  return {
    source,
    status: "AVAILABLE" as const,
    limitation_reason_code: null,
    recovery_hint: null,
  };
}

function partialSource(
  source: "FINANCIAL_LEDGER" | "PAYOUT_OBLIGATIONS" | "BRAND_RETURNS",
  reason: string,
) {
  return {
    source,
    status: "PARTIAL" as const,
    limitation_reason_code: reason,
    recovery_hint: null,
  };
}

function unavailableSource(
  source:
    | "VAULT"
    | "FUNDING"
    | "FINANCIAL_LEDGER"
    | "PAYOUT_OBLIGATIONS"
    | "BRAND_RETURNS"
    | "COLLABORATION_RESERVE_REQUESTS",
  reason: string,
) {
  return {
    source,
    status: "UNAVAILABLE" as const,
    limitation_reason_code: reason,
    recovery_hint: null,
  };
}

function stripReference(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function snapshotInvalidated(): ConflictException {
  return new ConflictException({
    code: "BRAND_PAYOUTS_SNAPSHOT_INVALIDATED",
    message: "The financial snapshot changed while it was being read",
  });
}

function brandReturnNotFound(): NotFoundException {
  return new NotFoundException({
    code: "BRAND_PAYOUTS_BRAND_RETURN_NOT_FOUND",
    message: "Brand Return was not found",
  });
}
