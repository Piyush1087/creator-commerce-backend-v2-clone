import { Injectable } from "@nestjs/common";

export type CollaborationSettlementInstruction = {
  collaborationId: string;
  settlementId: string;
  financialResolutionId: string;
  creatorUserId: string;
  brandProfileId: string;
  currency: string;
  creatorPayoutAmount: string;
  brandRefundAmount: string;
  escrowLockRef: string | null;
  payoutInstructionRef: string | null;
  refundInstructionRef: string | null;
  idempotencyKey: string;
};

export type SettlementRequestAcceptance = {
  status: "ACCEPTED" | "ALREADY_ACCEPTED" | "REJECTED" | "RETRYABLE_FAILURE";
};

export abstract class CollaborationSettlementGateway {
  abstract requestExecution(
    instruction: CollaborationSettlementInstruction,
  ): Promise<SettlementRequestAcceptance>;
}

/** Replaceable Payout/Escrow adapter. Acceptance records intent only, never execution. */
@Injectable()
export class DeferredCollaborationSettlementGateway extends CollaborationSettlementGateway {
  async requestExecution(): Promise<SettlementRequestAcceptance> {
    return { status: "ACCEPTED" };
  }
}
