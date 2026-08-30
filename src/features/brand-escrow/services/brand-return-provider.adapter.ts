import { Injectable } from "@nestjs/common";

import type {
  BrandReturnProviderCapability,
  BrandReturnProviderOutcome,
  BrandReturnProviderRefundInput,
  TrustedFundingEvidence,
} from "./brand-return-provider.types";
import {
  BrandReturnProviderReconciliationRequiredError,
  BrandReturnProviderSetupRequiredError,
} from "./brand-return-provider.types";

export abstract class BrandReturnRefundProvider {
  abstract capabilities(): Promise<BrandReturnProviderCapability[]>;
  abstract assertExecutionAvailable(): Promise<void>;
  abstract createRefund(
    input: BrandReturnProviderRefundInput,
  ): Promise<BrandReturnProviderOutcome>;
  abstract fetchRefund(input: {
    semanticIdentity: string;
    providerRefundId?: string | null;
  }): Promise<BrandReturnProviderOutcome>;
  abstract verifyTrustedFundingEvidence(
    evidence: TrustedFundingEvidence,
  ): Promise<void>;
}

@Injectable()
export class FailClosedBrandReturnRefundProvider extends BrandReturnRefundProvider {
  capabilities(): Promise<BrandReturnProviderCapability[]> {
    return Promise.resolve([]);
  }

  assertExecutionAvailable(): Promise<void> {
    return Promise.reject(new BrandReturnProviderSetupRequiredError());
  }

  createRefund(
    _input: BrandReturnProviderRefundInput,
  ): Promise<BrandReturnProviderOutcome> {
    return Promise.reject(new BrandReturnProviderSetupRequiredError());
  }

  fetchRefund(_input: {
    semanticIdentity: string;
    providerRefundId?: string | null;
  }): Promise<BrandReturnProviderOutcome> {
    return Promise.reject(
      new BrandReturnProviderReconciliationRequiredError(
        "Brand Return provider reconciliation is not configured",
      ),
    );
  }

  verifyTrustedFundingEvidence(
    _evidence: TrustedFundingEvidence,
  ): Promise<void> {
    return Promise.reject(
      new BrandReturnProviderSetupRequiredError(
        "Trusted funding-source verification is not configured",
      ),
    );
  }
}
