import {
  Injectable,
  ConflictException,
  Optional,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type CreatorWorkPreferences } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import {
  assertCreatorWorkspaceAction,
  lockCreatorTeam,
} from "../../creator-settings/team/creator-team.policy";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { CreatorShippingReadinessAdapter } from "../../creator-settings/services/creator-shipping-readiness.adapter";
import {
  WorkPreferencesValuesSchema,
  validateWorkPreferencesAt,
  WorkPreferencesMutationSchema,
  type WorkPreferencesValues,
} from "../contracts/work-preferences.contract";
import { WorkPreferencesRevisionSchema } from "../contracts/commercial-consumer.contract";
import { projectCommercialCountry } from "../contracts/commercial-country.projection";
import {
  WORK_PREFERENCES_RATE_CARD_PORT,
  type WorkPreferencesRateCardPort,
} from "./work-preferences-rate-card.port";
import type { z } from "zod";

function valuesFromRow(row: CreatorWorkPreferences): WorkPreferencesValues {
  return WorkPreferencesValuesSchema.parse({
    baseCountry: row.baseCountry,
    openToInternationalBrands: row.openToInternationalBrands,
    preferredIndustryIds: row.preferredIndustryIds,
    excludedIndustryIds: row.excludedIndustryIds,
    availability: row.availability,
    pausedUntil: row.pausedUntil?.toISOString() ?? null,
    physicalProductCollaborations: row.physicalProductCollaborations,
    ugcProjects: row.ugcProjects,
    giftingBarter: row.giftingBarter,
  });
}

