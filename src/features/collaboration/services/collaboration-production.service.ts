import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationLifecycle,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationStage,
  CollaborationStageStatus,
  CollaborationSubmissionReviewState,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import {
  commandConflict,
  unauthorizedActor,
} from "../errors/collaboration-command.error";
import {
  autoApproveDeliverableSchema,
  approveDeliverableSchema,
  rejectFinalDeliverableSchema,
  requestDeliverableRevisionSchema,
  submitDeliverableSchema,
} from "../schemas/collaboration-production-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import { resolveProductionHardStopFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { establishNormalSettlementEligibilityFromFinalGate } from "../utils/collaboration-normal-settlement";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

type ProductionRow = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

@Injectable()
export class CollaborationProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  submit(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(submitDeliverableSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "DELIVERABLE_SUBMITTED",
      async (tx, row) => {
        const deliverable = this.deliverable(row, input.deliverableExecutionId);
        if (
          deliverable.state !==
            CollaborationDeliverableState.AWAITING_SUBMISSION &&
          deliverable.state !== CollaborationDeliverableState.REVISION_REQUESTED
        ) {
          commandConflict(
            "INVALID_STATE",
            "Deliverable is not awaiting a submission",
            row.aggregateVersion,
          );
        }
        const previous = deliverable.submissions.at(-1);
        const versionNumber = (previous?.versionNumber ?? 0) + 1;
        const submittedAt = new Date();
        const reviewDeadlineAt = new Date(
          submittedAt.getTime() + 72 * 60 * 60 * 1000,
        );
        if (previous) {
          await tx.collaborationSubmissionVersion.update({
            where: { id: previous.id },
            data: { supersededAt: submittedAt },
          });
        }
        const submission = await tx.collaborationSubmissionVersion.create({
          data: {
            deliverableExecutionId: deliverable.id,
            versionNumber,
            assetRef: input.assetRef,
            creatorNote: input.creatorNote,
            submissionMetadata: input.submissionMetadata as
              Prisma.InputJsonValue | undefined,
            submittedByUserId: user.id,
            submittedAt,
            reviewDeadlineAt,
            reviewState: CollaborationSubmissionReviewState.UNDER_REVIEW,
          },
        });
        await tx.collaborationDeliverableExecution.update({
          where: { id: deliverable.id },
          data: { state: CollaborationDeliverableState.UNDER_REVIEW },
        });
        return {
          eventPayload: {
            deliverableExecutionId: deliverable.id,
            submissionVersionId: submission.id,
            versionNumber,
            reviewDeadlineAt: reviewDeadlineAt.toISOString(),
          },
        };
      },
    );
  }

  approve(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(approveDeliverableSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "DELIVERABLE_APPROVED",
      async (tx, row) => {
        const deliverable = this.reviewTarget(
          row,
          input.deliverableExecutionId,
          input.submissionVersionId,
        );
        const now = new Date();
        await tx.collaborationSubmissionVersion.update({
          where: { id: input.submissionVersionId },
          data: {
            reviewState: CollaborationSubmissionReviewState.APPROVED,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
        });
        await tx.collaborationDeliverableExecution.update({
          where: { id: deliverable.id },
          data: {
            state: CollaborationDeliverableState.APPROVED,
            approvedAt: now,
          },
        });
        if (deliverable.publishingRequired) {
          await tx.collaborationPublishingExecution.update({
            where: { deliverableExecutionId: deliverable.id },
            data: {
              state: CollaborationPublishingState.AWAITING_PUBLISHING,
              authorizationState:
                CollaborationPublicationAuthorizationState.AUTHORIZED,
              authorizedAt: now,
              authorizedByUserId: user.id,
            },
          });
        }
        const allApproved = this.productionCompleteAfterAcceptance(
          row,
          deliverable.id,
        );
        return {
          collaborationData: allApproved
            ? {
                canonicalStage: CollaborationStage.PUBLISHING_SETTLEMENT,
                currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
                currentStage: UceMilestoneStage.STAGE_5_PUBLISHING,
                stageUpdatedAt: now,
              }
            : undefined,
          eventPayload: {
            deliverableExecutionId: deliverable.id,
            submissionVersionId: input.submissionVersionId,
            publicationAuthorized: deliverable.publishingRequired,
            productionComplete: allApproved,
          },
          establishNormalSettlementEligibility:
            allApproved &&
            row.deliverables.every((item) => !item.publishingRequired),
        };
      },
    );
  }

  /** Trusted SYSTEM boundary for a future scheduler/worker adapter. */
  async autoApprove(collaborationId: string, raw: unknown, now = new Date()) {
    const input = parseCommand(autoApproveDeliverableSchema, raw);
    if (input.collaborationId !== collaborationId) {
      commandConflict(
        "INVALID_STATE",
        "Command Collaboration identity does not match the target",
      );
    }
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "DELIVERABLE_AUTO_APPROVED",
          fingerprint,
        )
      ) {
        return { replayed: true };
      }
      const row = await this.load(tx, collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertProduction(row);
      const deliverable = this.reviewTarget(
        row,
        input.deliverableExecutionId,
        input.submissionVersionId,
      );
      const submission = deliverable.submissions.at(-1)!;
      if (now.getTime() < submission.reviewDeadlineAt.getTime()) {
        commandConflict(
          "REVIEW_DEADLINE_NOT_REACHED",
          "Submission review deadline has not been reached",
          row.aggregateVersion,
        );
      }

      await tx.collaborationSubmissionVersion.update({
        where: { id: submission.id },
        data: {
          reviewState: CollaborationSubmissionReviewState.AUTO_APPROVED,
          reviewedByUserId: null,
          reviewedAt: now,
          autoApprovedAt: now,
        },
      });
      await tx.collaborationDeliverableExecution.update({
        where: { id: deliverable.id },
        data: {
          state: CollaborationDeliverableState.AUTO_APPROVED,
          autoApprovedAt: now,
        },
      });

      const productionComplete = this.productionCompleteAfterAcceptance(
        row,
        deliverable.id,
      );
      const finalGateVersion = row.aggregateVersion + 1;
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...(productionComplete
            ? {
                canonicalStage: CollaborationStage.PUBLISHING_SETTLEMENT,
                currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
                currentStage: UceMilestoneStage.STAGE_5_PUBLISHING,
                stageUpdatedAt: now,
              }
            : {}),
        },
      });
      if (updated.count !== 1) {
        commandConflict(
          "STALE_AGGREGATE_VERSION",
          "Collaboration changed while the command was executing",
          row.aggregateVersion,
        );
      }
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "DELIVERABLE_AUTO_APPROVED",
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          deliverableExecutionId: deliverable.id,
          submissionVersionId: submission.id,
          versionNumber: submission.versionNumber,
          reviewDeadlineAt: submission.reviewDeadlineAt.toISOString(),
          autoApprovedAt: now.toISOString(),
          productionComplete,
        },
      });
      if (
        productionComplete &&
        row.deliverables.every((item) => !item.publishingRequired)
      )
        await establishNormalSettlementEligibilityFromFinalGate(tx, {
          collaborationId,
          sourceCommandId: input.commandId,
          expectedAggregateVersion: finalGateVersion,
        });
      return { replayed: false, productionComplete };
    });
    if (!result.replayed) {
      void this.realtime.broadcast(collaborationId, "thread.updated");
    }
    return result;
  }

  requestRevision(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(requestDeliverableRevisionSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "DELIVERABLE_REVISION_REQUESTED",
      async (tx, row) => {
        const deliverable = this.reviewTarget(
          row,
          input.deliverableExecutionId,
          input.submissionVersionId,
        );
        if (deliverable.revisionRequestCount >= 2) {
          commandConflict(
            "INVALID_STATE",
            "The two permitted revision requests are exhausted",
            row.aggregateVersion,
          );
        }
        const now = new Date();
        const revisionRequestCount = deliverable.revisionRequestCount + 1;
        await tx.collaborationSubmissionVersion.update({
          where: { id: input.submissionVersionId },
          data: {
            reviewState: CollaborationSubmissionReviewState.REVISION_REQUESTED,
            brandFeedback: input.brandFeedback,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
        });
        await tx.collaborationDeliverableExecution.update({
          where: { id: deliverable.id },
          data: {
            state: CollaborationDeliverableState.REVISION_REQUESTED,
            revisionRequestCount,
          },
        });
        return {
          eventPayload: {
            deliverableExecutionId: deliverable.id,
            submissionVersionId: input.submissionVersionId,
            revisionRequestCount,
          },
        };
      },
    );
  }

  rejectFinal(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(rejectFinalDeliverableSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "FINAL_DELIVERABLE_REJECTED",
      async (tx, row) => {
        const deliverable = this.reviewTarget(
          row,
          input.deliverableExecutionId,
          input.submissionVersionId,
        );
        if (deliverable.revisionRequestCount !== 2) {
          commandConflict(
            "INVALID_STATE",
            "Final rejection requires both revision requests to be exhausted",
            row.aggregateVersion,
          );
        }
        const agreement = row.commercialAgreement;
        if (!agreement) {
          commandConflict(
            "INVALID_STATE",
            "Locked commercial terms are missing",
            row.aggregateVersion,
          );
        }
        const resolution = resolveProductionHardStopFinancialOutcome(agreement);
        const now = new Date();
        await tx.collaborationSubmissionVersion.update({
          where: { id: input.submissionVersionId },
          data: {
            reviewState: CollaborationSubmissionReviewState.FINAL_REJECTED,
            brandFeedback: input.brandFeedback,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
        });
        await tx.collaborationDeliverableExecution.update({
          where: { id: deliverable.id },
          data: {
            state: CollaborationDeliverableState.HARD_STOP,
            hardStoppedAt: now,
          },
        });
        await tx.collaborationFinancialResolution.upsert({
          where: { collaborationId },
          create: {
            collaborationId,
            ...resolution,
            decidedAt: now,
            resolvedAt: now,
          },
          update: { ...resolution, decidedAt: now, resolvedAt: now },
        });
        return {
          collaborationData: {
            lifecycle: CollaborationLifecycle.TERMINATED,
            currentStageStatus: CollaborationStageStatus.BLOCKED,
            endedFromStage: CollaborationStage.PRODUCTION,
            endedReasonCode: "PRODUCTION_HARD_STOP",
            endedByActorClass: CollaborationActorClass.SYSTEM,
            endedByUserId: null,
            endedAt: now,
          },
          eventPayload: {
            deliverableExecutionId: deliverable.id,
            submissionVersionId: input.submissionVersionId,
            financialOutcome: resolution.outcome,
            creatorGrossEntitlementAmount:
              resolution.creatorGrossEntitlementAmount.toString(),
            brandCommercialRefundEntitlementAmount:
              resolution.brandCommercialRefundEntitlementAmount.toString(),
          },
        };
      },
    );
  }

  private async execute(
    user: AuthUser,
    collaborationId: string,
    input: { commandId: string; expectedAggregateVersion: number },
    eventType: string,
    transition: (
      tx: Prisma.TransactionClient,
      row: ProductionRow,
    ) => Promise<{
      collaborationData?: Prisma.CollaborationUpdateManyMutationInput;
      eventPayload?: Record<string, unknown>;
      establishNormalSettlementEligibility?: boolean;
    }>,
  ) {
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);
    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          eventType,
          fingerprint,
        )
      )
        return;
      const row = await this.load(tx, collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertProduction(row);
      const result = await transition(tx, row);
      const finalGateVersion = row.aggregateVersion + 1;
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...result.collaborationData,
        },
      });
      if (updated.count !== 1) {
        commandConflict(
          "STALE_AGGREGATE_VERSION",
          "Collaboration changed while the command was executing",
          row.aggregateVersion,
        );
      }
      await appendCommandEvent(tx, {
        collaborationId,
        eventType,
        actorClass:
          user.role === UserRole.BRAND
            ? CollaborationActorClass.BRAND
            : CollaborationActorClass.CREATOR,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: result.eventPayload,
      });
      if (result.establishNormalSettlementEligibility)
        await establishNormalSettlementEligibilityFromFinalGate(tx, {
          collaborationId,
          sourceCommandId: input.commandId,
          expectedAggregateVersion: finalGateVersion,
        });
    });
    void this.realtime.broadcast(collaborationId, "thread.updated");
    return this.result(user, collaborationId);
  }

  private assertProduction(row: ProductionRow) {
    if (
      !row.sourceApplicationId ||
      row.lifecycle !== CollaborationLifecycle.ACTIVE
    ) {
      commandConflict(
        "INVALID_STATE",
        "Canonical active Collaboration required",
        row.aggregateVersion,
      );
    }
    if (row.canonicalStage !== CollaborationStage.PRODUCTION) {
      commandConflict(
        "INVALID_STAGE",
        "Collaboration is not in Production",
        row.aggregateVersion,
      );
    }
  }

  private deliverable(row: ProductionRow, deliverableExecutionId: string) {
    const deliverable = row.deliverables.find(
      (item) => item.id === deliverableExecutionId,
    );
    if (!deliverable) {
      commandConflict(
        "INVALID_STATE",
        "Deliverable does not belong to this Collaboration",
        row.aggregateVersion,
      );
    }
    return deliverable;
  }

  private reviewTarget(
    row: ProductionRow,
    deliverableExecutionId: string,
    submissionVersionId: string,
  ) {
    const deliverable = this.deliverable(row, deliverableExecutionId);
    if (deliverable.state !== CollaborationDeliverableState.UNDER_REVIEW) {
      commandConflict(
        "INVALID_STATE",
        "Deliverable is not under review",
        row.aggregateVersion,
      );
    }
    const active = deliverable.submissions.at(-1);
    if (
      !active ||
      active.id !== submissionVersionId ||
      active.deliverableExecutionId !== deliverableExecutionId ||
      active.reviewState !== CollaborationSubmissionReviewState.UNDER_REVIEW
    ) {
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Submission is not the active exact review version",
        row.aggregateVersion,
      );
    }
    return deliverable;
  }

  private productionCompleteAfterAcceptance(
    row: ProductionRow,
    acceptedDeliverableId: string,
  ) {
    return row.deliverables.every(
      (item) =>
        item.id === acceptedDeliverableId ||
        item.state === CollaborationDeliverableState.APPROVED ||
        item.state === CollaborationDeliverableState.AUTO_APPROVED,
    );
  }

  private assertRole(user: AuthUser, role: UserRole) {
    if (user.role !== role) unauthorizedActor(`${role} access required`);
  }

  private load(tx: Prisma.TransactionClient, collaborationId: string) {
    return tx.collaboration.findUniqueOrThrow({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
  }

  private async result(user: AuthUser, collaborationId: string) {
    const row = await this.access.assertThreadForUser(user, collaborationId);
    return projectCanonicalCollaborationDetail(
      row,
      user.role === UserRole.BRAND ? "BRAND" : "CREATOR",
    );
  }
}
