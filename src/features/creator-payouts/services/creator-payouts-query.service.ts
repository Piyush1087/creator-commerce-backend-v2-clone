import { Inject, Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import {
  CREATOR_PAYOUT_METHOD_SUMMARY_PORT,
  type CreatorPayoutMethodSummaryPort,
} from "../../creator-settings/payouts/creator-payout-method-summary.port";

import {
  creatorPayoutsEnvelope,
  type CreatorPayoutsAuthorizationScope,
  type CreatorPayoutSummaryFamily,
} from "../contracts/creator-payouts.contract";
import {
  classifySummary,
  CreatorPayoutsObligationProjectionService,
} from "./creator-payouts-obligation-projection.service";
import { CreatorPayoutsReadEnvironmentService } from "./creator-payouts-read-environment.service";
import { CreatorPayoutsHistoryProjectionService } from "./creator-payouts-history-projection.service";

type ReadInput = {
  readonly authorization: CreatorPayoutsAuthorizationScope;
  readonly asOf: Date;
};
type ListInput = ReadInput & {
  readonly limit: number;
  readonly cursor?: string;
};

@Injectable()
export class CreatorPayoutsQueryService {
  constructor(
    private readonly environment: CreatorPayoutsReadEnvironmentService,
    private readonly obligations: CreatorPayoutsObligationProjectionService,
    private readonly history: CreatorPayoutsHistoryProjectionService,
    @Inject(CREATOR_PAYOUT_METHOD_SUMMARY_PORT)
    private readonly payoutMethods: CreatorPayoutMethodSummaryPort,
  ) {}

  async readOverview(input: ReadInput) {
    await this.environment.assertDatabaseUtc();
    const rows = await this.obligations.allCanonical(input);
    const canonical = rows.filter((row) => row.canonical);
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: {
        coverage: canonical.length === rows.length ? "COMPLETE" : "PARTIAL",
        freshness: "CURRENT",
        source_coverage: ["PAYOUT_OBLIGATIONS", "TRANSFER_SETTLEMENT_EVIDENCE"],
        available_actions: [],
      },
      summaries: summarizeCreatorPayouts(
        canonical.map((row) => row.item),
        input.asOf,
      ),
    };
  }

  async listObligations(input: ListInput) {
    await this.environment.assertDatabaseUtc();
    const result = await this.obligations.list(input);
    return {
      ...creatorPayoutsEnvelope(input.authorization, result.asOf),
      section: {
        coverage: result.coverage,
        freshness: "CURRENT",
        source_coverage: [
          "PAYOUT_OBLIGATIONS",
          "C04_FINANCIAL_LINEAGE",
          "TRANSFER_SETTLEMENT_EVIDENCE",
        ],
        available_actions: [],
      },
      items: result.items,
      page: { limit: input.limit, next_cursor: result.nextCursor },
    };
  }

  async listHistory(input: ListInput) {
    await this.environment.assertDatabaseUtc();
    const result = await this.history.list(input);
    return {
      ...creatorPayoutsEnvelope(input.authorization, result.asOf),
      section: {
        coverage: "COMPLETE",
        freshness: "CURRENT",
        source_coverage: [
          "PAYOUT_OBLIGATIONS",
          "TRANSFER_ATTEMPTS",
          "RECONCILED_RECEIPTS",
          "PAYOUT_SETTLEMENT_LEDGER",
          "PAYOUT_REVERSALS",
        ],
        available_actions: [],
      },
      items: result.items,
      page: { limit: input.limit, next_cursor: result.nextCursor },
    };
  }

  async readPayoutMethod(input: ReadInput) {
    await this.environment.assertDatabaseUtc();
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: {
        coverage: "COMPLETE",
        freshness: "CURRENT",
        source_coverage: ["C05_PAYOUT_DESTINATION"],
        available_actions: [],
      },
      payout_method: await this.payoutMethods.read(
        input.authorization.subjectCreatorProfileId,
        true,
      ),
    };
  }

  async readObligation(input: ReadInput & { readonly resourceId: string }) {
    await this.environment.assertDatabaseUtc();
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: {
        coverage: "COMPLETE",
        freshness: "CURRENT",
        source_coverage: ["PAYOUT_OBLIGATIONS", "C04_FINANCIAL_LINEAGE"],
        available_actions: [],
      },
      obligation: await this.obligations.detail(input),
    };
  }

  async readHistory(input: ReadInput & { readonly resourceId: string }) {
    await this.environment.assertDatabaseUtc();
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: {
        coverage: "COMPLETE",
        freshness: "CURRENT",
        source_coverage: ["PAYOUT_HISTORY_PROJECTION"],
        available_actions: [],
      },
      history: await this.history.detail(input),
    };
  }
}

const SUMMARY_FAMILIES: readonly CreatorPayoutSummaryFamily[] = [
  "UPCOMING",
  "DUE_OR_ACTION_REQUIRED",
  "PROCESSING",
  "PAID_TO_DATE",
];

export function summarizeCreatorPayouts(
  items: readonly import("../contracts/creator-payouts.contract").CreatorPayoutObligationItem[],
  asOf: Date,
) {
  const currencies = [
    ...new Set(
      items.flatMap((item) =>
        [item.outstanding_value?.currency, item.settled_value?.currency].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  ].sort();
  return currencies.flatMap((currency) =>
    SUMMARY_FAMILIES.map((family) => {
      const amount = items.reduce((total, item) => {
        const included =
          family === "PAID_TO_DATE"
            ? Boolean(item.settled_value && !item.legacy)
            : classifySummary(item, asOf) === family;
        if (!included) return total;
        const money =
          family === "PAID_TO_DATE"
            ? item.settled_value
            : item.outstanding_value;
        return money?.currency === currency ? total.add(money.amount) : total;
      }, new Decimal(0));
      return { family, value: { amount: amount.toFixed(4), currency } };
    }),
  );
}
