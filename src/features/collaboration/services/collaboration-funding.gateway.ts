import { Injectable } from "@nestjs/common";

export type FundingInstructionRequest = {
  collaborationId: string;
  commandId: string;
  amount: number;
  currency: string;
};

export abstract class CollaborationFundingGateway {
  abstract requestFunding(
    request: FundingInstructionRequest,
  ): Promise<{ fundingInstructionRef: string }>;
}

@Injectable()
export class DeferredCollaborationFundingGateway implements CollaborationFundingGateway {
  async requestFunding(request: FundingInstructionRequest) {
    // Provider-neutral, stable correlation only. This is not payment confirmation.
    return {
      fundingInstructionRef: `collaboration-funding:${request.commandId}`,
    };
  }
}
