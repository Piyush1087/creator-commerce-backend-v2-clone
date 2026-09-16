import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";

export const CreatorBusinessEmailProjectionSchema = z
  .object({
    state: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    email: z.string().email().max(320).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.state === "AVAILABLE") !== (value.email !== null))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business email availability must match its value",
      });
  });

/** Settings-owned, read-only projection for explicitly authorized consumers. */
@Injectable()
export class CreatorBusinessEmailProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async readForCanonicalCreator(creatorProfileId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      select: { user: { select: { email: true } } },
    });
    const parsed = z.string().email().max(320).safeParse(profile?.user.email);
    return CreatorBusinessEmailProjectionSchema.parse(
      parsed.success
        ? { state: "AVAILABLE", email: parsed.data }
        : { state: "UNAVAILABLE", email: null },
    );
  }
}
