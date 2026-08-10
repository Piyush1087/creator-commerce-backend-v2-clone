import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationResolutionStatus,
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
  applyAdminResolutionSchema,
  cancelCollaborationByCreatorSchema,
  endCollaborationByBrandSchema,
  endForCreatorNonPerformanceSchema,
  endForCreatorPublishingNonPerformanceSchema,
} from "../schemas/collaboration-exception-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import {
  type DeterministicExceptionAction,
  resolveDeterministicExceptionPolicy,
  validateAdminEconomicAllocation,
} from "../utils/collaboration-exception.policy";
import { resolveFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

type ExceptionRow = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

@Injectable()
export class CollaborationExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  endByBrand(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(endCollaborationByBrandSchema, raw);
    return this.executeUser(
      user,
      collaborationId,
      input,
      "COLLABORATION_ENDED_BY_BRAND",
      "BRAND_END",
    );
  }

  cancelByCreator(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(cancelCollaborationByCreatorSchema, raw);
    return this.executeUser(
      user,
      collaborationId,
      input,
      "COLLABORATION_CANCELLED_BY_CREATOR",
      "CREATOR_CANCEL",
    );
  }

  endForCreatorNonPerformance(raw: unknown) {
    const input = parseCommand(endForCreatorNonPerformanceSchema, raw);
    return this.executeTrusted(
      input,
      "CREATOR_NON_PERFORMANCE_ESTABLISHED",
      "CREATOR_NON_PERFORMANCE",
      CollaborationActorClass.SYSTEM,
    );
  }

  endForCreatorPublishingNonPerformance(raw: unknown) {
    const input = parseCommand(
      endForCreatorPublishingNonPerformanceSchema,
      raw,
    );
    return this.executeTrusted(
      input,
      "CREATOR_PUBLISHING_NON_PERFORMANCE_ESTABLISHED",
      "CREATOR_PUBLISHING_NON_PERFORMANCE",
      CollaborationActorClass.SYSTEM,
    );
  }

  /** Trusted ADMIN exception boundary; deliberately not exposed to ordinary HTTP clients. */
  async applyAdminResolution(adminUserId: string, raw: unknown) {
    const input = parseCommand(applyAdminResolutionSchema, raw);
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          "ADMIN_RESOLUTION_APPLIED",
          fingerprint,
        )
      )
        return { replayed: true };
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertAdminResolvable(row);
      const agreement = this.completeTerms(row);
      if (input.currency !== agreement.currency) {
        commandConflict(
          "INVALID_STATE",
          "Admin resolution currency must match locked commercial currency",
          row.aggregateVersion,
        );
      }
      const creatorEntitlement = new Prisma.Decimal(
        input.creatorEntitlementAmount,
      );
      const explicitBrandCommercialRefund = new Prisma.Decimal(
        input.brandRefundEntitlementAmount,
      );
      const resolution = resolveFinancialOutcome(
        agreement,
        creatorEntitlement,
        CollaborationFinancialOutcome.ADMIN_RESOLUTION,
        input.reasonCode,
      );
      validateAdminEconomicAllocation({
        agreedCreatorFee: agreement.agreedCreatorFee,
        creatorEntitlementAmount: creatorEntitlement,
        brandRefundEntitlementAmount: explicitBrandCommercialRefund,
        derivedBrandCommercialRefundEntitlementAmount:
          resolution.brandCommercialRefundEntitlementAmount,
        aggregateVersion: row.aggregateVersion,
      });
      const now = new Date();
      const adminResolution = {
        ...resolution,
        reasonText: input.reasonText,
        resolutionEvidence: input.resolutionEvidence as
          Prisma.InputJsonValue | undefined,
        residualObligations: input.residualObligations as
          Prisma.InputJsonValue | undefined,
        decidedByActorClass: CollaborationActorClass.ADMIN,
        decidedByUserId: adminUserId,
        decidedAt: now,
        resolvedAt: now,
      };
      await tx.collaborationFinancialResolution.upsert({
        where: { collaborationId: row.id },
        create: {
          collaborationId: row.id,
          ...adminResolution,
        },
        update: adminResolution,
      });
      await this.persistTerminal(tx, row, {
        lifecycle: CollaborationLifecycle.TERMINATED,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        actorClass: CollaborationActorClass.ADMIN,
        actorUserId: adminUserId,
        now,
      });
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType: "ADMIN_RESOLUTION_APPLIED",
        actorClass: CollaborationActorClass.ADMIN,
        actorUserId: adminUserId,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          reasonCode: input.reasonCode,
          creatorGrossEntitlementAmount: creatorEntitlement.toString(),
          brandRefundEntitlementAmount:
            explicitBrandCommercialRefund.toString(),
          brandCommercialRefundEntitlementAmount:
            resolution.brandCommercialRefundEntitlementAmount.toString(),
          residualObligations: input.residualObligations,
        },
      });
      return { replayed: false };
    });
    if (!result.replayed)
      void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  private async executeUser(
    user: AuthUser,
    collaborationId: string,
    input: {
      commandId: string;
      expectedAggregateVersion: number;
      reasonText?: string;
      evidenceRef?: string;
    },
    eventType: string,
    action: DeterministicExceptionAction,
  ) {
    await this.access.assertThreadForUser(user, collaborationId);
    await this.executeDeterministic(
      collaborationId,
      input,
      eventType,
      action,
      user.role === UserRole.BRAND
        ? CollaborationActorClass.BRAND
        : CollaborationActorClass.CREATOR,
      user.id,
    );
    return this.result(user, collaborationId);
  }

  private executeTrusted(
    input: {
      collaborationId: string;
      commandId: string;
      expectedAggregateVersion: number;
      evidenceRef?: string;
    },
    eventType: string,
    action: DeterministicExceptionAction,
    actorClass: "SYSTEM" | "ADMIN",
  ) {
    return this.executeDeterministic(
      input.collaborationId,
      input,
      eventType,
      action,
      actorClass,
      undefined,
    );
  }

  private async executeDeterministic(
    collaborationId: string,
    input: {
      commandId: string;
      expectedAggregateVersion: number;
      reasonText?: string;
      evidenceRef?: string;
    },
    eventType: string,
    action: DeterministicExceptionAction,
    actorClass: CollaborationActorClass,
    actorUserId?: string,
  ) {
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          eventType,
          fingerprint,
        )
      )
        return { replayed: true };
      const row = await this.load(tx, collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertNormallyEndable(row);
      const policy = resolveDeterministicExceptionPolicy(row, action);
      const resolution = this.deterministicResolution(row, policy);
      const now = new Date();
      await tx.collaborationFinancialResolution.upsert({
        where: { collaborationId },
        create: {
          collaborationId,
          ...resolution,
          reasonText: input.reasonText,
          resolutionEvidence: input.evidenceRef
            ? ({ evidenceRef: input.evidenceRef } as Prisma.InputJsonValue)
            : undefined,
          decidedAt: now,
          resolvedAt: now,
        },
        update: {},
      });
      await this.persistTerminal(tx, row, {
        lifecycle: policy.lifecycle,
        reasonCode: policy.endedReasonCode,
        reasonText: input.reasonText,
        actorClass,
        actorUserId,
        now,
      });
      await appendCommandEvent(tx, {
        collaborationId,
        eventType,
        actorClass,
        actorUserId,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          reasonCode: policy.endedReasonCode,
          financialOutcome: policy.financialOutcome,
          creatorGrossEntitlementAmount:
            resolution.creatorGrossEntitlementAmount.toString(),
          brandCommercialRefundEntitlementAmount:
            resolution.brandCommercialRefundEntitlementAmount.toString(),
          evidenceRef: input.evidenceRef,
        },
      });
      return { replayed: false };
    });
    if (!result.replayed)
      void this.realtime.broadcast(collaborationId, "thread.updated");
    return result;
  }

  private deterministicResolution(
    row: ExceptionRow,
    policy: ReturnType<typeof resolveDeterministicExceptionPolicy>,
  ) {
    const agreement = row.commercialAgreement;
    if (!agreement?.agreedCreatorFee) {
      if (
        policy.financialOutcome !==
        CollaborationFinancialOutcome.PRE_SECUREMENT_EXIT
      )
        commandConflict(
          "INVALID_STATE",
          "Locked commercial terms are required for this exception outcome",
          row.aggregateVersion,
        );
      const zero = new Prisma.Decimal(0);
      return {
        status: CollaborationResolutionStatus.RESOLVED,
        outcome: policy.financialOutcome,
        creatorEntitlementAmount: zero,
        brandRefundEntitlementAmount: zero,
        creatorGrossEntitlementAmount: zero,
        creatorCommercialRefundAmount: zero,
        platformCommissionRetainedAmount: zero,
        platformCommissionRefundAmount: zero,
        platformCommissionGstRetainedAmount: zero,
        platformCommissionGstRefundAmount: zero,
        brandCommercialRefundEntitlementAmount: zero,
        currency: agreement?.currency ?? row.snapshot?.commercialCurrency,
        reasonCode: policy.endedReasonCode,
        decidedByActorClass: CollaborationActorClass.SYSTEM,
      };
    }
    const terms = this.completeTerms(row);
    const creatorEntitlement =
      policy.entitlement === "ADVANCE"
        ? terms.advanceAmount
        : new Prisma.Decimal(0);
    return resolveFinancialOutcome(
      terms,
      creatorEntitlement,
      policy.financialOutcome,
      policy.endedReasonCode,
    );
  }

  private async persistTerminal(
    tx: Prisma.TransactionClient,
    row: ExceptionRow,
    input: {
      lifecycle: CollaborationLifecycle;
      reasonCode: string;
      reasonText?: string;
      actorClass: CollaborationActorClass;
      actorUserId?: string;
      now: Date;
    },
  ) {
    const updated = await tx.collaboration.updateMany({
      where: {
        id: row.id,
        aggregateVersion: row.aggregateVersion,
        lifecycle: CollaborationLifecycle.ACTIVE,
      },
      data: {
        lifecycle: input.lifecycle,
        currentStageStatus: CollaborationStageStatus.BLOCKED,
        aggregateVersion: { increment: 1 },
        endedFromStage: row.canonicalStage,
        endedReasonCode: input.reasonCode,
        endedReasonText: input.reasonText,
        endedByActorClass: input.actorClass,
        endedByUserId: input.actorUserId,
        endedAt: input.now,
      },
    });
    if (updated.count !== 1)
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Collaboration changed while the terminal command was executing",
        row.aggregateVersion,
      );
  }

  private assertNormallyEndable(row: ExceptionRow) {
    this.assertCanonicalActive(row);
    if (row.financialResolution) {
      commandConflict(
        "INVALID_STATE",
        "Existing financial resolution requires the Admin exception path",
        row.aggregateVersion,
      );
    }
    if (
      row.currentStageStatus === CollaborationStageStatus.BLOCKED ||
      row.commercialAgreement?.securementState === "PAYMENT_DISPUTED" ||
      row.deliverables.some((item) => item.publishing?.state === "BLOCKED")
    ) {
      commandConflict(
        "INVALID_STATE",
        "Blocked Collaboration requires Admin resolution",
        row.aggregateVersion,
      );
    }
  }

  private assertAdminResolvable(row: ExceptionRow) {
    this.assertCanonicalActive(row);
    if (
      row.financialResolution?.status === CollaborationResolutionStatus.RESOLVED
    ) {
      commandConflict(
        "INVALID_STATE",
        "Resolved financial resolution cannot be overwritten",
        row.aggregateVersion,
      );
    }
    const blocked =
      row.currentStageStatus === CollaborationStageStatus.BLOCKED ||
      row.commercialAgreement?.securementState === "PAYMENT_DISPUTED" ||
      row.deliverables.some((item) => item.publishing?.state === "BLOCKED");
    if (!blocked)
      commandConflict(
        "INVALID_STATE",
        "Admin resolution is limited to blocked or disputed Collaborations",
        row.aggregateVersion,
      );
  }

  private assertCanonicalActive(row: ExceptionRow) {
    if (
      !row.sourceApplicationId ||
      row.lifecycle !== CollaborationLifecycle.ACTIVE
    )
      commandConflict(
        "INVALID_STATE",
        "Canonical active Collaboration required",
        row.aggregateVersion,
      );
    if (
      row.financialResolution?.status === CollaborationResolutionStatus.RESOLVED
    )
      commandConflict(
        "INVALID_STATE",
        "Existing resolved terminal outcome cannot be overwritten",
        row.aggregateVersion,
      );
  }

  private completeTerms(row: ExceptionRow) {
    const terms = row.commercialAgreement;
    if (
      !terms?.agreedCreatorFee ||
      terms.advanceAmount === null ||
      terms.platformCommissionRateSnapshot === null ||
      terms.platformCommissionAmount === null ||
      terms.platformCommissionGstRateSnapshot === null ||
      terms.platformCommissionGstAmount === null
    )
      commandConflict(
        "INVALID_STATE",
        "Complete locked commercial terms are required",
        row.aggregateVersion,
      );
    return {
      agreedCreatorFee: terms.agreedCreatorFee,
      advanceAmount: terms.advanceAmount,
      currency: terms.currency,
      platformCommissionRateSnapshot: terms.platformCommissionRateSnapshot,
      platformCommissionAmount: terms.platformCommissionAmount,
      platformCommissionGstRateSnapshot:
        terms.platformCommissionGstRateSnapshot,
      platformCommissionGstAmount: terms.platformCommissionGstAmount,
    };
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
