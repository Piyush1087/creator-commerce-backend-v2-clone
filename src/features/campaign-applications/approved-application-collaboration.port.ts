import type { Prisma } from "@prisma/client";

/** Narrow Collaboration-owned handoff; the Application caller owns the transaction. */
export abstract class ApprovedApplicationCollaborationPort {
  abstract provisionFromApprovedApplication(
    tx: Prisma.TransactionClient,
    input: { applicationId: string; approvalTransitionId: string },
  ): Promise<{ collaborationId: string; created: boolean }>;
}
