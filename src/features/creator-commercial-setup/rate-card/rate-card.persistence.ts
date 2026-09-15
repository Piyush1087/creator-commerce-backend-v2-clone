import { Injectable, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type CreatorRateCard } from "@prisma/client";
import type { z } from "zod";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import {
  assertCreatorWorkspaceAction,
  lockCreatorTeam,
} from "../../creator-settings/team/creator-team.policy";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { projectCommercialCountry } from "../contracts/commercial-country.projection";
import {
  commercialAuthorityFingerprint,
  type CountryAuthorityBinding,
} from "../contracts/commercial-common.contract";
import {
  RateCardValuesSchema,
  RateCardStoredAuthoritySchema,
  projectRateCardMoney,
  type RateCardValues,
  type RateCardMutationSchema,
} from "../contracts/rate-card.contract";
import { RateCardRevisionSchema } from "../contracts/commercial-consumer.contract";
import { decideRateCardCountryTransition } from "../contracts/rate-card-country-transition.contract";
import type { WorkPreferencesRateCardPort } from "../work-preferences/work-preferences-rate-card.port";

export function rateCardValues(row: CreatorRateCard): RateCardValues {
  const line = (enabled: boolean, amount: bigint | null) => ({
    enabled,
    amountMinor: amount === null ? null : Number(amount),
  });
  return RateCardValuesSchema.parse({
    REEL_VIDEO: line(row.reelEnabled, row.reelAmountMinor),
    STORY: line(row.storyEnabled, row.storyAmountMinor),
    BANNER_CAROUSEL: line(row.carouselEnabled, row.carouselAmountMinor),
    PHOTOSHOOT: line(row.photoshootEnabled, row.photoshootAmountMinor),
    linkInBio: line(row.linkInBioEnabled, row.linkInBioAmountMinor),
    paidAmplification: line(
      row.partnershipAdsEnabled,
      row.partnershipAdsAmountMinor,
    ),
    contentUsageRights: row.contentUsageRights,
    usageDays: row.usageDays === null ? null : Number(row.usageDays),
    advancePercent: row.advancePercent,
    balanceTerm: row.balanceTerm,
  });
}
export function rateCardAuthority(row: CreatorRateCard) {
  return RateCardStoredAuthoritySchema.parse({
    binding: {
      source: row.authoritySource,
      sourceReference: row.authorityReference,
      sourceVersion: row.authorityVersion,
      legalProfileVersion: row.authorityLegalVersion,
      country: row.country,
      currency: row.currency,
    },
    fingerprint: row.authorityFingerprint,
  });
}
const amount = (value: number | null) =>
  value === null ? null : BigInt(value);