@Injectable()
export class WorkPreferencesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly bank: PrismaCreatorPayoutCountryAuthorityAdapter,
    private readonly shipping: CreatorShippingReadinessAdapter,
    @Optional()
    @Inject(WORK_PREFERENCES_RATE_CARD_PORT)
    private readonly rates?: WorkPreferencesRateCardPort,
  ) {}
  read(user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
        assertCreatorWorkspaceAction(
          actor.allowedActions,
          "COMMERCIAL_SETUP_READ",
        );
        return this.readInTransaction(tx, actor);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async findProfile(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const profile = await tx.creatorWorkPreferences.findUnique({
      where: { workspaceId: actor.workspaceId },
    });
    if (profile && profile.ownerProfileId !== actor.subjectCreatorProfileId)
      throw new ConflictException({
        code: "WORK_PREFERENCES_SUBJECT_INCONSISTENT",
      });
    if (profile) {
      const revision =
        await tx.creatorWorkPreferencesRevision.findUniqueOrThrow({
          where: {
            profileId_revision: {
              profileId: profile.id,
              revision: profile.currentRevision,
            },
          },
        });
      if (
        JSON.stringify(WorkPreferencesValuesSchema.parse(revision.snapshot)) !==
        JSON.stringify(valuesFromRow(profile))
      )
        throw new ConflictException({
          code: "WORK_PREFERENCES_REVISION_INCONSISTENT",
        });
    }
    return profile;
  }
  private async readInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const profile = await this.findProfile(tx, actor);
    const values = profile ? valuesFromRow(profile) : null;
    const bank = await this.bank.readInTransaction(
      tx,
      actor.subjectCreatorProfileId,
    );
    return {
      actor,
      revision: profile?.currentRevision ?? 0,
      values,
      country: projectCommercialCountry({
        creatorProfileId: actor.subjectCreatorProfileId,
        bank,
        declared: profile
          ? {
              reference: profile.id,
              revision: profile.currentRevision,
              country: profile.baseCountry,
            }
          : null,
      }),
      shipping: await this.shipping.readInTransaction(
        tx,
        actor.subjectCreatorProfileId,
      ),
    };
  }
  mutate(
    user: AuthUser,
    command: z.infer<typeof WorkPreferencesMutationSchema>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      assertCreatorWorkspaceAction(
        actor.allowedActions,
        "WORK_PREFERENCES_EDIT",
      );
      const workspaceId = actor.workspaceId;
      await lockCreatorTeam(tx, workspaceId);
      actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      if (actor.workspaceId !== workspaceId)
        throw new ConflictException({
          code: "WORK_PREFERENCES_SUBJECT_CHANGED",
        });
      assertCreatorWorkspaceAction(
        actor.allowedActions,
        "WORK_PREFERENCES_EDIT",
      );
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`c05:payout-destination:${actor.subjectCreatorProfileId}`}))::text`;
      const profile = await this.findProfile(tx, actor);
      const hash = createHash("sha256")
        .update(
          JSON.stringify([actor.actorUserId, actor.actorMembershipId, command]),
        )
        .digest("hex");
      const replay = profile
        ? await tx.creatorWorkPreferencesRevision.findUnique({
            where: {
              profileId_idempotencyKey: {
                profileId: profile.id,
                idempotencyKey: command.idempotencyKey,
              },
            },
          })
        : null;
      if (replay) {
        if (replay.commandHash !== hash)
          throw new ConflictException({
            code: "WORK_PREFERENCES_IDEMPOTENCY_CONFLICT",
          });
        return this.readInTransaction(tx, actor);
      }
      if ((profile?.currentRevision ?? 0) !== command.expectedRevision)
        throw new ConflictException({
          code: "WORK_PREFERENCES_REVISION_CONFLICT",
        });
      if (!this.rates && command.expectedRateCardRevision !== 0)
        throw new ConflictException({ code: "RATE_CARD_REVISION_CONFLICT" });
      let values: WorkPreferencesValues;
      try {
        values = validateWorkPreferencesAt(command.values, new Date());
      } catch {
        throw new BadRequestException({
          code: "WORK_PREFERENCES_INVALID_PAUSE",
        });
      }
      const bank = await this.bank.readInTransaction(
        tx,
        actor.subjectCreatorProfileId,
      );
      if (
        bank.state === "CONFLICT" &&
        (!profile || values.baseCountry !== profile.baseCountry)
      )
        throw new ConflictException({
          code: "COUNTRY_AUTHORITY_SETTINGS_RECOVERY_REQUIRED",
        });
      if (
        bank.state === "AVAILABLE" &&
        values.baseCountry !== (profile?.baseCountry ?? bank.countryCode)
      )
        throw new ConflictException({
          code: "BANK_COUNTRY_CONTROLLED_BY_SETTINGS",
        });
      const revision = (profile?.currentRevision ?? 0) + 1;
      const now = new Date();
      const data = {
        ...values,
        pausedUntil: values.pausedUntil ? new Date(values.pausedUntil) : null,
        currentRevision: revision,
        updatedAt: now,
      };
      const saved = profile
        ? await tx.creatorWorkPreferences.update({
            where: { id: profile.id },
            data,
          })
        : await tx.creatorWorkPreferences.create({
            data: {
              ...data,
              workspaceId,
              ownerProfileId: actor.subjectCreatorProfileId,
              createdAt: now,
            },
          });
      WorkPreferencesRevisionSchema.parse({
        workspaceId,
        ownerCreatorProfileId: actor.subjectCreatorProfileId,
        actorUserId: actor.actorUserId,
        actorMembershipId: actor.actorMembershipId,
        actorRole: actor.actorRole,
        revision,
        previousRevision: revision - 1,
        idempotencyKey: command.idempotencyKey,
        createdAt: now.toISOString(),
        origin: "MANUAL",
        values,
      });
      await tx.creatorWorkPreferencesRevision.create({
        data: {
          profileId: saved.id,
          revision,
          previousRevision: revision - 1,
          snapshot: values as Prisma.InputJsonObject,
          actorUserId: actor.actorUserId,
          actorMembershipId: actor.actorMembershipId,
          actorRole: actor.actorRole,
          origin: "MANUAL",
          idempotencyKey: command.idempotencyKey,
          commandHash: hash,
          createdAt: now,
        },
      });
      if (this.rates)
        await this.rates.reconcileInTransaction(tx, actor, {
          command,
          previous: profile
            ? {
                reference: profile.id,
                revision: profile.currentRevision,
                values: valuesFromRow(profile),
              }
            : null,
          next: { reference: saved.id, revision, values },
        });
      return this.readInTransaction(tx, actor);
    });
  }
  /** Internal Settings/platform lifecycle capability only; no route exposes it. */
  purgeOwnerScope(input: {
    purpose: "CREATOR_OWNER_SCOPE_PURGE";
    workspaceId: string;
    ownerCreatorProfileId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockCreatorTeam(tx, input.workspaceId);
      const workspace = await tx.creatorWorkspace.findUniqueOrThrow({
        where: { id: input.workspaceId },
        select: { ownerProfileId: true },
      });
      if (
        input.purpose !== "CREATOR_OWNER_SCOPE_PURGE" ||
        workspace.ownerProfileId !== input.ownerCreatorProfileId
      )
        throw new ConflictException({
          code: "WORK_PREFERENCES_PURGE_SCOPE_MISMATCH",
        });
      return tx.creatorWorkPreferences.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          ownerProfileId: input.ownerCreatorProfileId,
        },
      });
    });
  }
}
