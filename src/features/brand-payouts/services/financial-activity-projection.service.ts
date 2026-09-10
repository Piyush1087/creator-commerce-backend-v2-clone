import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import {
  BrandReturnStatus,
  EscrowTransactionStatus,
  EscrowTransactionType,
  Prisma,
  RouteReversalState,
  RouteSettlementState,
  RouteTransferState,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { projectBrandPayoutsViewerV2 } from "../contracts/brand-payouts-authorization.contract";
import type { BrandPayoutsFullFinancialAuthorizationScopeV1 } from "../contracts/brand-payouts-authorization.contract";
import {
  BRAND_PAYOUTS_V2_SCHEMA_VERSION,
  type BrandPayoutsActivityCategory,
  type BrandPayoutsActivityCsvExportV2,
  type BrandPayoutsActivityDetailResponseV2,
  type BrandPayoutsActivityItemV2,
  type BrandPayoutsActivityResponseV2,
} from "../contracts/brand-payouts-v2.contract";
import type {
  BrandPayoutsActivityCsvReadRequestV2,
  BrandPayoutsActivityPageRequestV2,
  BrandPayoutsDetailReadRequestV2,
} from "../ports/brand-payouts-read.port";
import {
  BrandPayoutsCursorCodec,
  isAfterCursor,
  stableFilterKey,
  type BrandPayoutsCursorBoundary,
} from "../utils/brand-payouts-cursor";
import {
  classifyLedgerEntry,
  exactMoney,
  mapBrandReturnStatus,
  maxObservedAt,
  utcInstant,
} from "../utils/brand-payouts-projection";
import { BrandPayoutsReadEnvironmentService } from "./brand-payouts-read-environment.service";

const PUBLIC_PAGE_MAX = 100;
const CSV_ROW_MAX = 100_000;
const CSV_RANGE_MAX_MS = 366 * 24 * 60 * 60 * 1000;

const ledgerSelect = Prisma.validator<Prisma.EscrowTransactionLedgerSelect>()({
  id: true,
  brandProfileId: true,
  vaultId: true,
  transactionType: true,
  amount: true,
  currency: true,
  transactionStatus: true,
  createdAt: true,
  vault: {
    select: { id: true, brandProfileId: true, currency: true, updatedAt: true },
  },
});

const obligationActivitySelect =
  Prisma.validator<Prisma.CreatorPayoutObligationSelect>()({
    id: true,
    brandProfileId: true,
    collaborationId: true,
    vaultId: true,
    creatorProfileId: true,
    entitlementAmount: true,
    currency: true,
    status: true,
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
  });

const transferActivitySelect =
  Prisma.validator<Prisma.RouteTransferAttemptSelect>()({
    id: true,
    amount: true,
    currency: true,
    state: true,
    settlementState: true,
    onHold: true,
    initiatedAt: true,
    providerAcceptedAt: true,
    processedAt: true,
    releasedAt: true,
    settledAt: true,
    failedAt: true,
    createdAt: true,
    updatedAt: true,
    obligation: {
      select: {
        id: true,
        brandProfileId: true,
        collaborationId: true,
        vaultId: true,
        creatorProfileId: true,
        entitlementAmount: true,
        currency: true,
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
      },
    },
  });

const reversalActivitySelect =
  Prisma.validator<Prisma.RouteTransferReversalSelect>()({
    id: true,
    amount: true,
    currency: true,
    state: true,
    initiatedAt: true,
    processedAt: true,
    failedAt: true,
    createdAt: true,
    updatedAt: true,
    transferAttempt: {
      select: {
        id: true,
        amount: true,
        currency: true,
        state: true,
        settlementState: true,
        onHold: true,
        initiatedAt: true,
        providerAcceptedAt: true,
        processedAt: true,
        releasedAt: true,
        settledAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
        obligation: {
          select: {
            id: true,
            brandProfileId: true,
            collaborationId: true,
            vaultId: true,
            creatorProfileId: true,
            entitlementAmount: true,
            currency: true,
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
          },
        },
      },
    },
  });

const returnActivitySelect =
  Prisma.validator<Prisma.BrandReturnRequestSelect>()({
    id: true,
    brandProfileId: true,
    vaultId: true,
    currency: true,
    status: true,
    requestedAt: true,
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

type LedgerRow = Prisma.EscrowTransactionLedgerGetPayload<{
  select: typeof ledgerSelect;
}>;
type ObligationRow = Prisma.CreatorPayoutObligationGetPayload<{
  select: typeof obligationActivitySelect;
}>;
type TransferRow = Prisma.RouteTransferAttemptGetPayload<{
  select: typeof transferActivitySelect;
}>;
type ReversalRow = Prisma.RouteTransferReversalGetPayload<{
  select: typeof reversalActivitySelect;
}>;
type ReturnRow = Prisma.BrandReturnRequestGetPayload<{
  select: typeof returnActivitySelect;
}>;

type ActivityRange = {
  readonly fromInclusive?: Date;
  readonly toExclusive?: Date;
};
type LocalScanCursor = { readonly createdAt: Date; readonly id: string } | null;
type CommonSourceCursorWhere =
  | { createdAt: { lte: Date } }
  | {
      OR: Array<
        | { createdAt: { lt: Date } }
        | {
            createdAt: Date;
            id: { lt: string };
          }
      >;
    };
type Projection = {
  readonly item: BrandPayoutsActivityItemV2 | null;
  readonly integrityConflict: boolean;
};
type SourceWindow = {
  readonly items: readonly BrandPayoutsActivityItemV2[];
  readonly exhausted: boolean;
  readonly integrityConflict: boolean;
};

@Injectable()
export class FinancialActivityProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cursors: BrandPayoutsCursorCodec,
    private readonly environment: BrandPayoutsReadEnvironmentService,
  ) {}

  async listActivity(
    request: BrandPayoutsActivityPageRequestV2,
  ): Promise<BrandPayoutsActivityResponseV2> {
    const categories = normalizeCategories(request.categories);
    const range: ActivityRange = {
      fromInclusive: request.fromInclusive,
      toExclusive: request.toExclusive,
    };
    assertRange(range);
    const filterKey = stableFilterKey({
      categories,
      from: request.fromInclusive?.toISOString(),
      to: request.toExclusive?.toISOString(),
    });
    const boundary = this.cursors.decode({
      cursor: request.cursor,
      endpoint: "activity",
      filterKey,
      authorization: request.authorization,
      requestAsOf: request.asOf,
    });
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      return emptyCampaignManagerResponse(request, boundary.asOf);
    }
    await this.environment.assertDatabaseUtc();
    const limit = Math.min(Math.max(request.limit, 1), PUBLIC_PAGE_MAX);
    const candidates = await this.readCandidates(
      request.authorization,
      boundary,
      categories,
      range,
      limit + 1,
    );
    const ordered = sortActivity(candidates.items).filter((item) =>
      isAfterCursor(new Date(item.recorded_at), item.activity_id, boundary),
    );
    const pageItems = ordered.slice(0, limit);
    const hasNext = ordered.length > limit || !candidates.exhausted;
    const last = pageItems.at(-1);
    const observedAt = maxObservedAt(
      pageItems.map((item) =>
        item.source_observed_at ? new Date(item.source_observed_at) : null,
      ),
    );
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(boundary.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "ACTIVITY",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: observedAt ? utcInstant(observedAt) : null,
          source_coverage: activityCoverage(candidates.integrityConflict),
          legacy_limitations: activityLimitations(candidates.integrityConflict),
          available_actions: [
            {
              action: "DOWNLOAD_FINANCIAL_ACTIVITY_CSV",
              resource_reference: "financial-activity",
              resource_version: request.authorization.authorizationVersion,
              authorized_as_of: utcInstant(boundary.asOf),
            },
          ],
          payload: pageItems,
          page: {
            next_cursor:
              hasNext && last
                ? this.cursors.encode({
                    endpoint: "activity",
                    filterKey,
                    authorization: request.authorization,
                    asOf: boundary.asOf,
                    lastRecordedAt: new Date(last.recorded_at),
                    lastStableId: last.activity_id,
                  })
                : null,
            page_complete: !hasNext,
            source_complete: false,
          },
        },
      ],
    };
  }

  async readActivity(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsActivityDetailResponseV2> {
    if (request.authorization.kind === "NO_FINANCIAL_ROWS") {
      throw activityNotFound();
    }
    await this.environment.assertDatabaseUtc();
    const item = await this.readActivityItem(
      request.authorization,
      request.resourceId,
      request.asOf,
    );
    if (!item) throw activityNotFound();
    return {
      schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
      as_of: utcInstant(request.asOf),
      viewer: projectBrandPayoutsViewerV2(request.authorization),
      sections: [
        {
          section_id: "ACTIVITY",
          coverage: item.legacy ? "PARTIAL" : "COMPLETE",
          freshness: "CURRENT",
          source_observed_at: item.source_observed_at,
          source_coverage: activityCoverage(false),
          legacy_limitations: item.legacy
            ? [
                {
                  source: activitySourceId(item),
                  reason_code:
                    item.legacy.limitation_reason_code ??
                    "LEGACY_ACTIVITY_LIMITED",
                  detail: "Only evidence preserved by the source is projected.",
                },
              ]
            : [],
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

  async readActivityCsv(
    request: BrandPayoutsActivityCsvReadRequestV2,
  ): Promise<BrandPayoutsActivityCsvExportV2> {
    await this.environment.assertDatabaseUtc();
    assertCsvRange(request.fromInclusive, request.toExclusive);
    const categories = normalizeCategories(request.categories);
    const boundary: BrandPayoutsCursorBoundary = {
      asOf: request.asOf,
      lastRecordedAt: null,
      lastStableId: null,
    };
    const candidates = await this.readCandidates(
      request.authorization,
      boundary,
      categories,
      {
        fromInclusive: request.fromInclusive,
        toExclusive: request.toExclusive,
      },
      CSV_ROW_MAX + 1,
    );
    if (candidates.integrityConflict) throw activityIntegrityConflict();
    const items = sortActivity(candidates.items);
    if (items.length > CSV_ROW_MAX || !candidates.exhausted) {
      throw new PayloadTooLargeException({
        code: "BRAND_PAYOUTS_CSV_ROW_LIMIT_EXCEEDED",
        message: "The requested activity export exceeds 100000 rows",
      });
    }
    const generatedAt = new Date();
    return {
      contentType: "text/csv; charset=utf-8",
      filename: csvFilename(
        request.authorization,
        request.fromInclusive,
        request.toExclusive,
        generatedAt,
      ),
      generatedAt,
      asOf: request.asOf,
      body: csvBody(items),
    };
  }

  private async readCandidates(
    authorization: BrandPayoutsFullFinancialAuthorizationScopeV1,
    boundary: BrandPayoutsCursorBoundary,
    categories: readonly BrandPayoutsActivityCategory[],
    range: ActivityRange,
    target: number,
  ): Promise<{
    readonly items: readonly BrandPayoutsActivityItemV2[];
    readonly exhausted: boolean;
    readonly integrityConflict: boolean;
  }> {
    const brandProfileId = authorization.brandProfileId;
    const initialUpper = boundary.lastRecordedAt ?? boundary.asOf;
    const [ledger, obligations, transfers, reversals, returns] =
      await Promise.all([
        scanSource<LedgerRow>(
          async (cursor, take) =>
            this.prisma.escrowTransactionLedger.findMany({
              where: {
                brandProfileId,
                createdAt: timeFilter(range, boundary.asOf),
                AND: sourceCursorWhere(cursor, initialUpper),
              },
              select: ledgerSelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
          mapLedgerActivity,
          boundary,
          categories,
          target,
        ),
        scanSource<ObligationRow>(
          async (cursor, take) =>
            this.prisma.creatorPayoutObligation.findMany({
              where: {
                brandProfileId,
                collaboration: { brandProfileId },
                vault: { brandProfileId },
                createdAt: timeFilter(range, boundary.asOf),
                AND: sourceCursorWhere(cursor, initialUpper),
              },
              select: obligationActivitySelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
          mapObligationActivity,
          boundary,
          categories,
          target,
        ),
        scanSource<TransferRow>(
          async (cursor, take) =>
            this.prisma.routeTransferAttempt.findMany({
              where: {
                obligation: {
                  brandProfileId,
                  collaboration: { brandProfileId },
                  vault: { brandProfileId },
                },
                createdAt: timeFilter(range, boundary.asOf),
                AND: sourceCursorWhere(cursor, initialUpper),
              },
              select: transferActivitySelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
          mapTransferActivity,
          boundary,
          categories,
          target,
        ),
        scanSource<ReversalRow>(
          async (cursor, take) =>
            this.prisma.routeTransferReversal.findMany({
              where: {
                transferAttempt: {
                  obligation: {
                    brandProfileId,
                    collaboration: { brandProfileId },
                    vault: { brandProfileId },
                  },
                },
                createdAt: timeFilter(range, boundary.asOf),
                AND: sourceCursorWhere(cursor, initialUpper),
              },
              select: reversalActivitySelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
          mapReversalActivity,
          boundary,
          categories,
          target,
        ),
        scanSource<ReturnRow>(
          async (cursor, take) =>
            this.prisma.brandReturnRequest.findMany({
              where: {
                brandProfileId,
                vault: { brandProfileId },
                createdAt: timeFilter(range, boundary.asOf),
                AND: sourceCursorWhere(cursor, initialUpper),
              },
              select: returnActivitySelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take,
            }),
          mapReturnActivity,
          boundary,
          categories,
          target,
        ),
      ]);
    const windows = [ledger, obligations, transfers, reversals, returns];
    return {
      items: windows.flatMap((window) => window.items),
      exhausted: windows.every((window) => window.exhausted),
      integrityConflict: windows.some((window) => window.integrityConflict),
    };
  }

  private async readActivityItem(
    authorization: BrandPayoutsFullFinancialAuthorizationScopeV1,
    resourceId: string,
    asOf: Date,
  ): Promise<BrandPayoutsActivityItemV2 | null> {
    const brandProfileId = authorization.brandProfileId;
    const parsed = parseActivityId(resourceId);
    if (!parsed) return null;
    let projection: Projection | null = null;
    if (parsed.source === "ledger") {
      const row = await this.prisma.escrowTransactionLedger.findFirst({
        where: {
          id: parsed.id,
          brandProfileId,
          vault: { brandProfileId },
          createdAt: { lte: asOf },
        },
        select: ledgerSelect,
      });
      projection = row ? mapLedgerActivity(row) : null;
    } else if (parsed.source === "obligation") {
      const row = await this.prisma.creatorPayoutObligation.findFirst({
        where: {
          id: parsed.id,
          brandProfileId,
          collaboration: { brandProfileId },
          vault: { brandProfileId },
          createdAt: { lte: asOf },
        },
        select: obligationActivitySelect,
      });
      projection = row ? mapObligationActivity(row) : null;
    } else if (parsed.source === "transfer") {
      const row = await this.prisma.routeTransferAttempt.findFirst({
        where: {
          id: parsed.id,
          obligation: {
            brandProfileId,
            collaboration: { brandProfileId },
            vault: { brandProfileId },
          },
          createdAt: { lte: asOf },
        },
        select: transferActivitySelect,
      });
      projection = row ? mapTransferActivity(row) : null;
    } else if (parsed.source === "reversal") {
      const row = await this.prisma.routeTransferReversal.findFirst({
        where: {
          id: parsed.id,
          transferAttempt: {
            obligation: {
              brandProfileId,
              collaboration: { brandProfileId },
              vault: { brandProfileId },
            },
          },
          createdAt: { lte: asOf },
        },
        select: reversalActivitySelect,
      });
      projection = row ? mapReversalActivity(row) : null;
    } else {
      const row = await this.prisma.brandReturnRequest.findFirst({
        where: {
          id: parsed.id,
          brandProfileId,
          vault: { brandProfileId },
          createdAt: { lte: asOf },
        },
        select: returnActivitySelect,
      });
      projection = row ? mapReturnActivity(row) : null;
    }
    return projection?.item ?? null;
  }
}

async function scanSource<T extends { id: string; createdAt: Date }>(
  fetchPage: (cursor: LocalScanCursor, take: number) => Promise<readonly T[]>,
  project: (row: T) => Projection,
  boundary: BrandPayoutsCursorBoundary,
  categories: readonly BrandPayoutsActivityCategory[],
  target: number,
): Promise<SourceWindow> {
  const items: BrandPayoutsActivityItemV2[] = [];
  let cursor: LocalScanCursor = null;
  let exhausted = false;
  let integrityConflict = false;
  const batchSize = Math.max(Math.min(target * 2, 1000), 100);
  while (items.length < target && !exhausted) {
    const rows = await fetchPage(cursor, batchSize);
    exhausted = rows.length < batchSize;
    for (const row of rows) {
      const projection = project(row);
      integrityConflict ||= projection.integrityConflict;
      if (
        projection.item &&
        (categories.length === 0 ||
          categories.includes(projection.item.category)) &&
        isAfterCursor(
          new Date(projection.item.recorded_at),
          projection.item.activity_id,
          boundary,
        )
      ) {
        items.push(projection.item);
      }
    }
    const last = rows.at(-1);
    if (!last) break;
    cursor = { createdAt: last.createdAt, id: last.id };
  }
  return { items: items.slice(0, target), exhausted, integrityConflict };
}

function sourceCursorWhere(
  cursor: LocalScanCursor,
  initialUpper: Date,
): CommonSourceCursorWhere[] {
  if (!cursor) return [{ createdAt: { lte: initialUpper } }];
  return [
    {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    },
  ];
}

function timeFilter(range: ActivityRange, asOf: Date): Prisma.DateTimeFilter {
  return {
    lte: asOf,
    ...(range.fromInclusive ? { gte: range.fromInclusive } : {}),
    ...(range.toExclusive ? { lt: range.toExclusive } : {}),
  };
}

function mapLedgerActivity(row: LedgerRow): Projection {
  if (
    row.brandProfileId !== row.vault.brandProfileId ||
    row.vaultId !== row.vault.id ||
    row.currency !== row.vault.currency
  ) {
    return { item: null, integrityConflict: true };
  }
  // LOAD status is mutable and the table has no immutable credited/failed
  // milestone. It is omitted until the source can prove when the transition ran.
  if (row.transactionType === EscrowTransactionType.LOAD) {
    return { item: null, integrityConflict: false };
  }
  const classification = classifyLedgerEntry(
    row.transactionType,
    row.transactionStatus,
  );
  if (!classification) return { item: null, integrityConflict: false };
  if (classification.isFinancialMovement && !row.amount.greaterThan(0)) {
    return { item: null, integrityConflict: true };
  }
  const legacy = classification.legacyLimitationReason
    ? {
        classification: "DISPLAY_AS_LEGACY" as const,
        limitation_reason_code: classification.legacyLimitationReason,
      }
    : null;
  return {
    integrityConflict: false,
    item: {
      activity_id: `ledger:${row.id}:recorded`,
      public_reference: `financial-activity:ledger:${row.id}`,
      resource_version: `observed:${maxDate(row.createdAt, row.vault.updatedAt).toISOString()}`,
      source_owner: "FINANCIAL_LEDGER",
      source_reference: `ledger:${row.id}`,
      category: classification.category,
      is_financial_movement: classification.isFinancialMovement,
      financial_value:
        classification.isFinancialMovement ||
        classification.category === "PROTECTED_ALLOCATION"
          ? exactMoney(row.amount, row.currency)
          : null,
      recorded_at: utcInstant(row.createdAt),
      occurred_at: utcInstant(row.createdAt),
      source_observed_at: utcInstant(
        maxDate(row.createdAt, row.vault.updatedAt),
      ),
      normalized_status: classification.normalizedStatus,
      actor_source: "FINANCIAL_LEDGER",
      // EscrowTransactionLedger.collaborationId has no relation/FK. Exposing it
      // would claim lineage the source cannot prove.
      references: emptyReferences(),
      legacy,
    },
  };
}

function mapObligationActivity(row: ObligationRow): Projection {
  if (!obligationLineageValid(row)) {
    return { item: null, integrityConflict: true };
  }
  const observedAt =
    maxObservedAt([
      row.updatedAt,
      row.vault.updatedAt,
      row.collaboration.updatedAt,
      row.collaboration.creatorUser.creatorProfile?.updatedAt,
    ]) ?? row.updatedAt;
  return {
    integrityConflict: false,
    item: {
      activity_id: `obligation:${row.id}:created`,
      public_reference: `financial-activity:obligation:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      source_owner: "PAYOUT_EXECUTION",
      source_reference: `payout-obligation:${row.id}`,
      category: "BUSINESS_OBLIGATION",
      is_financial_movement: false,
      financial_value: exactMoney(row.entitlementAmount, row.currency),
      recorded_at: utcInstant(row.createdAt),
      occurred_at: utcInstant(row.createdAt),
      source_observed_at: utcInstant(observedAt),
      normalized_status: "OBLIGATION_RECORDED",
      actor_source: "COLLABORATION_INSTRUCTION",
      references: {
        campaign_id: row.collaboration.campaignId,
        collaboration_id: row.collaborationId,
        creator_reference: row.creatorProfileId,
        obligation_id: row.id,
        brand_return_id: null,
      },
      legacy: {
        classification: "DISPLAY_WITH_LIMITATION",
        limitation_reason_code: "C04_INSTRUCTION_PROVENANCE_UNAVAILABLE",
      },
    },
  };
}

function mapTransferActivity(row: TransferRow): Projection {
  if (!executionLineageValid(row)) {
    return { item: null, integrityConflict: true };
  }
  const normalized = normalizedTransferStatus(row);
  const observedAt =
    maxObservedAt([
      row.updatedAt,
      row.obligation.updatedAt,
      row.obligation.vault.updatedAt,
      row.obligation.collaboration.updatedAt,
      row.obligation.collaboration.creatorUser.creatorProfile?.updatedAt,
    ]) ?? row.updatedAt;
  return {
    integrityConflict: false,
    item: {
      activity_id: `transfer:${row.id}:created`,
      public_reference: `financial-activity:transfer:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      source_owner: "PAYOUT_EXECUTION",
      source_reference: `transfer-attempt:${row.id}`,
      category: "PROVIDER_EXECUTION",
      is_financial_movement: false,
      financial_value: null,
      recorded_at: utcInstant(row.createdAt),
      occurred_at: utcInstant(row.initiatedAt),
      source_observed_at: utcInstant(observedAt),
      normalized_status: normalized.status,
      actor_source: "PAYOUT_EXECUTION",
      references: executionReferences(row.obligation),
      legacy: normalized.limitation
        ? {
            classification: "LEGACY_UNRECONCILED",
            limitation_reason_code: normalized.limitation,
          }
        : null,
    },
  };
}

function mapReversalActivity(row: ReversalRow): Projection {
  const transfer = row.transferAttempt;
  if (
    !executionLineageValid(transfer) ||
    row.currency !== transfer.currency ||
    !row.amount.greaterThan(0) ||
    row.amount.greaterThan(transfer.amount)
  ) {
    return { item: null, integrityConflict: true };
  }
  const normalized = normalizedReversalStatus(row);
  const observedAt =
    maxObservedAt([
      row.updatedAt,
      transfer.updatedAt,
      transfer.obligation.updatedAt,
      transfer.obligation.vault.updatedAt,
      transfer.obligation.collaboration.updatedAt,
      transfer.obligation.collaboration.creatorUser.creatorProfile?.updatedAt,
    ]) ?? row.updatedAt;
  return {
    integrityConflict: false,
    item: {
      activity_id: `reversal:${row.id}:created`,
      public_reference: `financial-activity:reversal:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      source_owner: "PAYOUT_EXECUTION",
      source_reference: `transfer-reversal:${row.id}`,
      category: "RETURN_REFUND_REVERSAL",
      is_financial_movement: false,
      financial_value: null,
      recorded_at: utcInstant(row.createdAt),
      occurred_at: utcInstant(row.initiatedAt),
      source_observed_at: utcInstant(observedAt),
      normalized_status: normalized.status,
      actor_source: "PAYOUT_EXECUTION",
      references: executionReferences(transfer.obligation),
      legacy: normalized.limitation
        ? {
            classification: "LEGACY_UNRECONCILED",
            limitation_reason_code: normalized.limitation,
          }
        : null,
    },
  };
}

function mapReturnActivity(row: ReturnRow): Projection {
  if (
    row.brandProfileId !== row.vault.brandProfileId ||
    row.vaultId !== row.vault.id ||
    row.currency !== row.vault.currency ||
    row.requestedAt.getTime() > row.updatedAt.getTime()
  ) {
    return { item: null, integrityConflict: true };
  }
  const observedAt = maxDate(row.updatedAt, row.vault.updatedAt);
  return {
    integrityConflict: false,
    item: {
      activity_id: `brand-return:${row.id}:created`,
      public_reference: `financial-activity:brand-return:${row.id}`,
      resource_version: `observed:${observedAt.toISOString()}`,
      source_owner: "BRAND_RETURN",
      source_reference: `brand-return:${row.id}`,
      category: "RETURN_REFUND_REVERSAL",
      is_financial_movement: false,
      financial_value: null,
      recorded_at: utcInstant(row.createdAt),
      occurred_at: utcInstant(row.requestedAt),
      source_observed_at: utcInstant(observedAt),
      normalized_status: `BRAND_RETURN_${mapBrandReturnStatus(row.status)}`,
      actor_source: "BRAND_RETURN",
      references: {
        ...emptyReferences(),
        brand_return_id: row.id,
      },
      legacy: null,
    },
  };
}

function obligationLineageValid(row: ObligationRow): boolean {
  return (
    row.entitlementAmount.greaterThan(0) &&
    row.collaborationId === row.collaboration.id &&
    row.brandProfileId === row.collaboration.brandProfileId &&
    row.brandProfileId === row.vault.brandProfileId &&
    row.vaultId === row.vault.id &&
    row.currency === row.vault.currency &&
    row.creatorProfileId === row.collaboration.creatorUser.creatorProfile?.id
  );
}

function executionLineageValid(row: TransferRow): boolean {
  const obligation = row.obligation;
  return (
    obligation.entitlementAmount.greaterThan(0) &&
    obligation.collaborationId === obligation.collaboration.id &&
    obligation.brandProfileId === obligation.collaboration.brandProfileId &&
    obligation.brandProfileId === obligation.vault.brandProfileId &&
    obligation.vaultId === obligation.vault.id &&
    obligation.currency === obligation.vault.currency &&
    obligation.creatorProfileId ===
      obligation.collaboration.creatorUser.creatorProfile?.id &&
    row.currency === obligation.currency &&
    row.amount.greaterThan(0) &&
    row.amount.equals(obligation.entitlementAmount)
  );
}

function transferTimelineCoherent(row: TransferRow): boolean {
  const sequence = [
    row.initiatedAt,
    row.providerAcceptedAt,
    row.processedAt,
    row.releasedAt,
    row.settledAt,
  ].filter((value): value is Date => Boolean(value));
  if (
    row.createdAt.getTime() > row.initiatedAt.getTime() ||
    row.initiatedAt.getTime() > row.updatedAt.getTime() ||
    (row.failedAt && row.settledAt) ||
    (row.failedAt &&
      (row.failedAt.getTime() < row.initiatedAt.getTime() ||
        row.failedAt.getTime() > row.updatedAt.getTime()))
  ) {
    return false;
  }
  return sequence.every(
    (value, index) =>
      value.getTime() <= row.updatedAt.getTime() &&
      (index === 0 || value.getTime() >= sequence[index - 1].getTime()),
  );
}

function normalizedTransferStatus(row: TransferRow): {
  readonly status: string;
  readonly limitation: string | null;
} {
  if (!transferTimelineCoherent(row)) {
    return {
      status: "LEGACY_UNRECONCILED",
      limitation: "TRANSFER_MILESTONE_CHRONOLOGY_UNPROVEN",
    };
  }
  const held = row.settlementState === RouteSettlementState.HELD;
  if (row.onHold !== held) {
    return {
      status: "LEGACY_UNRECONCILED",
      limitation: "TRANSFER_HOLD_STATE_CONTRADICTION",
    };
  }
  switch (row.state) {
    case RouteTransferState.CREATED:
      return !row.providerAcceptedAt && !row.processedAt && !row.failedAt
        ? { status: "QUEUED", limitation: null }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "TRANSFER_STATE_MILESTONE_CONTRADICTION",
          };
    case RouteTransferState.PENDING:
      return !row.processedAt && !row.failedAt
        ? {
            status: held ? "HELD_RELEASE_PENDING" : "PROCESSING",
            limitation: null,
          }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "TRANSFER_STATE_MILESTONE_CONTRADICTION",
          };
    case RouteTransferState.PROCESSED:
      return row.processedAt && !row.failedAt
        ? {
            status: held ? "HELD_RELEASE_PENDING" : "PROCESSING",
            limitation: null,
          }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "TRANSFER_STATE_MILESTONE_CONTRADICTION",
          };
    case RouteTransferState.FAILED:
      return row.failedAt && !row.processedAt && !row.settledAt
        ? { status: "ACTION_REQUIRED", limitation: null }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "TRANSFER_FAILURE_MILESTONE_UNPROVEN",
          };
    default:
      return {
        status: "LEGACY_UNRECONCILED",
        limitation: "TRANSFER_CURRENT_STATE_NOT_CANONICAL_EVIDENCE",
      };
  }
}

function normalizedReversalStatus(row: ReversalRow): {
  readonly status: string;
  readonly limitation: string | null;
} {
  const transfer = row.transferAttempt;
  const parentCoherent =
    transferTimelineCoherent(transfer) &&
    Boolean(transfer.settledAt) &&
    transfer.settlementState === RouteSettlementState.SETTLED &&
    !transfer.failedAt &&
    (transfer.settledAt?.getTime() ?? Number.POSITIVE_INFINITY) <=
      row.initiatedAt.getTime();
  const baseCoherent =
    parentCoherent &&
    row.createdAt.getTime() <= row.initiatedAt.getTime() &&
    row.initiatedAt.getTime() <= row.updatedAt.getTime();
  if (!baseCoherent) {
    return {
      status: "LEGACY_UNRECONCILED",
      limitation: "REVERSAL_PARENT_OR_CHRONOLOGY_UNPROVEN",
    };
  }
  switch (row.state) {
    case RouteReversalState.PROCESSED:
      return row.processedAt &&
        !row.failedAt &&
        row.initiatedAt.getTime() <= row.processedAt.getTime() &&
        row.processedAt.getTime() <= row.updatedAt.getTime() &&
        new Set<RouteTransferState>([
          RouteTransferState.PARTIALLY_REVERSED,
          RouteTransferState.REVERSED,
        ]).has(transfer.state)
        ? { status: "REVERSAL_CONFIRMED", limitation: null }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "REVERSAL_PROCESSED_MILESTONE_UNPROVEN",
          };
    case RouteReversalState.FAILED:
      return row.failedAt &&
        !row.processedAt &&
        row.initiatedAt.getTime() <= row.failedAt.getTime() &&
        row.failedAt.getTime() <= row.updatedAt.getTime()
        ? { status: "REVERSAL_ACTION_REQUIRED", limitation: null }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "REVERSAL_FAILURE_MILESTONE_UNPROVEN",
          };
    case RouteReversalState.CREATED:
    case RouteReversalState.PENDING:
      return !row.processedAt && !row.failedAt
        ? { status: "REVERSAL_PROCESSING", limitation: null }
        : {
            status: "LEGACY_UNRECONCILED",
            limitation: "REVERSAL_STATE_MILESTONE_CONTRADICTION",
          };
    default:
      return {
        status: "LEGACY_UNRECONCILED",
        limitation: "REVERSAL_CURRENT_STATE_NOT_CANONICAL_EVIDENCE",
      };
  }
}

function executionReferences(
  obligation: TransferRow["obligation"],
): BrandPayoutsActivityItemV2["references"] {
  return {
    campaign_id: obligation.collaboration.campaignId,
    collaboration_id: obligation.collaborationId,
    creator_reference: obligation.creatorProfileId,
    obligation_id: obligation.id,
    brand_return_id: null,
  };
}

function emptyReferences(): BrandPayoutsActivityItemV2["references"] {
  return {
    campaign_id: null,
    collaboration_id: null,
    creator_reference: null,
    obligation_id: null,
    brand_return_id: null,
  };
}

function sortActivity(
  items: readonly BrandPayoutsActivityItemV2[],
): BrandPayoutsActivityItemV2[] {
  return [...items].sort((left, right) => {
    const time =
      new Date(right.recorded_at).getTime() -
      new Date(left.recorded_at).getTime();
    return time || right.activity_id.localeCompare(left.activity_id);
  });
}

function normalizeCategories(
  values: readonly BrandPayoutsActivityCategory[] | undefined,
): readonly BrandPayoutsActivityCategory[] {
  return [...new Set(values ?? [])].sort();
}

function assertRange(range: ActivityRange): void {
  if (
    range.fromInclusive &&
    range.toExclusive &&
    range.fromInclusive.getTime() >= range.toExclusive.getTime()
  ) {
    throw new BadRequestException({
      code: "BRAND_PAYOUTS_ACTIVITY_RANGE_INVALID",
      message: "Activity from must be earlier than to",
    });
  }
}

function assertCsvRange(from: Date, to: Date): void {
  if (
    from.getTime() >= to.getTime() ||
    to.getTime() - from.getTime() > CSV_RANGE_MAX_MS
  ) {
    throw new BadRequestException({
      code: "BRAND_PAYOUTS_CSV_RANGE_INVALID",
      message: "CSV range must be positive and no longer than 366 days",
    });
  }
}

function activityCoverage(integrityConflict: boolean) {
  return [
    {
      source: "FINANCIAL_LEDGER" as const,
      status: integrityConflict ? ("PARTIAL" as const) : ("AVAILABLE" as const),
      limitation_reason_code: integrityConflict
        ? "INTEGRITY_CONFLICT_ROWS_OMITTED"
        : null,
      recovery_hint: null,
    },
    {
      source: "PAYOUT_OBLIGATIONS" as const,
      status: "PARTIAL" as const,
      limitation_reason_code: "IMMUTABLE_ACTIVITY_MILESTONES_INCOMPLETE",
      recovery_hint: null,
    },
    {
      source: "BRAND_RETURNS" as const,
      status: "AVAILABLE" as const,
      limitation_reason_code: null,
      recovery_hint: null,
    },
    {
      source: "COLLABORATION_RESERVE_REQUESTS" as const,
      status: "UNAVAILABLE" as const,
      limitation_reason_code: "C04_RESERVE_REQUEST_SOURCE_NOT_AVAILABLE",
      recovery_hint: null,
    },
  ];
}

function activityLimitations(integrityConflict: boolean) {
  return [
    {
      source: "FINANCIAL_LEDGER" as const,
      reason_code: "MUTABLE_LOAD_TRANSITION_TIMESTAMP_UNAVAILABLE",
      detail:
        "Funding-load rows are omitted because mutable status does not preserve an immutable transition timestamp.",
    },
    {
      source: "PAYOUT_OBLIGATIONS" as const,
      reason_code: "IMMUTABLE_ACTIVITY_MILESTONES_INCOMPLETE",
      detail:
        "Legacy payout rows expose only bounded durable evidence and current state.",
    },
    ...(integrityConflict
      ? [
          {
            source: "FINANCIAL_LEDGER" as const,
            reason_code: "INTEGRITY_CONFLICT_ROWS_OMITTED",
            detail:
              "Rows with unproven Brand, vault, Creator, currency, amount, or chronology lineage were omitted.",
          },
        ]
      : []),
  ];
}

function activitySourceId(item: BrandPayoutsActivityItemV2) {
  switch (item.source_owner) {
    case "FINANCIAL_LEDGER":
      return "FINANCIAL_LEDGER" as const;
    case "BRAND_RETURN":
      return "BRAND_RETURNS" as const;
    default:
      return "PAYOUT_OBLIGATIONS" as const;
  }
}

function emptyCampaignManagerResponse(
  request: BrandPayoutsActivityPageRequestV2,
  asOf: Date,
): BrandPayoutsActivityResponseV2 {
  return {
    schema_version: BRAND_PAYOUTS_V2_SCHEMA_VERSION,
    as_of: utcInstant(asOf),
    viewer: projectBrandPayoutsViewerV2(request.authorization),
    sections: [
      {
        section_id: "ACTIVITY",
        coverage: "UNAVAILABLE",
        freshness: "CURRENT",
        source_observed_at: null,
        source_coverage: [
          {
            source: "FINANCIAL_LEDGER",
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

function parseActivityId(resourceId: string): {
  readonly source:
    | "ledger"
    | "obligation"
    | "transfer"
    | "reversal"
    | "brand-return";
  readonly id: string;
} | null {
  const match =
    /^(ledger|obligation|transfer|reversal|brand-return):([^:]+):(recorded|created)$/u.exec(
      resourceId,
    );
  return match
    ? {
        source: match[1] as
          | "ledger"
          | "obligation"
          | "transfer"
          | "reversal"
          | "brand-return",
        id: match[2],
      }
    : null;
}

function activityNotFound(): NotFoundException {
  return new NotFoundException({
    code: "BRAND_PAYOUTS_ACTIVITY_NOT_FOUND",
    message: "Financial activity was not found",
  });
}

function activityIntegrityConflict(): ConflictException {
  return new ConflictException({
    code: "BRAND_PAYOUTS_ACTIVITY_INTEGRITY_CONFLICT",
    message: "Activity export cannot include unverified source rows",
  });
}

function maxDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}

function csvFilename(
  authorization: BrandPayoutsFullFinancialAuthorizationScopeV1,
  from: Date,
  to: Date,
  generatedAt: Date,
): string {
  const day = (value: Date) => value.toISOString().slice(0, 10);
  return `financial-activity_${authorization.brandProfileId}_${day(from)}_${day(to)}_${generatedAt.toISOString().replace(/[:.]/gu, "-")}.csv`;
}

function csvCell(value: string): string {
  const protectedValue = /^[\t\r\n ]*[=+\-@]/u.test(value)
    ? `'${value}`
    : value;
  return `"${protectedValue.replace(/"/gu, '""')}"`;
}

async function* csvBody(
  items: readonly BrandPayoutsActivityItemV2[],
): AsyncIterable<Uint8Array> {
  const header = [
    "activity_id",
    "public_reference",
    "category",
    "is_financial_movement",
    "amount",
    "currency",
    "recorded_at",
    "occurred_at",
    "normalized_status",
    "campaign_id",
    "collaboration_id",
    "creator_reference",
    "obligation_id",
    "brand_return_id",
    "legacy_classification",
    "limitation_reason_code",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const item of items) {
    lines.push(
      [
        item.activity_id,
        item.public_reference,
        item.category,
        String(item.is_financial_movement),
        item.financial_value?.amount ?? "",
        item.financial_value?.currency ?? "",
        item.recorded_at,
        item.occurred_at ?? "",
        item.normalized_status,
        item.references.campaign_id ?? "",
        item.references.collaboration_id ?? "",
        item.references.creator_reference ?? "",
        item.references.obligation_id ?? "",
        item.references.brand_return_id ?? "",
        item.legacy?.classification ?? "",
        item.legacy?.limitation_reason_code ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  yield new TextEncoder().encode(`${lines.join("\r\n")}\r\n`);
}