@Injectable()
export class RateCardPersistence implements WorkPreferencesRateCardPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly bank: PrismaCreatorPayoutCountryAuthorityAdapter,
  ) {}
  private async profile(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const row = await tx.creatorRateCard.findUnique({
      where: { workspaceId: actor.workspaceId },
    });
    if (row) {
      if (row.ownerProfileId !== actor.subjectCreatorProfileId)
        throw new ConflictException({ code: "RATE_CARD_SUBJECT_INCONSISTENT" });
      const revision = await tx.creatorRateCardRevision.findUniqueOrThrow({
        where: {
          profileId_revision: {
            profileId: row.id,
            revision: row.currentRevision,
          },
        },
      });
      if (
        JSON.stringify(RateCardValuesSchema.parse(revision.snapshot)) !==
          JSON.stringify(rateCardValues(row)) ||
        JSON.stringify(
          RateCardStoredAuthoritySchema.parse(revision.authoritySnapshot),
        ) !== JSON.stringify(rateCardAuthority(row))
      )
        throw new ConflictException({
          code: "RATE_CARD_REVISION_INCONSISTENT",
        });
    }
    return row;
  }
  private async context(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const preferences = await tx.creatorWorkPreferences.findUnique({
      where: { workspaceId: actor.workspaceId },
    });
    if (
      preferences &&
      preferences.ownerProfileId !== actor.subjectCreatorProfileId
    )
      throw new ConflictException({
        code: "WORK_PREFERENCES_SUBJECT_INCONSISTENT",
      });
    const bank = await this.bank.readInTransaction(
      tx,
      actor.subjectCreatorProfileId,
    );
    const country = projectCommercialCountry({
      creatorProfileId: actor.subjectCreatorProfileId,
      bank,
      declared: preferences
        ? {
            reference: preferences.id,
            revision: preferences.currentRevision,
            country: preferences.baseCountry,
          }
        : null,
    });
    return { preferences, country };
  }
  private async projection(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const { preferences, country } = await this.context(tx, actor);
    const row = await this.profile(tx, actor);
    const projected = row
      ? projectRateCardMoney(
          rateCardValues(row),
          rateCardAuthority(row).fingerprint,
          country.authorityBinding,
        )
      : null;
    return {
      actor,
      country,
      revision: row?.currentRevision ?? 0,
      state: projected?.state ?? ("UNCONFIGURED" as const),
      values: projected?.values ?? null,
      workPreferences: {
        ugcProjects: preferences?.ugcProjects ?? null,
        giftingBarter: preferences?.giftingBarter ?? null,
      },
    };
  }
  read(user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
        assertCreatorWorkspaceAction(
          actor.allowedActions,
          "COMMERCIAL_SETUP_READ",
        );
        return this.projection(tx, actor);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async save(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    row: CreatorRateCard | null,
    input: {
      values: RateCardValues;
      binding: CountryAuthorityBinding;
      origin:
        | "MANUAL"
        | "COUNTRY_AUTHORITY_RECONCILIATION"
        | "MANUAL_COUNTRY_MONETARY_RESET";
      idempotencyKey: string;
      commandHash: string;
      transition?: Prisma.InputJsonObject;
    },
  ) {
    const { values: v, binding: b } = input;
    const revision = (row?.currentRevision ?? 0) + 1,
      now = new Date();
    const authority = {
      binding: b,
      fingerprint: commercialAuthorityFingerprint(b),
    };
    RateCardRevisionSchema.parse({
      workspaceId: actor.workspaceId,
      ownerCreatorProfileId: actor.subjectCreatorProfileId,
      actorUserId: actor.actorUserId,
      actorMembershipId: actor.actorMembershipId,
      actorRole: actor.actorRole,
      revision,
      previousRevision: revision - 1,
      idempotencyKey: input.idempotencyKey,
      createdAt: now.toISOString(),
      origin: input.origin,
      values: v,
      authority,
    });
    const data = {
      currentRevision: revision,
      authoritySource: b.source,
      authorityReference: b.sourceReference,
      authorityVersion: b.sourceVersion,
      authorityLegalVersion: b.legalProfileVersion,
      country: b.country,
      currency: b.currency,
      authorityFingerprint: authority.fingerprint,
      reelEnabled: v.REEL_VIDEO.enabled,
      reelAmountMinor: amount(v.REEL_VIDEO.amountMinor),
      storyEnabled: v.STORY.enabled,
      storyAmountMinor: amount(v.STORY.amountMinor),
      carouselEnabled: v.BANNER_CAROUSEL.enabled,
      carouselAmountMinor: amount(v.BANNER_CAROUSEL.amountMinor),
      photoshootEnabled: v.PHOTOSHOOT.enabled,
      photoshootAmountMinor: amount(v.PHOTOSHOOT.amountMinor),
      linkInBioEnabled: v.linkInBio.enabled,
      linkInBioAmountMinor: amount(v.linkInBio.amountMinor),
      partnershipAdsEnabled: v.paidAmplification.enabled,
      partnershipAdsAmountMinor: amount(v.paidAmplification.amountMinor),
      contentUsageRights: v.contentUsageRights,
      usageDays: amount(v.usageDays),
      advancePercent: v.advancePercent,
      balanceTerm: v.balanceTerm,
      updatedAt: now,
    };
    const saved = row
      ? await tx.creatorRateCard.update({ where: { id: row.id }, data })
      : await tx.creatorRateCard.create({
          data: {
            ...data,
            workspaceId: actor.workspaceId,
            ownerProfileId: actor.subjectCreatorProfileId,
            createdAt: now,
          },
        });
    await tx.creatorRateCardRevision.create({
      data: {
        profileId: saved.id,
        revision,
        previousRevision: revision - 1,
        snapshot: v as Prisma.InputJsonObject,
        authoritySnapshot: authority as Prisma.InputJsonObject,
        transitionSnapshot: input.transition,
        actorUserId: actor.actorUserId,
        actorMembershipId: actor.actorMembershipId,
        actorRole: actor.actorRole,
        origin: input.origin,
        idempotencyKey: input.idempotencyKey,
        commandHash: input.commandHash,
        createdAt: now,
      },
    });
  }
  mutate(user: AuthUser, command: z.infer<typeof RateCardMutationSchema>) {
    return this.prisma.$transaction(async (tx) => {
      let actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      assertCreatorWorkspaceAction(actor.allowedActions, "RATE_CARD_EDIT");
      const workspaceId = actor.workspaceId;
      await lockCreatorTeam(tx, workspaceId);
      actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      if (actor.workspaceId !== workspaceId)
        throw new ConflictException({ code: "RATE_CARD_SUBJECT_CHANGED" });
      assertCreatorWorkspaceAction(actor.allowedActions, "RATE_CARD_EDIT");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`c05:payout-destination:${actor.subjectCreatorProfileId}`}))::text`;
      const row = await this.profile(tx, actor);
      const hash = createHash("sha256")
        .update(
          JSON.stringify([actor.actorUserId, actor.actorMembershipId, command]),
        )
        .digest("hex");
      const replay = row
        ? await tx.creatorRateCardRevision.findUnique({
            where: {
              profileId_idempotencyKey: {
                profileId: row.id,
                idempotencyKey: command.idempotencyKey,
              },
            },
          })
        : null;
      if (replay) {
        if (replay.commandHash !== hash)
          throw new ConflictException({
            code: "RATE_CARD_IDEMPOTENCY_CONFLICT",
          });
        return this.projection(tx, actor);
      }
      if ((row?.currentRevision ?? 0) !== command.expectedRevision)
        throw new ConflictException({ code: "RATE_CARD_REVISION_CONFLICT" });
      const { preferences, country } = await this.context(tx, actor);
      if (
        !preferences ||
        preferences.currentRevision !== command.expectedWorkPreferencesRevision
      )
        throw new ConflictException({
          code: "WORK_PREFERENCES_REVISION_CONFLICT",
        });
      if (
        !country.authorityBinding ||
        country.authorityFingerprint !== command.authorityFingerprint
      )
        throw new ConflictException({
          code: "COUNTRY_AUTHORITY_SETTINGS_RECOVERY_REQUIRED",
        });
      if (row && row.authorityFingerprint !== country.authorityFingerprint) {
        const previous = rateCardAuthority(row).binding;
        const decision = decideRateCardCountryTransition({
          values: rateCardValues(row),
          previous,
          next: country.authorityBinding,
          manualCountryChange: false,
          confirmMonetaryReset: false,
        });
        await this.save(tx, actor, row, {
          values: decision.values,
          binding: decision.authorityBinding,
          origin: decision.origin,
          idempotencyKey: command.idempotencyKey,
          commandHash: hash,
          transition: {
            previous,
            next: decision.authorityBinding,
            currencyChanged: decision.currencyChanged,
            clearedMonetaryKeys: [...decision.clearedMonetaryKeys],
          },
        });
      } else
        await this.save(tx, actor, row, {
          values: command.values,
          binding: country.authorityBinding,
          origin: "MANUAL",
          idempotencyKey: command.idempotencyKey,
          commandHash: hash,
        });
      return this.projection(tx, actor);
    });
  }
  async reconcileInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    input: Parameters<WorkPreferencesRateCardPort["reconcileInTransaction"]>[2],
  ) {
    const row = await this.profile(tx, actor);
    if ((row?.currentRevision ?? 0) !== input.command.expectedRateCardRevision)
      throw new ConflictException({ code: "RATE_CARD_REVISION_CONFLICT" });
    if (!row) return;
    const { country } = await this.context(tx, actor);
    if (
      !country.authorityBinding ||
      country.authorityFingerprint === row.authorityFingerprint
    )
      return;
    const previous = rateCardAuthority(row).binding;
    const manualCountryChange =
      country.authorityBinding.source === "CREATOR_DECLARED" &&
      input.previous !== null &&
      input.previous.values.baseCountry !== input.next.values.baseCountry;
    let decision: ReturnType<typeof decideRateCardCountryTransition>;
    try {
      decision = decideRateCardCountryTransition({
        values: rateCardValues(row),
        previous,
        next: country.authorityBinding,
        manualCountryChange,
        confirmMonetaryReset: input.command.confirmMonetaryReset,
      });
    } catch {
      throw new ConflictException({
        code: "MONETARY_RESET_CONFIRMATION_REQUIRED",
      });
    }
    const hash = createHash("sha256")
      .update(
        JSON.stringify(["WP_RECONCILE", actor.actorUserId, input.command]),
      )
      .digest("hex");
    await this.save(tx, actor, row, {
      values: decision.values,
      binding: decision.authorityBinding,
      origin: decision.origin,
      idempotencyKey: input.command.idempotencyKey,
      commandHash: hash,
      transition: {
        previous,
        next: decision.authorityBinding,
        currencyChanged: decision.currencyChanged,
        clearedMonetaryKeys: [...decision.clearedMonetaryKeys],
      },
    });
  }
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
        throw new ConflictException({ code: "RATE_CARD_PURGE_SCOPE_MISMATCH" });
      return tx.creatorRateCard.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          ownerProfileId: input.ownerCreatorProfileId,
        },
      });
    });
  }
}
