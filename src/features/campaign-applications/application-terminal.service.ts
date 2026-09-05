import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ApprovedApplicationCollaborationPort } from "./approved-application-collaboration.port";
import { NotificationDispatchService } from "../notifications/services/notification-dispatch.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { lockBrandTeam } from "../brand-settings/team/brand-team-policy";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { lockCreatorTeam } from "../creator-settings/team/creator-team.policy";
import {
  commandIdentity,
  replayCommand,
  type CommandIdentity,
} from "./application-command";
import {
  appendApplicationEvent,
  canonicalApplication,
  type CanonicalApplication,
  type EventActor,
} from "./application-evidence";

@Injectable()
export class ApplicationTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly brands: BrandCentreAuthService,
    private readonly collaboration: ApprovedApplicationCollaborationPort,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async withdraw(user: AuthUser, applicationId: string, key: unknown) {
    const identity = commandIdentity(key, { applicationId });
    const preliminary = await this.actors.resolve(user);
    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, preliminary.workspaceId);
        const actor = await this.actors.resolveInTransaction(
          tx,
          user,
          preliminary.workspaceId,
        );
        if (
          !actor.allowedActions.includes(
            "CAMPAIGN_APPLICATION_WITHDRAW_PENDING",
          )
        )
          throw new ForbiddenException({ code: "APPLICATION_ROLE_DENIED" });
        const candidate = await tx.uceApplication.findFirst({
          where: {
            id: applicationId,
            authorityVersion: "C03_CANONICAL",
            subjectCreatorProfileId: actor.subjectCreatorProfileId,
            subjectCreatorWorkspaceId: actor.workspaceId,
          },
        });
        if (!candidate) throw this.notFound();
        const replay = await replayCommand(
          tx,
          "WITHDRAW",
          actor.actorUserId,
          actor.subjectCreatorProfileId,
          identity,
        );
        if (replay) return replay;
        const application = await this.lockApplication(
          tx,
          candidate.campaignId,
          applicationId,
        );
        return this.transition(
          tx,
          application,
          "WITHDRAWN",
          { kind: "CREATOR_TEAM_USER", actor },
          identity,
        );
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  async decide(
    user: AuthUser,
    campaignId: string,
    applicationId: string,
    kind: "APPROVE" | "REJECT",
    key: unknown,
  ) {
    const identity = commandIdentity(key, { campaignId, applicationId });
    const preliminaryBrand =
      await this.brands.resolveBrandProfileIdInTransaction(this.prisma, user);
    const candidate = await this.prisma.uceApplication.findFirst({
      where: {
        id: applicationId,
        campaignId,
        brandProfileId: preliminaryBrand,
        authorityVersion: "C03_CANONICAL",
      },
    });
    if (!candidate) throw this.notFound();
    const initial = canonicalApplication(candidate);
    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, initial.subjectCreatorWorkspaceId);
        // Campaign precedes the Brand-team lock: submission evidence also takes
        // a Brand FK lock while holding Campaign. Never create the reverse edge.
        await tx.$queryRaw`SELECT id FROM uce_campaigns WHERE id = ${campaignId} FOR UPDATE`;
        await lockBrandTeam(tx, initial.brandProfileId);
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR SHARE`;
        const brandProfileId =
          await this.brands.resolveBrandProfileIdInTransaction(tx, user);
        if (brandProfileId !== initial.brandProfileId) throw this.notFound();
        // A Brand receipt scope spans Creator workspaces. Serialize that scope,
        // after the subject lock, without taking any second workspace lock.
        const scope = `${kind}:${user.id}:${brandProfileId}:${identity.idempotencyKeyDigest}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
        const replay = await replayCommand(
          tx,
          kind,
          user.id,
          brandProfileId,
          identity,
        );
        if (replay) return replay;
        const application = await this.lockApplication(
          tx,
          campaignId,
          applicationId,
        );
        const campaign = await tx.uceCampaign.findFirst({
          where: { id: campaignId, brandProfileId },
          select: { id: true },
        });
        if (!campaign || application.brandProfileId !== brandProfileId)
          throw this.notFound();
        this.assertPending(application);
        return this.transition(
          tx,
          application,
          kind === "APPROVE" ? "APPROVED" : "REJECTED",
          { kind: "BRAND_USER", actorUserId: user.id },
          identity,
        );
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  /** Internal caller supplies a bounded, authoritatively selected expiry batch.
   * No deadline is inferred from publishing dates and no public route exists. */
  async expirePending(candidateIds: readonly string[]) {
    if (candidateIds.length > 100)
      throw new BadRequestException({
        code: "APPLICATION_EXPIRY_BATCH_TOO_LARGE",
      });
    const candidates = await this.prisma.uceApplication.findMany({
      where: {
        id: { in: [...new Set(candidateIds)] },
        authorityVersion: "C03_CANONICAL",
        status: "PENDING",
      },
      select: { id: true, campaignId: true, subjectCreatorWorkspaceId: true },
      orderBy: { id: "asc" },
      take: 100,
    });
    const results = [];
    for (const candidate of candidates) {
      if (!candidate.subjectCreatorWorkspaceId)
        throw new Error("C03_APPLICATION_SUBJECT_MISSING");
      const result = await this.prisma.$transaction(
        async (tx) => {
          await lockCreatorTeam(tx, candidate.subjectCreatorWorkspaceId!);
          const application = await this.lockApplication(
            tx,
            candidate.campaignId,
            candidate.id,
          );
          if (application.status !== "PENDING")
            return {
              applicationId: application.id,
              code: "APPLICATION_TRANSITION_CONFLICT",
              status: application.status,
            };
          return this.transition(tx, application, "EXPIRED", {
            kind: "SYSTEM",
          });
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
      results.push(result);
    }
    return results;
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    campaignId: string,
    applicationId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM uce_campaigns WHERE id = ${campaignId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM uce_applications WHERE id = ${applicationId} AND campaign_id = ${campaignId} FOR UPDATE`;
    const row = await tx.uceApplication.findFirst({
      where: {
        id: applicationId,
        campaignId,
        authorityVersion: "C03_CANONICAL",
      },
    });
    if (!row) throw this.notFound();
    return canonicalApplication(row);
  }

  private async transition(
    tx: Prisma.TransactionClient,
    application: CanonicalApplication,
    status: "WITHDRAWN" | "REJECTED" | "EXPIRED" | "APPROVED",
    actor: EventActor,
    identity?: CommandIdentity,
  ) {
    this.assertPending(application);
    const transitionId = randomUUID();
    const now = new Date();
    const changed = await tx.uceApplication.updateMany({
      where: {
        id: application.id,
        status: "PENDING",
        statusVersion: application.statusVersion,
      },
      data: { status, statusVersion: { increment: 1 }, terminalAt: now },
    });
    if (changed.count !== 1)
      throw new ConflictException({ code: "APPLICATION_TRANSITION_CONFLICT" });
    const approved =
      status === "APPROVED"
        ? await this.collaboration.provisionFromApprovedApplication(tx, {
            applicationId: application.id,
            approvalTransitionId: transitionId,
          })
        : undefined;
    return appendApplicationEvent(
      tx,
      {
        ...application,
        status,
        statusVersion: application.statusVersion + 1,
        terminalAt: now,
      },
      status,
      actor,
      now,
      identity
        ? {
            type:
              status === "WITHDRAWN"
                ? "WITHDRAW"
                : status === "APPROVED"
                  ? "APPROVE"
                  : "REJECT",
            identity,
          }
        : undefined,
      {
        transitionId,
        approvedCollaborationId: approved?.collaborationId,
        enqueue:
          status === "APPROVED" || status === "REJECTED"
            ? () =>
                this.notifications.enqueueWithinTransaction(tx, {
                  creatorWorkspaceId: application.subjectCreatorWorkspaceId,
                  eventType:
                    status === "APPROVED"
                      ? "campaigns.application_approved"
                      : "campaigns.application_rejected",
                  source: {
                    sourceType: "c03_application",
                    sourceId: application.id,
                    transitionId,
                  },
                  payload: {
                    application_id: application.id,
                    campaign_id: application.campaignId,
                    ...(approved
                      ? { collaboration_id: approved.collaborationId }
                      : {}),
                  },
                  triggerUserId:
                    actor.kind === "BRAND_USER" ? actor.actorUserId : undefined,
                })
            : undefined,
      },
    );
  }

  private assertPending(application: CanonicalApplication) {
    if (application.status !== "PENDING")
      throw new ConflictException({ code: "APPLICATION_TRANSITION_CONFLICT" });
  }
  private notFound() {
    return new NotFoundException({ code: "APPLICATION_NOT_FOUND" });
  }
}
