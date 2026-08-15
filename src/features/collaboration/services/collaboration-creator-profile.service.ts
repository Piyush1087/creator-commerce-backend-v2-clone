import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { UpsertCreatorShippingAddressDto } from "../dto/collaboration-actions.dto";

@Injectable()
export class CollaborationCreatorProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCreator(user: AuthUser) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }

  private async ensureProfile(userId: string) {
    const existing = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.creatorProfile.create({
      data: { userId },
    });
  }

  async upsertShippingAddress(
    user: AuthUser,
    dto: UpsertCreatorShippingAddressDto,
  ) {
    this.assertCreator(user);
    const profile = await this.ensureProfile(user.id);

    await this.prisma.creatorShippingAddress.updateMany({
      where: { creatorProfileId: profile.id },
      data: { isDefault: false },
    });

    const row = await this.prisma.creatorShippingAddress.create({
      data: {
        creatorProfileId: profile.id,
        recipientName: dto.recipient_name,
        addressLine1: dto.address_line_1,
        addressLine2: dto.address_line_2,
        city: dto.city,
        stateRegion: dto.state_region,
        postalCode: dto.postal_code,
        countryCode: dto.country_code ?? "IN",
        phone: dto.phone,
        isDefault: true,
      },
    });

    return {
      shipping_address_id: row.id,
      recipient_name: row.recipientName,
      city: row.city,
      is_default: row.isDefault,
    };
  }

  async getCreatorProfile(user: AuthUser) {
    this.assertCreator(user);
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
      include: {
        bankDetails: { where: { isPrimary: true }, take: 1 },
        shippingAddresses: { where: { isDefault: true }, take: 1 },
      },
    });
    if (!profile) {
      throw new NotFoundException("Creator profile not found");
    }
    return profile;
  }
}
