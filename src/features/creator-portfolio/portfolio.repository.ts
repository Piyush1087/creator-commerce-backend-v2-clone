import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type CreatorPortfolioItem } from "@prisma/client";
import type { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import {
  assertCreatorWorkspaceAction,
  lockCreatorTeam,
} from "../creator-settings/team/creator-team.policy";
import {
  PortfolioItemSchema,
  PortfolioConsumerSchema,
  PortfolioMutationSchema,
  PortfolioQuerySchema,
  portfolioIdentity,
  portfolioDestinationAlias,
  PORTFOLIO_VERSION,
  type PortfolioItem,
} from "./contracts/portfolio.contract";

export function portfolioItemFromRow(row: CreatorPortfolioItem): PortfolioItem {
  return PortfolioItemSchema.parse({
    id: row.id,
    kind: row.kind,
    destination: row.destination,
    title: row.title,
    creatorContext: row.creatorContext,
    brandLabel: row.brandLabel,
    workDate: row.workDate?.toISOString() ?? null,
    state: row.state,
    provenance: row.provenance,
    presentation: "SOURCE_LINK_ONLY",
    access: "ACCESS_REQUIREMENTS_UNKNOWN",
  });
}
export function portfolioItemData(item: PortfolioItem, revision: number) {
  return {
    kind: item.kind,
    destination: item.destination,
    title: item.title,
    creatorContext: item.creatorContext,
    brandLabel: item.brandLabel,
    workDate: item.workDate ? new Date(item.workDate) : null,
    state: item.state,
    sources: [...new Set(item.provenance.map((p) => p.source))].sort(),
    provenance: item.provenance as Prisma.InputJsonArray,
    lastRevision: revision,
  };
}
@Injectable()
export class PortfolioRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  read(user: AuthUser, query: z.infer<typeof PortfolioQuerySchema>) {
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
        assertCreatorWorkspaceAction(actor.allowedActions, "PORTFOLIO_READ");
        return this.readInTransaction(tx, actor, query);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findAggregate(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
  ) {
    const row = await tx.creatorPortfolio.findUnique({
      where: { workspaceId: actor.workspaceId },
    });
    if (row && row.ownerProfileId !== actor.subjectCreatorProfileId)
      throw new ConflictException({ code: "PORTFOLIO_SUBJECT_INCONSISTENT" });
    return row;
  }
  async readInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    query: z.infer<typeof PortfolioQuerySchema>,
  ) {
    const aggregate = await this.findAggregate(tx, actor);
    const where: Prisma.CreatorPortfolioItemWhereInput = {
      portfolioId: aggregate?.id ?? "NO_PORTFOLIO",
      state: query.filter === "REMOVED" ? "REMOVED" : "INCLUDED",
      ...(query.filter !== "ALL" && query.filter !== "REMOVED"
        ? { sources: { has: query.filter } }
        : {}),
    };
    if (
      query.cursor &&
      !(await tx.creatorPortfolioItem.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      }))
    )
      throw new NotFoundException({ code: "PORTFOLIO_CURSOR_UNAVAILABLE" });
    const rows = aggregate
      ? await tx.creatorPortfolioItem.findMany({
          where,
          orderBy: [
            { workDate: { sort: "desc", nulls: "last" } },
            { id: "asc" },
          ],
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
          take: 101,
        })
      : [];
    return PortfolioConsumerSchema.parse({
      contractVersion: PORTFOLIO_VERSION,
      currentRevision: aggregate?.currentRevision ?? 0,
      context: {
        role: actor.actorRole,
        canCurate: actor.allowedActions.includes("PORTFOLIO_CURATE"),
      },
      items: rows.slice(0, 100).map((row) => {
        const item = portfolioItemFromRow(row);
        return {
          ...item,
          provenance: item.provenance.map((p) =>
            p.source === "INSTAGRAM"
              ? {
                  source: p.source,
                  classification: p.classification,
                  confidence: p.confidence,
                  observedAt: p.observedAt,
                  basis: "SPONSORSHIP_DISCLOSURE",
                }
              : p.source === "CREATOR_SHOP"
                ? {
                    source: p.source,
                    verification: "COMPLETED_WORK",
                    verifiedAt: p.verifiedAt,
                  }
                : p,
          ),
        };
      }),
      nextCursor: rows.length > 100 ? rows[99].id : null,
      discovery: "NOT_PROCESSED",
      limitations: [
        "STATIC_PRESENTATION_NOT_AVAILABLE",
        "STORY_CAPABILITY_NOT_AVAILABLE",
      ],
    });
  }
  mutate(user: AuthUser, command: z.infer<typeof PortfolioMutationSchema>) {
    return this.prisma.$transaction(async (tx) => {
      let actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      assertCreatorWorkspaceAction(actor.allowedActions, "PORTFOLIO_CURATE");
      const workspaceId = actor.workspaceId;
      await lockCreatorTeam(tx, workspaceId);
      actor = await this.actors.resolveReadOnlyInTransaction(tx, user);
      if (actor.workspaceId !== workspaceId)
        throw new ConflictException({ code: "PORTFOLIO_SUBJECT_CHANGED" });
      assertCreatorWorkspaceAction(actor.allowedActions, "PORTFOLIO_CURATE");
      const aggregate = await this.findAggregate(tx, actor);
      const commandHash = createHash("sha256")
        .update(
          JSON.stringify([actor.actorUserId, actor.actorMembershipId, command]),
        )
        .digest("hex");
      const replay = aggregate
        ? await tx.creatorPortfolioRevision.findUnique({
            where: {
              portfolioId_idempotencyKey: {
                portfolioId: aggregate.id,
                idempotencyKey: command.idempotencyKey,
              },
            },
          })
        : null;
      if (replay) {
        if (replay.commandHash !== commandHash)
          throw new ConflictException({
            code: "PORTFOLIO_IDEMPOTENCY_CONFLICT",
          });
        return this.readInTransaction(tx, actor, { filter: "ALL" });
      }
      if ((aggregate?.currentRevision ?? 0) !== command.expectedRevision)
        throw new ConflictException({ code: "PORTFOLIO_REVISION_CONFLICT" });
      let item: PortfolioItem;
      const now = new Date();
      if (command.intent === "ADD_REFERENCE") {
        if (
          aggregate &&
          (await tx.creatorPortfolioAlias.findUnique({
            where: {
              portfolioId_alias: {
                portfolioId: aggregate.id,
                alias: portfolioDestinationAlias(command.destination),
              },
            },
          }))
        )
          throw new ConflictException({ code: "PORTFOLIO_REFERENCE_EXISTS" });
        item = PortfolioItemSchema.parse({
          id: portfolioIdentity(
            actor.subjectCreatorProfileId,
            portfolioDestinationAlias(command.destination),
          ),
          kind: command.kind,
          destination: command.destination,
          title: command.title,
          creatorContext: command.creatorContext,
          brandLabel: null,
          workDate: command.workDate,
          state: "INCLUDED",
          provenance: [
            { source: "CREATOR_PROVIDED", createdAt: now.toISOString() },
          ],
          presentation: "SOURCE_LINK_ONLY",
          access: "ACCESS_REQUIREMENTS_UNKNOWN",
        });
      } else {
        const row = aggregate
          ? await tx.creatorPortfolioItem.findFirst({
              where: { id: command.itemId, portfolioId: aggregate.id },
            })
          : null;
        if (!row)
          throw new NotFoundException({ code: "PORTFOLIO_ITEM_UNAVAILABLE" });
        item = portfolioItemFromRow(row);
        if (command.intent === "EDIT_REFERENCE") {
          if (item.provenance.some((p) => p.source !== "CREATOR_PROVIDED"))
            throw new ConflictException({
              code: "PORTFOLIO_VERIFIED_FACT_IMMUTABLE",
            });
          const collision = await tx.creatorPortfolioAlias.findUnique({
            where: {
              portfolioId_alias: {
                portfolioId: row.portfolioId,
                alias: portfolioDestinationAlias(command.destination),
              },
            },
          });
          if (collision && collision.itemId !== item.id)
            throw new ConflictException({ code: "PORTFOLIO_REFERENCE_EXISTS" });
          item = PortfolioItemSchema.parse({
            ...item,
            destination: command.destination,
            title: command.title,
            creatorContext: command.creatorContext,
            workDate: command.workDate,
          });
        } else
          item = {
            ...item,
            state: command.intent === "REMOVE" ? "REMOVED" : "INCLUDED",
          };
      }
      const revision = (aggregate?.currentRevision ?? 0) + 1;
      const saved = aggregate
        ? await tx.creatorPortfolio.update({
            where: { id: aggregate.id },
            data: { currentRevision: revision },
          })
        : await tx.creatorPortfolio.create({
            data: {
              workspaceId,
              ownerProfileId: actor.subjectCreatorProfileId,
              currentRevision: revision,
            },
          });
      await tx.creatorPortfolioItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          portfolioId: saved.id,
          ...portfolioItemData(item, revision),
        },
        update: portfolioItemData(item, revision),
      });
      if (command.intent === "EDIT_REFERENCE")
        await tx.creatorPortfolioAlias.deleteMany({
          where: { portfolioId: saved.id, itemId: item.id },
        });
      await tx.creatorPortfolioAlias.upsert({
        where: {
          portfolioId_alias: {
            portfolioId: saved.id,
            alias: portfolioDestinationAlias(item.destination),
          },
        },
        create: {
          portfolioId: saved.id,
          itemId: item.id,
          alias: portfolioDestinationAlias(item.destination),
        },
        update: {},
      });
      await tx.creatorPortfolioRevision.create({
        data: {
          portfolioId: saved.id,
          revision,
          previousRevision: revision - 1,
          snapshot: { item } as unknown as Prisma.InputJsonObject,
          actorUserId: actor.actorUserId,
          actorMembershipId: actor.actorMembershipId,
          actorRole: actor.actorRole,
          origin: "MANUAL",
          idempotencyKey: command.idempotencyKey,
          commandHash,
        },
      });
      return this.readInTransaction(tx, actor, { filter: "ALL" });
    });
  }
}
