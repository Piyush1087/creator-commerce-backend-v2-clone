import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { CollaborationEscrowReserveService } from "../../brand-escrow/services/collaboration-escrow-reserve.service";

export type EscrowReserveRequest = {
  collaborationId: string;
  brandProfileId: string;
  currency: string;
  creatorGrossFee: Prisma.Decimal;
  platformCommissionAmount: Prisma.Decimal;
  platformCommissionGstAmount: Prisma.Decimal;
  requiredSecuredAmount: Prisma.Decimal;
};

export abstract class CollaborationFundingGateway {
  abstract reserveFunds(
    tx: Prisma.TransactionClient,
    request: EscrowReserveRequest,
  ): ReturnType<CollaborationEscrowReserveService["reserveFunds"]>;
}

@Injectable()
export class DeferredCollaborationFundingGateway implements CollaborationFundingGateway {
  constructor(private readonly escrow: CollaborationEscrowReserveService) {}

  reserveFunds(tx: Prisma.TransactionClient, request: EscrowReserveRequest) {
    return this.escrow.reserveFunds(tx, request);
  }
}
