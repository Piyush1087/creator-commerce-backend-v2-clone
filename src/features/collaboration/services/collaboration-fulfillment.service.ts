import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationFulfillmentState,
  CollaborationLifecycle,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceBrandSupportType,
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
  confirmFulfillmentSchema,
  provideFulfillmentRemediationSchema,
  provideFulfillmentSchema,
  reportFulfillmentIssueSchema,
  type ProvideFulfillmentInput,
} from "../schemas/collaboration-fulfillment-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import { resolveFulfillmentHardStopFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

@Injectable()
export class CollaborationFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  provide(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(provideFulfillmentSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "FULFILLMENT_PROVIDED",
      async (tx, row) => {
        this.assertFulfillment(
          row,
          CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT,
        );
        this.assertEvidence(
          row.snapshot!.brandSupportType!,
          input,
          row.aggregateVersion,
        );
        const now = new Date();
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: {
            shipmentTrackingRef: input.shipmentTrackingRef,
            courierName: input.courierName,
            accessEvidenceRef: input.accessEvidenceRef,
            redemptionCode: input.redemptionCode,
            serviceEvidenceRef: input.serviceEvidenceRef,
            genericFulfillmentEvidence: input.genericFulfillmentEvidence as
              Prisma.InputJsonValue | undefined,
            brandFulfilledAt: now,
            state: CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION,
          },
        });
        return {
          eventPayload: { brandSupportType: row.snapshot!.brandSupportType },
        };
      },
    );
  }

  confirm(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(confirmFulfillmentSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "FULFILLMENT_CONFIRMED",
      async (tx, row) => {
        this.assertFulfillment(
          row,
          CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION,
        );
        const now = new Date();
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: {
            state: CollaborationFulfillmentState.COMPLETED,
            creatorConfirmedAt: now,
            completedAt: now,
          },
        });
        return {
          collaborationData: {
            canonicalStage: CollaborationStage.PRODUCTION,
            currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
            currentStage: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
            stageUpdatedAt: now,
          },
        };
      },
    );
  }

  reportIssue(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(reportFulfillmentIssueSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "FULFILLMENT_ISSUE_REPORTED",
      async (tx, row) => {
        this.assertFulfillment(
          row,
          CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION,
        );
        const fulfillment = row.fulfillment!;
        const sequence = fulfillment.issueCount + 1;
        if (sequence > 2) {
          commandConflict(
            "INVALID_STATE",
            "No further normal Fulfillment issue is available",
            row.aggregateVersion,
          );
        }
        const now = new Date();
        await tx.collaborationFulfillmentIssue.create({
          data: {
            fulfillmentId: fulfillment.id,
            sequence,
            issueCode: input.issueCode,
            description: input.description,
            evidenceRef: input.evidenceRef,
            reportedByUserId: user.id,
            reportedAt: now,
          },
        });

        if (sequence === 1) {
          await tx.collaborationFulfillment.update({
            where: { collaborationId },
            data: {
              issueCount: 1,
              state: CollaborationFulfillmentState.REMEDIATION_REQUIRED,
            },
          });
          return { eventPayload: { sequence, issueCode: input.issueCode } };
        }

        const agreement = row.commercialAgreement;
        if (!agreement) {
          commandConflict(
            "INVALID_STATE",
            "Locked commercial terms are missing",
            row.aggregateVersion,
          );
        }
        const resolution =
          resolveFulfillmentHardStopFinancialOutcome(agreement);
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: {
            issueCount: 2,
            state: CollaborationFulfillmentState.HARD_STOP,
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
            endedFromStage: CollaborationStage.FULFILLMENT,
            endedReasonCode: "FULFILLMENT_HARD_STOP",
            endedByActorClass: CollaborationActorClass.SYSTEM,
            endedByUserId: null,
            endedAt: now,
          },
          eventPayload: {
            sequence,
            issueCode: input.issueCode,
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

  remediate(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(provideFulfillmentRemediationSchema, raw);
    return this.execute(
      user,
      collaborationId,
      input,
      "FULFILLMENT_REMEDIATED",
      async (tx, row) => {
        this.assertFulfillment(
          row,
          CollaborationFulfillmentState.REMEDIATION_REQUIRED,
        );
        const fulfillment = row.fulfillment!;
        const now = new Date();
        await tx.collaborationFulfillmentIssue.update({
          where: {
            fulfillmentId_sequence: {
              fulfillmentId: fulfillment.id,
              sequence: fulfillment.issueCount,
            },
          },
          data: {
            remediationEvidenceRef: input.remediationEvidenceRef,
            remediationAt: now,
          },
        });
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: {
            state: CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION,
          },
        });
        return { eventPayload: { sequence: fulfillment.issueCount } };
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
      row: Awaited<ReturnType<CollaborationFulfillmentService["load"]>>,
    ) => Promise<{
      collaborationData?: Prisma.CollaborationUpdateManyMutationInput;
      eventPayload?: Record<string, unknown>;
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
      const transitionResult = await transition(tx, row);
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...transitionResult.collaborationData,
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
        payload: transitionResult.eventPayload,
      });
    });
    void this.realtime.broadcast(collaborationId, "thread.updated");
    return this.result(user, collaborationId);
  }

  private assertFulfillment(
    row: Awaited<ReturnType<CollaborationFulfillmentService["load"]>>,
    expectedState: CollaborationFulfillmentState,
  ) {
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
    if (row.canonicalStage !== CollaborationStage.FULFILLMENT) {
      commandConflict(
        "INVALID_STAGE",
        "Collaboration is not in Fulfillment",
        row.aggregateVersion,
      );
    }
    if (!row.snapshot?.receivesBrandSupport || !row.snapshot.brandSupportType) {
      commandConflict(
        "INVALID_STATE",
        "Locked Brand Support does not require Fulfillment",
        row.aggregateVersion,
      );
    }
    if (!row.fulfillment || row.fulfillment.state !== expectedState) {
      commandConflict(
        "INVALID_STATE",
        `Fulfillment must be ${expectedState}`,
        row.aggregateVersion,
      );
    }
  }

  private assertEvidence(
    supportType: UceBrandSupportType,
    input: ProvideFulfillmentInput,
    aggregateVersion: number,
  ) {
    const generic = input.genericFulfillmentEvidence;
    const valid =
      supportType === UceBrandSupportType.PRODUCT
        ? Boolean(input.shipmentTrackingRef || generic)
        : supportType === UceBrandSupportType.ACCESS_SUBSCRIPTION
          ? Boolean(input.accessEvidenceRef || input.redemptionCode)
          : supportType === UceBrandSupportType.SERVICE ||
              supportType === UceBrandSupportType.EXPERIENCE
            ? Boolean(input.serviceEvidenceRef)
            : Boolean(generic);
    if (!valid) {
      commandConflict(
        "INVALID_STATE",
        `Fulfillment evidence does not match ${supportType}`,
        aggregateVersion,
      );
    }
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
