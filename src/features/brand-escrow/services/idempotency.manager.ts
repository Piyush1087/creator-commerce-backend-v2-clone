import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class IdempotencyManager {
  constructor(private readonly prisma: PrismaService) {}

  async registerIntent(key: string, path: string): Promise<void> {
    try {
      await this.prisma.idempotencyRegistry.create({
        data: {
          idempotencyKey: key,
          requestPath: path,
          executionState: "IN_FLIGHT",
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.idempotencyRegistry.findUnique({
          where: { idempotencyKey: key },
        });

        if (existing?.executionState === "IN_FLIGHT") {
          throw new ConflictException(
            "An identical operation is already in progress. Retry shortly.",
          );
        }

        throw new BadRequestException(
          "This idempotency key has already been used.",
        );
      }
      throw error;
    }
  }

  async finalizeExecution(
    key: string,
    payloadResponse: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.idempotencyRegistry.update({
      where: { idempotencyKey: key },
      data: {
        executionState: "COMPLETED",
        cachedResponse: payloadResponse as Prisma.InputJsonValue,
      },
    });
  }

  async rollbackIntent(key: string): Promise<void> {
    await this.prisma.idempotencyRegistry.deleteMany({
      where: {
        idempotencyKey: key,
        executionState: "IN_FLIGHT",
      },
    });
  }
}
