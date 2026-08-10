import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationLifecycle,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import {
  commandConflict,
  unauthorizedActor,
} from "../errors/collaboration-command.error";
import {
  authorizePublishingSchema,
  blockPublishingComplianceSchema,
  declinePublishingSchema,
  requestPublishingCorrectionSchema,
  submitCorrectedPublishingEvidenceSchema,
  submitPublishingEvidenceSchema,
  verifyPublishingSchema,
} from "../schemas/collaboration-publishing-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import { resolveBrandDeclinedPublicationFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

type PublishingRow = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

@Injectable()
export class CollaborationPublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  authorize(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(authorizePublishingSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "PUBLISHING_AUTHORIZED",
      async (tx, row) => {
        const target = this.target(row, input.deliverableExecutionId);
        this.assertAwaitingAuthorization(target, row.aggregateVersion);
        const now = new Date();
        await tx.collaborationPublishingExecution.update({
          where: { id: target.publishing!.id },
          data: {
            authorizationState:
              CollaborationPublicationAuthorizationState.AUTHORIZED,
            state: CollaborationPublishingState.AWAITING_PUBLISHING,
            authorizedAt: now,
            authorizedByUserId: user.id,
          },
        });
        return {
          payload: {
            deliverableExecutionId: target.id,
            authorizedAt: now.toISOString(),
          },
        };
      },
    );
  }

  decline(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(declinePublishingSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "PUBLISHING_DECLINED",
      async (tx, row) => {
        const target = this.target(row, input.deliverableExecutionId);
        this.assertAwaitingAuthorization(target, row.aggregateVersion);
        if (!row.commercialAgreement) {
          commandConflict(
            "INVALID_STATE",
            "Locked commercial terms are missing",
            row.aggregateVersion,
          );
        }
        const resolution = resolveBrandDeclinedPublicationFinancialOutcome(
          row.commercialAgreement,
        );
        const now = new Date();
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
            endedFromStage: CollaborationStage.PUBLISHING_SETTLEMENT,
            endedReasonCode: "BRAND_DECLINED_PUBLICATION",
            endedByActorClass: CollaborationActorClass.BRAND,
            endedByUserId: user.id,
            endedAt: now,
          },
          payload: {
            deliverableExecutionId: target.id,
            reasonCode: "BRAND_DECLINED_PUBLICATION",
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

  submitEvidence(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(submitPublishingEvidenceSchema, raw);
    return this.appendEvidence(user, collaborationId, input, false);
  }

  submitCorrectedEvidence(
    user: AuthUser,
    collaborationId: string,
    raw: unknown,
  ) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(submitCorrectedPublishingEvidenceSchema, raw);
    return this.appendEvidence(user, collaborationId, input, true);
  }

  verify(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(verifyPublishingSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "PUBLISHING_VERIFIED",
      async (tx, row) => {
        const target = this.target(row, input.deliverableExecutionId);
        const evidence = this.activeEvidence(
          target,
          input.publishingEvidenceId,
          row.aggregateVersion,
        );
        if (
          target.publishing!.state !==
          CollaborationPublishingState.EVIDENCE_SUBMITTED
        ) {
          commandConflict(
            "INVALID_STATE",
            "Publishing evidence is not awaiting verification",
            row.aggregateVersion,
          );
        }
        const now = new Date();
        await tx.collaborationPublishingEvidence.update({
          where: { id: evidence.id },
          data: {
            reviewedByUserId: user.id,
            reviewedAt: now,
            verifiedAt: now,
            complianceEvidenceRef: input.complianceEvidenceRef,
          },
        });
        await tx.collaborationPublishingExecution.update({
          where: { id: target.publishing!.id },
          data: {
            state: CollaborationPublishingState.COMPLIANCE_VERIFIED,
            complianceVerifiedAt: now,
            blockedReason: null,
          },
        });
        const publishingComplete = this.publishingCompleteAfterVerification(
          row,
          target.id,
        );
        return {
          payload: {
            deliverableExecutionId: target.id,
            publishingEvidenceId: evidence.id,
            verifiedAt: now.toISOString(),
            publishingComplete,
            settlementEligible: publishingComplete,
          },
        };
      },
    );
  }

  requestCorrection(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(requestPublishingCorrectionSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "PUBLISHING_CORRECTION_REQUESTED",
      async (tx, row) => {
        const target = this.target(row, input.deliverableExecutionId);
        const evidence = this.activeEvidence(
          target,
          input.publishingEvidenceId,
          row.aggregateVersion,
        );
        if (
          target.publishing!.state !==
          CollaborationPublishingState.EVIDENCE_SUBMITTED
        ) {
          commandConflict(
            "INVALID_STATE",
            "Publishing evidence is not awaiting review",
            row.aggregateVersion,
          );
        }
        const now = new Date();
        await tx.collaborationPublishingEvidence.update({
          where: { id: evidence.id },
          data: {
            correctionReason: input.correctionReason,
            reviewedByUserId: user.id,
            reviewedAt: now,
          },
        });
        await tx.collaborationPublishingExecution.update({
          where: { id: target.publishing!.id },
          data: { state: CollaborationPublishingState.CORRECTION_REQUIRED },
        });
        return {
          payload: {
            deliverableExecutionId: target.id,
            publishingEvidenceId: evidence.id,
            correctionReason: input.correctionReason,
          },
        };
      },
    );
  }

  /** Trusted SYSTEM/ADMIN boundary; deliberately not exposed by the HTTP controller. */
  async blockCompliance(
    raw: unknown,
    actorClass: "SYSTEM" | "ADMIN" = CollaborationActorClass.SYSTEM,
    actorUserId?: string,
  ) {
    const input = parseCommand(blockPublishingComplianceSchema, raw);
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          "PUBLISHING_COMPLIANCE_BLOCKED",
          fingerprint,
        )
      ) {
        return { replayed: true };
      }
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertPublishing(row);
      const target = this.target(row, input.deliverableExecutionId);
      if (
        !target.publishing ||
        target.publishing.state ===
          CollaborationPublishingState.PUBLISHING_NOT_REQUIRED ||
        target.publishing.state ===
          CollaborationPublishingState.COMPLIANCE_VERIFIED
      ) {
        commandConflict(
          "INVALID_STATE",
          "Publishing compliance is not applicable",
          row.aggregateVersion,
        );
      }
      await tx.collaborationPublishingExecution.update({
        where: { id: target.publishing.id },
        data: {
          state: CollaborationPublishingState.BLOCKED,
          blockedReason: input.blockedReason,
        },
      });
      const updated = await tx.collaboration.updateMany({
        where: { id: row.id, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          currentStageStatus: CollaborationStageStatus.BLOCKED,
        },
      });
      this.assertUpdated(updated.count, row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType: "PUBLISHING_COMPLIANCE_BLOCKED",
        actorClass,
        actorUserId,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          deliverableExecutionId: target.id,
          blockedReason: input.blockedReason,
          evidenceRef: input.evidenceRef,
        },
      });
      return { replayed: false };
    });
    if (!result.replayed)
      void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  private appendEvidence(
    user: AuthUser,
    collaborationId: string,
    input: ReturnType<typeof submitPublishingEvidenceSchema.parse>,
    corrected: boolean,
  ) {
    const eventType = corrected
      ? "PUBLISHING_EVIDENCE_CORRECTED"
      : "PUBLISHING_EVIDENCE_SUBMITTED";
    return this.execute(
      user,
      collaborationId,
      input,
      eventType,
      async (tx, row) => {
        const target = this.target(row, input.deliverableExecutionId);
        const expectedState = corrected
          ? CollaborationPublishingState.CORRECTION_REQUIRED
          : CollaborationPublishingState.AWAITING_PUBLISHING;
        if (
          !target.publishingRequired ||
          target.publishing?.authorizationState !==
            CollaborationPublicationAuthorizationState.AUTHORIZED ||
          target.publishing.state !== expectedState
        ) {
          commandConflict(
            "INVALID_STATE",
            "Publishing evidence is not currently accepted",
            row.aggregateVersion,
          );
        }
        const sequence =
          (target.publishing.evidenceHistory.at(-1)?.sequence ?? 0) + 1;
        const submittedAt = new Date();
        const evidence = await tx.collaborationPublishingEvidence.create({
          data: {
            publishingExecutionId: target.publishing.id,
            sequence,
            evidenceRef: input.evidenceRef,
            platform: input.platform,
            creatorNote: input.creatorNote,
            evidenceMetadata: input.evidenceMetadata as
              Prisma.InputJsonValue | undefined,
            submittedByUserId: user.id,
            submittedAt,
          },
        });
        await tx.collaborationPublishingExecution.update({
          where: { id: target.publishing.id },
          data: {
            state: CollaborationPublishingState.EVIDENCE_SUBMITTED,
            blockedReason: null,
          },
        });
        return {
          payload: {
            deliverableExecutionId: target.id,
            publishingEvidenceId: evidence.id,
            sequence,
            submittedAt: submittedAt.toISOString(),
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
      row: PublishingRow,
    ) => Promise<{
      collaborationData?: Prisma.CollaborationUpdateManyMutationInput;
      payload?: Record<string, unknown>;
    }>,
  ) {
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);
    let replayed = false;
    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          eventType,
          fingerprint,
        )
      ) {
        replayed = true;
        return;
      }
      const row = await this.load(tx, collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertPublishing(row);
      const result = await transition(tx, row);
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...result.collaborationData,
        },
      });
      this.assertUpdated(updated.count, row.aggregateVersion);
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
        payload: result.payload,
      });
    });
    if (!replayed)
      void this.realtime.broadcast(collaborationId, "thread.updated");
    return this.result(user, collaborationId);
  }

  private assertPublishing(row: PublishingRow) {
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
    if (row.canonicalStage !== CollaborationStage.PUBLISHING_SETTLEMENT) {
      commandConflict(
        "INVALID_STAGE",
        "Collaboration is not in Publishing/Settlement",
        row.aggregateVersion,
      );
    }
    if (
      row.currentStageStatus === CollaborationStageStatus.BLOCKED ||
      row.financialResolution?.outcome
    ) {
      commandConflict(
        "INVALID_STATE",
        "Collaboration Publishing is blocked or resolved",
        row.aggregateVersion,
      );
    }
  }

  private target(row: PublishingRow, deliverableExecutionId: string) {
    const target = row.deliverables.find(
      (item) => item.id === deliverableExecutionId,
    );
    if (!target)
      commandConflict(
        "INVALID_STATE",
        "Deliverable does not belong to this Collaboration",
        row.aggregateVersion,
      );
    if (!target.publishing)
      commandConflict(
        "INVALID_STATE",
        "Publishing execution is missing",
        row.aggregateVersion,
      );
    return target;
  }

  private assertAwaitingAuthorization(
    target: PublishingRow["deliverables"][number],
    aggregateVersion: number,
  ) {
    if (
      target.state !== CollaborationDeliverableState.AUTO_APPROVED ||
      !target.publishingRequired ||
      target.publishing?.authorizationState !==
        CollaborationPublicationAuthorizationState.NOT_AUTHORIZED
    ) {
      commandConflict(
        "INVALID_STATE",
        "Deliverable is not awaiting Brand publication authorization",
        aggregateVersion,
      );
    }
  }

  private activeEvidence(
    target: PublishingRow["deliverables"][number],
    publishingEvidenceId: string,
    aggregateVersion: number,
  ) {
    const evidence = target.publishing?.evidenceHistory.at(-1);
    if (!evidence || evidence.id !== publishingEvidenceId) {
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Publishing evidence is not the exact active evidence",
        aggregateVersion,
      );
    }
    return evidence;
  }

  private publishingCompleteAfterVerification(
    row: PublishingRow,
    verifiedDeliverableId: string,
  ) {
    return row.deliverables.every(
      (item) =>
        (!item.publishingRequired &&
          item.publishing?.state ===
            CollaborationPublishingState.PUBLISHING_NOT_REQUIRED) ||
        (item.publishingRequired &&
          (item.id === verifiedDeliverableId ||
            item.publishing?.state ===
              CollaborationPublishingState.COMPLIANCE_VERIFIED)),
    );
  }

  private assertUpdated(count: number, aggregateVersion: number) {
    if (count !== 1)
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Collaboration changed while the command was executing",
        aggregateVersion,
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
