import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  PortfolioItemSchema,
  portfolioDestinationAlias,
  type PortfolioItem,
} from "./contracts/portfolio.contract";
import type { PortfolioSourceBatch } from "./portfolio-source-reader";
import {
  portfolioItemData,
  portfolioItemFromRow,
} from "./portfolio.repository";

function sourceKey(p: PortfolioItem["provenance"][number]): string {
  return p.source === "INSTAGRAM"
    ? `instagram:${p.accountId}:${p.providerMediaId}`
    : p.source === "CREATOR_SHOP"
      ? `c04:${p.deliverableExecutionId}:${p.evidenceId}`
      : "creator-provided";
}
/** Owning derived read-model projection only, under the canonical Team lock.
 * Source/C04 rows are read-only. Individual changed-item revisions stay bounded;
 * any failure rolls the transaction back, retaining prior curation/current. */
export async function materializePortfolioSources(
  tx: Prisma.TransactionClient,
  actor: CreatorWorkspaceActorContext,
  batch: PortfolioSourceBatch,
) {
  let aggregate = await tx.creatorPortfolio.findUnique({
    where: { workspaceId: actor.workspaceId },
  });
  if (aggregate && aggregate.ownerProfileId !== actor.subjectCreatorProfileId)
    throw new Error("PORTFOLIO_SOURCE_SUBJECT_INVALID");
  for (const candidate of batch.items) {
    const aliases = [
      portfolioDestinationAlias(candidate.destination),
      ...candidate.provenance.map(sourceKey),
    ];
    const matches = aggregate
      ? await tx.creatorPortfolioAlias.findMany({
          where: { portfolioId: aggregate.id, alias: { in: aliases } },
          include: { item: true },
        })
      : [];
    const ids = new Set(matches.map((m) => m.itemId));
    if (ids.size > 1) {
      batch.discovery = "PARTIAL";
      batch.limitations.push("SOURCE_IDENTITY_CONFLICT");
      continue;
    }
    const old = matches[0]?.item;
    const prior = old ? portfolioItemFromRow(old) : null;
    const incomingIg = candidate.provenance.find(
      (p) => p.source === "INSTAGRAM",
    );
    const priorIg = prior?.provenance.find((p) => p.source === "INSTAGRAM");
    if (
      priorIg &&
      !incomingIg &&
      candidate.destination !== prior!.destination
    ) {
      batch.discovery = "PARTIAL";
      batch.limitations.push("SOURCE_IDENTITY_CONFLICT");
      continue;
    }
    if (
      incomingIg?.source === "INSTAGRAM" &&
      priorIg?.source === "INSTAGRAM" &&
      (incomingIg.accountId !== priorIg.accountId ||
        incomingIg.providerMediaId !== priorIg.providerMediaId)
    ) {
      batch.discovery = "PARTIAL";
      batch.limitations.push("SOURCE_IDENTITY_CONFLICT");
      continue;
    }
    const provenance = [
      ...(prior?.provenance ?? []).filter(
        (p) => !candidate.provenance.some((n) => sourceKey(n) === sourceKey(p)),
      ),
      ...candidate.provenance,
    ].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
    if (provenance.length > 32) {
      batch.discovery = "PARTIAL";
      batch.limitations.push("SOURCE_PROVENANCE_BOUND_REACHED");
      continue;
    }
    const item = PortfolioItemSchema.parse({
      ...candidate,
      id: prior?.id ?? candidate.id,
      state: prior?.state ?? "INCLUDED",
      provenance,
      // C04 enrichment cannot replace an already admitted Instagram identity/link.
      ...(priorIg && !incomingIg
        ? {
            kind: prior!.kind,
            destination: prior!.destination,
            title: prior!.title,
            workDate: prior!.workDate,
          }
        : {}),
      creatorContext: prior?.creatorContext ?? null,
    });
    if (prior && JSON.stringify(prior) === JSON.stringify(item)) continue;
    const revision = (aggregate?.currentRevision ?? 0) + 1;
    aggregate = aggregate
      ? await tx.creatorPortfolio.update({
          where: { id: aggregate.id },
          data: { currentRevision: revision },
        })
      : await tx.creatorPortfolio.create({
          data: {
            workspaceId: actor.workspaceId,
            ownerProfileId: actor.subjectCreatorProfileId,
            currentRevision: revision,
          },
        });
    await tx.creatorPortfolioItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        portfolioId: aggregate.id,
        ...portfolioItemData(item, revision),
      },
      update: portfolioItemData(item, revision),
    });
    for (const alias of new Set([
      ...aliases,
      portfolioDestinationAlias(item.destination),
    ]))
      await tx.creatorPortfolioAlias.upsert({
        where: { portfolioId_alias: { portfolioId: aggregate.id, alias } },
        create: { portfolioId: aggregate.id, itemId: item.id, alias },
        update: {},
      });
    const commandHash = createHash("sha256")
      .update(JSON.stringify([actor.subjectCreatorProfileId, item]))
      .digest("hex");
    await tx.creatorPortfolioRevision.create({
      data: {
        portfolioId: aggregate.id,
        revision,
        previousRevision: revision - 1,
        snapshot: { item } as unknown as Prisma.InputJsonObject,
        actorUserId: actor.actorUserId,
        actorMembershipId: actor.actorMembershipId,
        actorRole: actor.actorRole,
        origin: "SOURCE_ADAPT",
        idempotencyKey: `source:${revision}:${commandHash}`,
        commandHash,
      },
    });
  }
  batch.limitations = [...new Set(batch.limitations)].sort();
}
