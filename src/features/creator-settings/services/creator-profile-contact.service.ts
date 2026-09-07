import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreatorWorkspaceAction,
  CreatorWorkspaceActorContext,
} from "../../../shared/creator/creator-workspace-actor.contract";
import { normalizeCreatorContactPhone } from "../contact/creator-contact-phone";
import type {
  CreatorDefaultContactContract,
  CreatorProfileSettingsContract,
} from "../contracts/creator-profile-contact.contract";
import type {
  UpdateCreatorCanonicalProfileInput,
  UpsertCreatorDefaultContactInput,
} from "../schemas/creator-profile-contact.schema";

type CanonicalCreatorContext = {
  profile: {
    id: string;
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    primaryRegion: string;
    user: { name: string | null; email: string };
  };
  workspace: {
    id: string;
    ownerProfileId: string;
    organizationId: string;
    organization: { name: string };
  };
};

@Injectable()
export class CreatorProfileContactService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorProfileSettingsContract> {
    assertAction(actor, "WORKSPACE_PROFILE_READ");
    const context = await this.loadCanonicalContext(actor);
    return mapProfile(actor, context);
  }

  async updateProfile(
    actor: CreatorWorkspaceActorContext,
    input: UpdateCreatorCanonicalProfileInput,
  ): Promise<CreatorProfileSettingsContract> {
    assertAction(actor, "WORKSPACE_PROFILE_MANAGE");
    await this.loadCanonicalContext(actor);
    if (
      input.userName !== undefined &&
      actor.actorUserId !== actor.subjectOwnerUserId
    ) {
      throw new ForbiddenException(
        "Team Managers cannot modify the Owner's personal account name.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.userName !== undefined) {
        await tx.user.update({
          where: { id: actor.subjectOwnerUserId },
          data: { name: input.userName },
        });
      }

      const profileData: Prisma.CreatorProfileUpdateInput = {};
      if (input.displayName !== undefined) {
        profileData.displayName = input.displayName;
      }
      if (input.avatarUrl !== undefined) {
        profileData.avatarUrl = input.avatarUrl;
      }
      if (input.primaryRegion !== undefined) {
        profileData.primaryRegion = input.primaryRegion;
      }
      if (Object.keys(profileData).length > 0) {
        await tx.creatorProfile.update({
          where: { id: actor.subjectCreatorProfileId },
          data: profileData,
        });
      }

      if (input.organizationName !== undefined) {
        await tx.organization.update({
          where: { id: actor.organizationId },
          data: { name: input.organizationName },
        });
      }
    });

    return this.getProfile(actor);
  }

  async getDefaultContact(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorDefaultContactContract> {
    assertAction(actor, "CONTACT_READ");
    await this.loadCanonicalContext(actor);
    const contact = await this.prisma.creatorShippingAddress.findFirst({
      where: {
        creatorProfileId: actor.subjectCreatorProfileId,
        isDefault: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });

    return {
      actor_role: actor.actorRole,
      allowed_actions: actor.allowedActions,
      default_contact: contact ? mapContact(contact) : null,
    };
  }

  async upsertDefaultContact(
    actor: CreatorWorkspaceActorContext,
    input: UpsertCreatorDefaultContactInput,
  ): Promise<CreatorDefaultContactContract> {
    assertAction(actor, "CONTACT_MANAGE");
    await this.loadCanonicalContext(actor);
    const phone = normalizeCreatorContactPhone(
      input.phoneCountryCallingCode,
      input.phoneNationalNumber,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`creator-default-contact:${actor.subjectCreatorProfileId}`}, 0))::text`;
      const current = await tx.creatorShippingAddress.findFirst({
        where: {
          creatorProfileId: actor.subjectCreatorProfileId,
          isDefault: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      });
      const data = {
        recipientName: input.recipientName,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        stateRegion: input.stateRegion ?? null,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        phone: phone?.e164 ?? null,
        phoneCountryCallingCode: phone?.countryCallingCode ?? null,
        phoneNationalNumber: phone?.nationalNumber ?? null,
        phoneE164: phone?.e164 ?? null,
        deliveryInstructionsNarrative: input.deliveryInstructions ?? null,
        isDefault: true,
      };

      const saved = current
        ? await tx.creatorShippingAddress.update({
            where: { id: current.id },
            data,
          })
        : await tx.creatorShippingAddress.create({
            data: {
              creatorProfileId: actor.subjectCreatorProfileId,
              ...data,
            },
          });

      await tx.creatorShippingAddress.updateMany({
        where: {
          creatorProfileId: actor.subjectCreatorProfileId,
          isDefault: true,
          id: { not: saved.id },
        },
        data: { isDefault: false },
      });
    });

    return this.getDefaultContact(actor);
  }

  private async loadCanonicalContext(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CanonicalCreatorContext> {
    const [profile, workspace] = await Promise.all([
      this.prisma.creatorProfile.findUnique({
        where: { id: actor.subjectCreatorProfileId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          avatarUrl: true,
          primaryRegion: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.creatorWorkspace.findUnique({
        where: { id: actor.workspaceId },
        select: {
          id: true,
          ownerProfileId: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
    ]);

    if (
      !profile ||
      !workspace ||
      profile.userId !== actor.subjectOwnerUserId ||
      workspace.ownerProfileId !== actor.subjectCreatorProfileId ||
      workspace.organizationId !== actor.organizationId
    ) {
      throw new ConflictException({
        code: "CREATOR_ACTOR_SUBJECT_CONTEXT_INCONSISTENT",
        message: "Creator actor and subject context is inconsistent.",
      });
    }

    return { profile, workspace };
  }
}

function assertAction(
  actor: CreatorWorkspaceActorContext,
  action: CreatorWorkspaceAction,
): void {
  if (!actor.allowedActions.includes(action)) {
    throw new ForbiddenException(`Creator action ${action} is not permitted.`);
  }
}

function mapProfile(
  actor: CreatorWorkspaceActorContext,
  context: CanonicalCreatorContext,
): CreatorProfileSettingsContract {
  return {
    actor_role: actor.actorRole,
    allowed_actions: actor.allowedActions,
    can_manage_personal_name: actor.actorUserId === actor.subjectOwnerUserId,
    profile: {
      user_name: context.profile.user.name,
      display_name: context.profile.displayName,
      email: context.profile.user.email,
      avatar_url: context.profile.avatarUrl,
      primary_region: context.profile.primaryRegion,
    },
    organization: {
      organization_id: context.workspace.organizationId,
      name: context.workspace.organization.name,
    },
  };
}

function mapContact(contact: {
  id: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateRegion: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
  phoneCountryCallingCode: string | null;
  phoneNationalNumber: string | null;
  phoneE164: string | null;
  deliveryInstructionsNarrative: string | null;
  updatedAt: Date;
}): NonNullable<CreatorDefaultContactContract["default_contact"]> {
  const structuredPhone =
    contact.phoneCountryCallingCode &&
    contact.phoneNationalNumber &&
    contact.phoneE164
      ? {
          country_calling_code: contact.phoneCountryCallingCode,
          national_number: contact.phoneNationalNumber,
          e164: contact.phoneE164,
        }
      : null;

  return {
    contact_id: contact.id,
    recipient_name: contact.recipientName,
    address_line_1: contact.addressLine1,
    address_line_2: contact.addressLine2,
    city: contact.city,
    state_region: contact.stateRegion,
    postal_code: contact.postalCode,
    country_code: contact.countryCode,
    phone: structuredPhone,
    has_legacy_unstructured_phone: Boolean(contact.phone && !structuredPhone),
    delivery_instructions: contact.deliveryInstructionsNarrative,
    updated_at: contact.updatedAt.toISOString(),
  };
}
