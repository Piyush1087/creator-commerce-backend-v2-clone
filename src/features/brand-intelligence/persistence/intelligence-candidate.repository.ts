import { Injectable } from "@nestjs/common";
import {
  IntelligenceComponentCandidateStatus,
  Prisma,
  type IntelligenceComponentCandidate,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export type CandidateWrite = Omit<
  Prisma.IntelligenceComponentCandidateUncheckedCreateInput,
  "createdAt" | "resolvedAt" | "resolutionActionId" | "status"
>;

@Injectable()
export class IntelligenceCandidateRepository {
  constructor(private readonly prisma: PrismaService) {}

  getById(id: string): Promise<IntelligenceComponentCandidate | null> {
    return this.prisma.intelligenceComponentCandidate.findUnique({
      where: { id },
    });
  }

  async lockById(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<IntelligenceComponentCandidate | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "component_candidate_id" AS "id"
      FROM "intelligence_component_candidates"
      WHERE "component_candidate_id" = ${id}
      FOR UPDATE
    `);
    if (!rows[0]) return null;
    return tx.intelligenceComponentCandidate.findUnique({
      where: { id: rows[0].id },
    });
  }

  async createOrGetPending(
    tx: Prisma.TransactionClient,
    data: CandidateWrite,
  ): Promise<IntelligenceComponentCandidate> {
    const existing = await tx.intelligenceComponentCandidate.findFirst({
      where: {
        OR: [
          {
            candidateComponentGenerationId: data.candidateComponentGenerationId,
          },
          {
            currentComponentId: data.currentComponentId,
            basisCurrentComponentGenerationId:
              data.basisCurrentComponentGenerationId,
            candidateValueHash: data.candidateValueHash,
            status: IntelligenceComponentCandidateStatus.PENDING,
          },
        ],
      },
    });
    if (existing) return existing;

    try {
      return await tx.intelligenceComponentCandidate.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return tx.intelligenceComponentCandidate.findFirstOrThrow({
          where: {
            OR: [
              {
                candidateComponentGenerationId:
                  data.candidateComponentGenerationId,
              },
              {
                currentComponentId: data.currentComponentId,
                basisCurrentComponentGenerationId:
                  data.basisCurrentComponentGenerationId,
                candidateValueHash: data.candidateValueHash,
                status: IntelligenceComponentCandidateStatus.PENDING,
              },
            ],
          },
        });
      }
      throw error;
    }
  }

  resolvePending(
    tx: Prisma.TransactionClient,
    candidateId: string,
    status: Exclude<IntelligenceComponentCandidateStatus, "PENDING">,
    resolutionActionId: string,
  ): Promise<Prisma.BatchPayload> {
    return tx.intelligenceComponentCandidate.updateMany({
      where: {
        id: candidateId,
        status: IntelligenceComponentCandidateStatus.PENDING,
      },
      data: { status, resolvedAt: new Date(), resolutionActionId },
    });
  }

  obsoletePendingBasis(
    tx: Prisma.TransactionClient,
    currentComponentId: string,
    basisGenerationId: string,
    resolutionActionId: string,
    exceptCandidateId?: string,
  ): Promise<Prisma.BatchPayload> {
    return tx.intelligenceComponentCandidate.updateMany({
      where: {
        currentComponentId,
        basisCurrentComponentGenerationId: basisGenerationId,
        status: IntelligenceComponentCandidateStatus.PENDING,
        ...(exceptCandidateId ? { id: { not: exceptCandidateId } } : {}),
      },
      data: {
        status: IntelligenceComponentCandidateStatus.OBSOLETE,
        resolvedAt: new Date(),
        resolutionActionId,
      },
    });
  }
}
