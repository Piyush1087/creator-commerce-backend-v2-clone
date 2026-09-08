import { Injectable, NotFoundException } from "@nestjs/common";

import {
  creatorPayoutsEnvelope,
  type CreatorPayoutsAuthorizationScope,
  unavailableSection,
} from "../contracts/creator-payouts.contract";
import { CreatorPayoutsCursorCodec } from "../utils/creator-payouts-cursor";
import { CreatorPayoutsReadEnvironmentService } from "./creator-payouts-read-environment.service";

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
    private readonly cursors: CreatorPayoutsCursorCodec,
  ) {}

  async readOverview(input: ReadInput) {
    await this.environment.assertDatabaseUtc();
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: unavailableSection(),
      summaries: [],
    };
  }

  async listObligations(input: ListInput) {
    await this.environment.assertDatabaseUtc();
    const boundary = this.cursors.decode({
      cursor: input.cursor,
      endpoint: "obligations",
      filterKey: "{}",
      authorization: input.authorization,
      requestAsOf: input.asOf,
    });
    return {
      ...creatorPayoutsEnvelope(input.authorization, boundary.asOf),
      section: unavailableSection(),
      items: [],
      page: { limit: input.limit, next_cursor: null },
    };
  }

  async listHistory(input: ListInput) {
    await this.environment.assertDatabaseUtc();
    const boundary = this.cursors.decode({
      cursor: input.cursor,
      endpoint: "history",
      filterKey: "{}",
      authorization: input.authorization,
      requestAsOf: input.asOf,
    });
    return {
      ...creatorPayoutsEnvelope(input.authorization, boundary.asOf),
      section: unavailableSection(),
      items: [],
      page: { limit: input.limit, next_cursor: null },
    };
  }

  async readPayoutMethod(input: ReadInput) {
    await this.environment.assertDatabaseUtc();
    return {
      ...creatorPayoutsEnvelope(input.authorization, input.asOf),
      section: unavailableSection(),
      payout_method: null,
    };
  }

  async readObligation(input: ReadInput & { readonly resourceId: string }) {
    await this.environment.assertDatabaseUtc();
    throw nonEnumeratingNotFound();
  }

  async readHistory(input: ReadInput & { readonly resourceId: string }) {
    await this.environment.assertDatabaseUtc();
    throw nonEnumeratingNotFound();
  }
}

function nonEnumeratingNotFound(): NotFoundException {
  return new NotFoundException({
    code: "CREATOR_PAYOUT_RESOURCE_NOT_FOUND",
    message: "The requested payout resource was not found.",
  });
}
