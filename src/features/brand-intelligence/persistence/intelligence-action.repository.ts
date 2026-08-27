import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type IntelligenceAction,
  type IntelligenceComponentTransition,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";
import { resolveIntelligenceSubject } from "../subject/intelligence-subject.resolver";

export type ActionWrite = Omit<
  Prisma.IntelligenceActionUncheckedCreateInput,
  "createdAt" | "subjectId"
> & { readonly subjectId?: string };
export type TransitionWrite = Omit<
  Prisma.IntelligenceComponentTransitionUncheckedCreateInput,
  "createdAt"
>;

export interface ActionLookupResult {
  readonly action: IntelligenceAction;
  readonly replayed: boolean;
}

@Injectable()
export class IntelligenceActionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrReplay(
    tx: Prisma.TransactionClient,
    data: ActionWrite,
  ): Promise<ActionLookupResult> {
    const subjectId = await this.resolveSubjectId(tx, data);
    const scopedData = { ...data, subjectId };
    const existing = await tx.intelligenceAction.findUnique({
      where: {
        brandId_subjectId_actionType_requestIdempotencyKey: {
          brandId: data.brandId,
          subjectId,
          actionType: data.actionType,
          requestIdempotencyKey: data.requestIdempotencyKey,
        },
      },
    });
    if (existing) {
      this.assertSameAction(existing, scopedData);
      return { action: existing, replayed: true };
    }

    try {
      return {
        action: await tx.intelligenceAction.create({ data: scopedData }),
        replayed: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await tx.intelligenceAction.findUniqueOrThrow({
          where: {
            brandId_subjectId_actionType_requestIdempotencyKey: {
              brandId: data.brandId,
              subjectId,
              actionType: data.actionType,
              requestIdempotencyKey: data.requestIdempotencyKey,
            },
          },
        });
        this.assertSameAction(raced, scopedData);
        return { action: raced, replayed: true };
      }
      throw error;
    }
  }

  createTransition(
    tx: Prisma.TransactionClient,
    data: TransitionWrite,
  ): Promise<IntelligenceComponentTransition> {
    return tx.intelligenceComponentTransition.create({ data });
  }

  getTransitions(
    tx: Prisma.TransactionClient,
    actionId: string,
  ): Promise<IntelligenceComponentTransition[]> {
    return tx.intelligenceComponentTransition.findMany({
      where: { actionId },
      orderBy: [
        { objectSemanticId: "asc" },
        { pathSchemeVersion: "asc" },
        { componentSemanticPath: "asc" },
      ],
    });
  }

  private assertSameAction(
    existing: IntelligenceAction,
    data: ActionWrite,
  ): void {
    const fields = [
      "id",
      "brandId",
      "subjectId",
      "actionType",
      "actorType",
      "actorRef",
      "authorizationDecisionRef",
      "requestIdempotencyKey",
      "correlationRef",
      "reasonCode",
      "requestedAtomicity",
      "processorExecutionId",
    ] as const;
    if (
      fields.some(
        (field) => (existing[field] ?? null) !== (data[field] ?? null),
      )
    ) {
      throw new IntelligencePersistenceError(
        "IDEMPOTENCY_CONFLICT",
        "Action idempotency identity was replayed with different content",
      );
    }
  }

  private async resolveSubjectId(
    tx: Prisma.TransactionClient,
    data: ActionWrite,
  ): Promise<string> {
    if (data.subjectId) {
      const subject = await tx.intelligenceSubject.findUnique({
        where: {
          id_brandId: { id: data.subjectId, brandId: data.brandId },
        },
        select: { id: true },
      });
      if (!subject) {
        throw new IntelligencePersistenceError(
          "TENANCY_VIOLATION",
          "Action subject does not belong to the requested Brand",
        );
      }
      return subject.id;
    }
    if (data.processorExecutionId) {
      const processor =
        await tx.intelligenceProcessorExecution.findUniqueOrThrow({
          where: { id: data.processorExecutionId },
          select: { brandId: true, subjectId: true },
        });
      if (processor.brandId !== data.brandId) {
        throw new IntelligencePersistenceError(
          "TENANCY_VIOLATION",
          "Action processor belongs to another Brand",
        );
      }
      return processor.subjectId;
    }
    return (await resolveIntelligenceSubject(tx, data.brandId)).id;
  }
}
