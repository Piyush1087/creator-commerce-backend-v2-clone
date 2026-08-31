import { Injectable } from "@nestjs/common";
import {
  IntelligenceAuthority,
  IntelligenceCurrentComponentLifecycle,
  IntelligenceFreshness,
  IntelligenceProtectionState,
  Prisma,
  type IntelligenceComponentGeneration,
  type IntelligenceCurrentComponent,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { ComponentSemanticAddress } from "../semantic-path/component-path.types";
import { resolveIntelligenceSubject } from "../subject/intelligence-subject.resolver";

export interface FreshnessMutation {
  readonly freshness: IntelligenceFreshness;
  readonly evaluatedAt: Date;
  readonly staleSince?: Date | null;
  readonly staleReasonCode?: string | null;
  readonly invalidatingRef?: string | null;
}

export function compareSemanticAddresses(
  left: ComponentSemanticAddress,
  right: ComponentSemanticAddress,
): number {
  return (
    left.brandId.localeCompare(right.brandId) ||
    (left.subjectId ?? "").localeCompare(right.subjectId ?? "") ||
    left.objectSemanticId.localeCompare(right.objectSemanticId) ||
    left.pathSchemeVersion - right.pathSchemeVersion ||
    left.componentSemanticPath.localeCompare(right.componentSemanticPath)
  );
}

export function sortSemanticAddresses(
  addresses: readonly ComponentSemanticAddress[],
): ComponentSemanticAddress[] {
  return [...addresses].sort(compareSemanticAddresses);
}

function protectionFor(
  authority: IntelligenceAuthority,
): IntelligenceProtectionState {
  if (authority === IntelligenceAuthority.BRAND_CONFIRMED) {
    return IntelligenceProtectionState.BRAND_CONFIRMED;
  }
  if (authority === IntelligenceAuthority.SUPPORT_CONTROLLED) {
    return IntelligenceProtectionState.SUPPORT_CONTROLLED;
  }
  return IntelligenceProtectionState.UNPROTECTED;
}

@Injectable()
export class IntelligenceCurrentStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(
    address: ComponentSemanticAddress,
  ): Promise<IntelligenceCurrentComponent | null> {
    const scoped = await this.scopeAddress(this.prisma, address);
    return this.prisma.intelligenceCurrentComponent.findUnique({
      where: {
        brandId_subjectId_objectSemanticId_pathSchemeVersion_componentSemanticPath:
          scoped,
      },
    });
  }

  async lockInCanonicalOrder(
    tx: Prisma.TransactionClient,
    addresses: readonly ComponentSemanticAddress[],
  ): Promise<Map<string, IntelligenceCurrentComponent>> {
    const locked = new Map<string, IntelligenceCurrentComponent>();
    const scopedAddresses = await Promise.all(
      addresses.map(async (address) => ({
        original: address,
        scoped: await this.scopeAddress(tx, address),
      })),
    );
    scopedAddresses.sort((left, right) =>
      compareSemanticAddresses(left.scoped, right.scoped),
    );
    for (const { original, scoped: address } of scopedAddresses) {
      const addressKey = this.key(address);
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
        SELECT 1 AS "locked"
        WHERE pg_advisory_xact_lock(hashtextextended(${addressKey}, 0)) IS NULL
      `);
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "current_component_id" AS "id"
        FROM "intelligence_current_components"
        WHERE "brand_id" = ${address.brandId}
          AND "subject_id" = ${address.subjectId}
          AND "object_semantic_id" = ${address.objectSemanticId}
          AND "path_scheme_version" = ${address.pathSchemeVersion}
          AND "component_semantic_path" = ${address.componentSemanticPath}
        FOR UPDATE
      `);
      if (rows[0]) {
        const current = await tx.intelligenceCurrentComponent.findUniqueOrThrow(
          {
            where: { id: rows[0].id },
          },
        );
        locked.set(addressKey, current);
        if (!original.subjectId) locked.set(this.key(original), current);
      }
    }
    return locked;
  }

  async createExpectedAbsent(
    tx: Prisma.TransactionClient,
    address: ComponentSemanticAddress,
    generation: IntelligenceComponentGeneration,
  ): Promise<IntelligenceCurrentComponent | null> {
    const scoped = await this.scopeAddress(tx, address);
    if (scoped.subjectId !== generation.subjectId) {
      throw new Error(
        "Current component generation belongs to another Intelligence subject",
      );
    }
    try {
      return await tx.intelligenceCurrentComponent.create({
        data: {
          brandId: address.brandId,
          subjectId: scoped.subjectId,
          objectSemanticId: address.objectSemanticId,
          pathSchemeVersion: address.pathSchemeVersion,
          componentSemanticPath: address.componentSemanticPath,
          nodeKind: generation.nodeKind,
          currentComponentGenerationId: generation.id,
          currentContractId: generation.componentContractId,
          currentContractVersion: generation.componentContractVersion,
          currentAuthority: generation.authority,
          currentSourceClass: generation.sourceClass,
          currentReadiness: generation.readiness,
          currentFreshness: generation.freshnessAtGeneration,
          protectionState: protectionFor(generation.authority),
          revision: 1n,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  async advanceExpectedRevision(
    tx: Prisma.TransactionClient,
    current: IntelligenceCurrentComponent,
    expectedRevision: bigint,
    expectedGenerationId: string,
    generation: IntelligenceComponentGeneration,
  ): Promise<IntelligenceCurrentComponent | null> {
    const result = await tx.intelligenceCurrentComponent.updateMany({
      where: {
        id: current.id,
        brandId: current.brandId,
        revision: expectedRevision,
        currentComponentGenerationId: expectedGenerationId,
      },
      data: {
        nodeKind: generation.nodeKind,
        currentComponentGenerationId: generation.id,
        currentContractId: generation.componentContractId,
        currentContractVersion: generation.componentContractVersion,
        currentAuthority: generation.authority,
        currentSourceClass: generation.sourceClass,
        currentReadiness: generation.readiness,
        currentFreshness: generation.freshnessAtGeneration,
        protectionState: protectionFor(generation.authority),
        lifecycle: IntelligenceCurrentComponentLifecycle.ACTIVE,
        revision: { increment: 1n },
        freshnessEvaluatedAt: null,
        staleSince: null,
        staleReasonCode: null,
        invalidatingRef: null,
      },
    });
    if (result.count !== 1) return null;
    return tx.intelligenceCurrentComponent.findUniqueOrThrow({
      where: { id: current.id },
    });
  }

  async setFreshnessExpectedRevision(
    tx: Prisma.TransactionClient,
    current: IntelligenceCurrentComponent,
    expectedRevision: bigint,
    mutation: FreshnessMutation,
  ): Promise<IntelligenceCurrentComponent | null> {
    const stale = mutation.freshness === IntelligenceFreshness.STALE;
    const result = await tx.intelligenceCurrentComponent.updateMany({
      where: { id: current.id, revision: expectedRevision },
      data: {
        currentFreshness: mutation.freshness,
        freshnessEvaluatedAt: mutation.evaluatedAt,
        staleSince: stale
          ? (mutation.staleSince ?? mutation.evaluatedAt)
          : null,
        staleReasonCode: stale ? (mutation.staleReasonCode ?? null) : null,
        invalidatingRef: stale ? (mutation.invalidatingRef ?? null) : null,
        revision: { increment: 1n },
      },
    });
    if (result.count !== 1) return null;
    return tx.intelligenceCurrentComponent.findUniqueOrThrow({
      where: { id: current.id },
    });
  }

  async retireExpectedRevision(
    tx: Prisma.TransactionClient,
    current: IntelligenceCurrentComponent,
    expectedRevision: bigint,
  ): Promise<IntelligenceCurrentComponent | null> {
    const result = await tx.intelligenceCurrentComponent.updateMany({
      where: { id: current.id, revision: expectedRevision },
      data: {
        lifecycle: IntelligenceCurrentComponentLifecycle.RETIRED,
        revision: { increment: 1n },
      },
    });
    if (result.count !== 1) return null;
    return tx.intelligenceCurrentComponent.findUniqueOrThrow({
      where: { id: current.id },
    });
  }

  key(address: ComponentSemanticAddress): string {
    return JSON.stringify([
      address.brandId,
      address.subjectId,
      address.objectSemanticId,
      address.pathSchemeVersion,
      address.componentSemanticPath,
    ]);
  }

  private async scopeAddress(
    client: Pick<Prisma.TransactionClient, "intelligenceSubject" | "offering">,
    address: ComponentSemanticAddress,
  ): Promise<ComponentSemanticAddress & { readonly subjectId: string }> {
    if (address.subjectId) return { ...address, subjectId: address.subjectId };
    const subject = await resolveIntelligenceSubject(client, address.brandId);
    return { ...address, subjectId: subject.id };
  }
}
