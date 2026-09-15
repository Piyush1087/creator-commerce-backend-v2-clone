import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { UpsertCreatorDefaultContactSchema } from "../schemas/creator-profile-contact.schema";

/** Settings-owned validity projection; no address or contact material crosses it. */
@Injectable()
export class CreatorShippingReadinessAdapter {
  constructor(private readonly prisma: PrismaService) {}
  readCurrent(input: { creatorProfileId: string }) {
    return this.readInTransaction(this.prisma, input.creatorProfileId);
  }
  async readInTransaction(
    tx: Pick<Prisma.TransactionClient, "creatorShippingAddress">,
    creatorProfileId: string,
  ): Promise<"READY" | "NEEDS_SETUP"> {
    const address = await tx.creatorShippingAddress.findFirst({
      where: { creatorProfileId, isDefault: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        recipientName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        countryCode: true,
        phoneCountryCallingCode: true,
        phoneNationalNumber: true,
      },
    });
    return address &&
      UpsertCreatorDefaultContactSchema.safeParse(address).success
      ? "READY"
      : "NEEDS_SETUP";
  }
}
