import type { Prisma } from "@prisma/client";

/** P1.4 supplies this transactional port. P1.3 registers no implementation. */
export abstract class ApprovedApplicationCollaborationPort {
  abstract provisionFromApprovedApplication(
    tx: Prisma.TransactionClient,
    input: { applicationId: string; approvalTransitionId: string },
  ): Promise<{ collaborationId: string; created: boolean }>;
}
