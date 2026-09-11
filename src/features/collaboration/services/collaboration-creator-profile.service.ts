import {
  ForbiddenException,
  GoneException,
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
    void user;
    void dto;
    throw new GoneException("Use Creator Settings contact destination");
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
