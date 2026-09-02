import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../../prisma/prisma.service";

export function runNotificationTransaction<T>(
  prisma: PrismaService,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction(callback);
  }
  // Directly constructed legacy unit-test doubles predate transactional APIs.
  return callback(prisma as unknown as Prisma.TransactionClient);
}
