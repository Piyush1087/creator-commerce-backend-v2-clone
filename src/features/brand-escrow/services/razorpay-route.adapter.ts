import { Injectable } from "@nestjs/common";

import type {
  RouteCapability,
  RouteReversalResult,
  RouteTransferResult,
} from "./razorpay-route.types";
import { RouteProviderGateError } from "./razorpay-route.types";

export type CreateRouteTransferInput = {
  linkedAccountId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  referenceId: string;
  onHold: boolean;
  onHoldUntil?: Date | null;
};

export type CreateRouteReversalInput = {
  transferId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  referenceId: string;
};

@Injectable()
export class RazorpayRouteAdapter {
  // The account's Route Test API, direct-transfer entitlement and exact request
  // fixtures are not yet enabled/verified. Keep the runtime seam fail-closed;
  // deterministic tests inject a contract adapter instead of faking success.
  assertCapability(capability: RouteCapability): never {
    throw new RouteProviderGateError(capability);
  }

  createLinkedAccount(): Promise<never> {
    return Promise.reject(new RouteProviderGateError("LINKED_ACCOUNT"));
  }

  fetchOnboardingState(_linkedAccountId: string): Promise<never> {
    return Promise.reject(new RouteProviderGateError("PRODUCT_CONFIGURATION"));
  }

  reconcileStakeholder(_linkedAccountId: string): Promise<never> {
    return Promise.reject(new RouteProviderGateError("STAKEHOLDER"));
  }

  reconcileBankConfiguration(_linkedAccountId: string): Promise<never> {
    return Promise.reject(new RouteProviderGateError("BANK_CONFIGURATION"));
  }

  createTransfer(
    _input: CreateRouteTransferInput,
  ): Promise<RouteTransferResult> {
    return Promise.reject(new RouteProviderGateError("DIRECT_TRANSFER"));
  }

  fetchTransfer(_transferId: string): Promise<RouteTransferResult> {
    return Promise.reject(new RouteProviderGateError("TRANSFER_READ"));
  }

  holdTransfer(
    _transferId: string,
    _until?: Date | null,
  ): Promise<RouteTransferResult> {
    return Promise.reject(new RouteProviderGateError("SETTLEMENT_HOLD"));
  }

  releaseTransfer(_transferId: string): Promise<RouteTransferResult> {
    return Promise.reject(new RouteProviderGateError("SETTLEMENT_RELEASE"));
  }

  createReversal(
    _input: CreateRouteReversalInput,
  ): Promise<RouteReversalResult> {
    return Promise.reject(new RouteProviderGateError("REVERSAL"));
  }

  fetchSettlement(_transferId: string): Promise<never> {
    return Promise.reject(new RouteProviderGateError("SETTLEMENT_READ"));
  }
}
