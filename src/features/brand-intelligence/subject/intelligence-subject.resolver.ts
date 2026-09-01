import {
  IntelligenceSubjectType,
  Prisma,
  type IntelligenceSubject,
} from "@prisma/client";

import { IntelligencePersistenceError } from "../domain/intelligence-persistence.error";

export type IntelligenceSubjectSelector =
  | Readonly<{ type: "BRAND" }>
  | Readonly<{ type: "OFFERING"; ref: string }>;

type SubjectClient = Pick<
  Prisma.TransactionClient,
  "intelligenceSubject" | "offering"
>;

async function createOrReadSubject(
  client: SubjectClient,
  input: Readonly<{
    brandId: string;
    subjectType: IntelligenceSubjectType;
    subjectRef: string;
    offeringId?: string;
  }>,
): Promise<IntelligenceSubject> {
  const identity = {
    brandId: input.brandId,
    subjectType: input.subjectType,
    subjectRef: input.subjectRef,
  };
  const existing = await client.intelligenceSubject.findUnique({
    where: { brandId_subjectType_subjectRef: identity },
  });
  if (existing) return existing;
  try {
    return await client.intelligenceSubject.create({
      data: {
        ...identity,
        offeringId: input.offeringId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return client.intelligenceSubject.findUniqueOrThrow({
        where: { brandId_subjectType_subjectRef: identity },
      });
    }
    throw error;
  }
}

export async function resolveIntelligenceSubject(
  client: SubjectClient,
  brandId: string,
  selector: IntelligenceSubjectSelector = { type: "BRAND" },
): Promise<IntelligenceSubject> {
  if (selector.type === "OFFERING") {
    const offering = await client.offering.findUnique({
      where: {
        brandProfileId_id: { brandProfileId: brandId, id: selector.ref },
      },
      select: { id: true },
    });
    if (!offering) {
      throw new IntelligencePersistenceError(
        "TENANCY_VIOLATION",
        "Offering Intelligence subject must be an exact Offering of the requested Brand",
      );
    }
    return createOrReadSubject(client, {
      brandId,
      subjectType: IntelligenceSubjectType.OFFERING,
      subjectRef: offering.id,
      offeringId: offering.id,
    });
  }

  return createOrReadSubject(client, {
    brandId,
    subjectType: IntelligenceSubjectType.BRAND,
    subjectRef: brandId,
  });
}
