import { Injectable } from "@nestjs/common";

import type {
  CreatorPayoutProviderPort,
  CreatorPayoutProviderCreateRequestV1,
  CreatorPayoutProviderReadRequestV1,
  CreatorPayoutProviderReversalRequestV1,
} from "../ports/creator-payout-provider.port";

/** Production default. It cannot construct or invoke a provider SDK/client. */
@Injectable()
export class FailClosedCreatorPayoutProviderService implements CreatorPayoutProviderPort {
  readonly methodCounts = {
    readCapabilities: 0,
    createTransfer: 0,
    readTransfer: 0,
    requestReversal: 0,
  };

  async readCapabilities() {
    this.methodCounts.readCapabilities += 1;
    return {
      availability: "UNAVAILABLE" as const,
      transferCreate: false,
      transferRead: false,
      reversalRequest: false,
      observedAt: new Date(),
      limitationReasonCode: "PAYOUT_PROVIDER_NOT_CONFIGURED",
    };
  }

  async createTransfer(_request: CreatorPayoutProviderCreateRequestV1) {
    this.methodCounts.createTransfer += 1;
    return this.unavailable();
  }

  async readTransfer(_request: CreatorPayoutProviderReadRequestV1) {
    this.methodCounts.readTransfer += 1;
    return this.unavailable();
  }

  async requestReversal(_request: CreatorPayoutProviderReversalRequestV1) {
    this.methodCounts.requestReversal += 1;
    return {
      outcome: "UNAVAILABLE" as const,
      reversalExecutionReference: null,
      reasonCode: "PAYOUT_PROVIDER_NOT_CONFIGURED",
      observedAt: new Date(),
    };
  }

  private unavailable() {
    return {
      outcome: "UNAVAILABLE" as const,
      executionReference: null,
      reasonCode: "PAYOUT_PROVIDER_NOT_CONFIGURED",
      observedAt: new Date(),
    };
  }
}
