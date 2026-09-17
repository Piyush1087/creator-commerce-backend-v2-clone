import { Injectable, NotFoundException } from "@nestjs/common";
import { EscrowTransactionStatus, EscrowTransactionType } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreatorPayoutHistoryItem,
  CreatorPayoutObligationItem,
  CreatorPayoutsAuthorizationScope,
} from "../contracts/creator-payouts.contract";
import { CreatorPayoutsCursorCodec } from "../utils/creator-payouts-cursor";
import { CreatorPayoutsObligationProjectionService } from "./creator-payouts-obligation-projection.service";

type Event = {
  item: CreatorPayoutHistoryItem;
  recordedAt: Date;
  stableId: string;
};

@Injectable()
export class CreatorPayoutsHistoryProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly obligations: CreatorPayoutsObligationProjectionService,
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
      endpoint: "history",
      filterKey: "{}",
      authorization: input.authorization,
      requestAsOf: input.asOf,
    });
    const all = await this.events(input.authorization, boundary.asOf);
    const filtered =
      boundary.lastRecordedAt && boundary.lastStableId
        ? all.filter(
            (event) =>
              event.recordedAt < boundary.lastRecordedAt! ||
              (event.recordedAt.getTime() ===
                boundary.lastRecordedAt!.getTime() &&
                event.stableId < boundary.lastStableId!),
          )
        : all;
    const page = filtered.slice(0, input.limit);
    const last = page.at(-1);
    return {
      asOf: boundary.asOf,
      items: page.map((event) => event.item),
      nextCursor:
        filtered.length > input.limit && last
          ? this.cursors.encode({
              endpoint: "history",
              filterKey: "{}",
              authorization: input.authorization,
              asOf: boundary.asOf,
              lastRecordedAt: last.recordedAt,
              lastStableId: last.stableId,
            })
          : null,
    };
  }

  async detail(input: {
    authorization: CreatorPayoutsAuthorizationScope;
    asOf: Date;
    resourceId: string;
  }) {
    const event = (await this.events(input.authorization, input.asOf)).find(
      (candidate) =>
        candidate.item.history_id === stripReference(input.resourceId),
    );
    if (!event) throw notFound();
    return event.item;
  }

  private async events(
    authorization: CreatorPayoutsAuthorizationScope,
    asOf: Date,
  ): Promise<Event[]> {
    const projected = await this.obligations.allCanonical({
      authorization,
      asOf,
    });
    const canonical = new Map(
      projected
        .filter((row) => row.canonical)
        .map((row) => [row.item.obligation_id, row.item]),
    );
    const obligationIds = [...canonical.keys()];
    if (obligationIds.length === 0) return [];
    const obligations = await this.prisma.creatorPayoutObligation.findMany({
      where: {
        id: { in: obligationIds },
        creatorProfileId: authorization.subjectCreatorProfileId,
        collaboration: {
          creatorProfileId: authorization.subjectCreatorProfileId,
          creatorWorkspaceId: authorization.workspaceId,
        },
        createdAt: { lte: asOf },
      },
      select: {
        id: true,
        collaborationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const transfers = await this.prisma.routeTransferAttempt.findMany({
      where: {
        obligationId: { in: obligationIds },
        obligation: {
          creatorProfileId: authorization.subjectCreatorProfileId,
          collaboration: {
            creatorProfileId: authorization.subjectCreatorProfileId,
            creatorWorkspaceId: authorization.workspaceId,
          },
        },
        createdAt: { lte: asOf },
      },
      select: {
        id: true,
        obligationId: true,
        amount: true,
        currency: true,
        state: true,
        settlementState: true,
        settlementId: true,
        initiatedAt: true,
        processedAt: true,
        settledAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
        reconciledReceipts: {
          where: { receivedAt: { lte: asOf } },
          select: {
            id: true,
            eventClass: true,
            receivedAt: true,
            reconciledAt: true,
          },
        },
        reversals: {
          where: { createdAt: { lte: asOf } },
          select: {
            id: true,
            amount: true,
            currency: true,
            state: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    const settlementIds = transfers
      .map((transfer) => transfer.settlementId)
      .filter((id): id is string => Boolean(id));
    const ledgers =
      settlementIds.length === 0
        ? []
        : await this.prisma.escrowTransactionLedger.findMany({
            where: {
              gatewayReferenceId: { in: settlementIds },
              collaborationId: {
                in: [...new Set(obligations.map((row) => row.collaborationId))],
              },
              transactionType: {
                in: [
                  EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT,
                  EscrowTransactionType.CREATOR_PAYOUT_REVERSAL,
                ],
              },
              transactionStatus: {
                in: [
                  EscrowTransactionStatus.CLEARED,
                  EscrowTransactionStatus.REVERSED,
                ],
              },
              createdAt: { lte: asOf },
            },
            select: {
              id: true,
              gatewayReferenceId: true,
              collaborationId: true,
              transactionType: true,
              transactionStatus: true,
              amount: true,
              currency: true,
              createdAt: true,
            },
          });
    const events: Event[] = [];
    for (const row of obligations) {
      const item = canonical.get(row.id)!;
      events.push(
        event(
          "OBLIGATION_RECORDED",
          row.id,
          row.createdAt,
          item,
          item.entitlement_value,
          "RECORDED",
        ),
      );
    }
    for (const transfer of transfers) {
      const item = canonical.get(transfer.obligationId)!;
      const money =
        transfer.currency === item.entitlement_value?.currency
          ? { amount: transfer.amount.toFixed(4), currency: transfer.currency }
          : null;
      if (transfer.failedAt)
        events.push(
          event(
            "TRANSFER_FAILED",
            transfer.id,
            transfer.failedAt,
            item,
            money,
            "FAILED_RETRYABLE",
          ),
        );
      else if (!transfer.settledAt)
        events.push(
          event(
            "TRANSFER_PROCESSING",
            transfer.id,
            transfer.initiatedAt,
            item,
            money,
            "PROCESSING",
          ),
        );
      const settlementLedger = ledgers.filter(
        (ledger) =>
          ledger.gatewayReferenceId === transfer.settlementId &&
          ledger.transactionType === "CREATOR_PAYOUT_SETTLEMENT",
      );
      const settlementReceipt = transfer.reconciledReceipts.filter(
        (receipt) => receipt.eventClass === "SETTLEMENT_RECORDED",
      );
      if (
        transfer.settledAt &&
        settlementLedger.length === 1 &&
        settlementReceipt.length === 1
      )
        events.push(
          event(
            "SETTLED",
            transfer.id,
            settlementReceipt[0].reconciledAt,
            item,
            money,
            "SETTLED",
          ),
        );
      for (const reversal of transfer.reversals) {
        if (
          reversal.state !== "PROCESSED" ||
          !reversal.processedAt ||
          reversal.currency !== item.entitlement_value?.currency
        )
          continue;
        events.push(
          event(
            "REVERSAL_PROCESSED",
            reversal.id,
            reversal.processedAt,
            item,
            { amount: reversal.amount.toFixed(4), currency: reversal.currency },
            "REVERSED",
          ),
        );
      }
    }
    return events.sort(
      (left, right) =>
        right.recordedAt.getTime() - left.recordedAt.getTime() ||
        right.stableId.localeCompare(left.stableId),
    );
  }
}

function event(
  type: CreatorPayoutHistoryItem["event_type"],
  sourceId: string,
  recordedAt: Date,
  obligation: CreatorPayoutObligationItem,
  value: CreatorPayoutHistoryItem["value"],
  status: string,
): Event {
  const id = `${type.toLowerCase()}:${sourceId}`;
  return {
    recordedAt,
    stableId: id,
    item: {
      history_id: id,
      public_reference: `payout-history:${id}`,
      resource_version: `observed:${recordedAt.toISOString()}`,
      event_type: type,
      obligation_reference: obligation.public_reference,
      collaboration_reference: obligation.collaboration_reference,
      value,
      recorded_at: recordedAt.toISOString(),
      status,
    },
  };
}

function stripReference(value: string): string {
  return value.startsWith("payout-history:")
    ? value.slice("payout-history:".length)
    : value;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: "CREATOR_PAYOUT_RESOURCE_NOT_FOUND",
    message: "The requested payout resource was not found.",
  });
}
