import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type IntelligenceAction,
  type IntelligenceComponentTransition,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";

export type ActionWrite = Omit<
  Prisma.IntelligenceActionUncheckedCreateInput,
  "createdAt"
>;
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
    const existing = await tx.intelligenceAction.findUnique({
      where: {
        brandId_actionType_requestIdempotencyKey: {
          brandId: data.brandId,
          actionType: data.actionType,
          requestIdempotencyKey: data.requestIdempotencyKey,
        },
      },
    });
    if (existing) {
      this.assertSameAction(existing, data);
      return { action: existing, replayed: true };
    }

    try {
      return {
        action: await tx.intelligenceAction.create({ data }),
        replayed: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await tx.intelligenceAction.findUniqueOrThrow({
          where: {
            brandId_actionType_requestIdempotencyKey: {
              brandId: data.brandId,
              actionType: data.actionType,
              requestIdempotencyKey: data.requestIdempotencyKey,
            },
          },
        });
        this.assertSameAction(raced, data);
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
}
