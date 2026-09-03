import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreatorProfileContactService } from "./creator-profile-contact.service";

const managerActor: CreatorWorkspaceActorContext = {
  actorUserId: "actor-user",
  actorMembershipId: "manager-membership",
  actorRole: "MANAGER",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  subjectCreatorProfileId: "creator-profile-1",
  subjectOwnerUserId: "owner-user-1",
  allowedActions: [
    "WORKSPACE_PROFILE_READ",
    "WORKSPACE_PROFILE_MANAGE",
    "CONTACT_READ",
    "CONTACT_MANAGE",
  ],
};

const canonicalProfile = {
  id: "creator-profile-1",
  userId: "owner-user-1",
  displayName: "Ava Creates",
  avatarUrl: null,
  primaryRegion: "IN",
  user: { name: "Ava Creator", email: "owner@example.test" },
};

const canonicalWorkspace = {
  id: "workspace-1",
  ownerProfileId: "creator-profile-1",
  organizationId: "organization-1",
  organization: { name: "Ava Studio" },
};

function createHarness() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: { update: vi.fn() },
    creatorProfile: { update: vi.fn() },
    organization: { update: vi.fn() },
    creatorShippingAddress: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const prisma = {
    creatorProfile: { findUnique: vi.fn().mockResolvedValue(canonicalProfile) },
    creatorWorkspace: {
      findUnique: vi.fn().mockResolvedValue(canonicalWorkspace),
    },
    creatorShippingAddress: { findFirst: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    prisma,
    tx,
    service: new CreatorProfileContactService(
      prisma as unknown as PrismaService,
    ),
  };
}

describe("CreatorProfileContactService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects canonical Owner subject and Organization fields", async () => {
    const { service } = createHarness();

    await expect(service.getProfile(managerActor)).resolves.toEqual({
      actor_role: "MANAGER",
      allowed_actions: managerActor.allowedActions,
      can_manage_personal_name: false,
      profile: {
        user_name: "Ava Creator",
        display_name: "Ava Creates",
        email: "owner@example.test",
        avatar_url: null,
        primary_region: "IN",
      },
      organization: {
        organization_id: "organization-1",
        name: "Ava Studio",
      },
    });
  });

  it("fails closed when the direct actor action is absent", async () => {
    const { service, prisma } = createHarness();
    const assistantActor: CreatorWorkspaceActorContext = {
      ...managerActor,
      actorRole: "ASSISTANT",
      allowedActions: [],
    };

    await expect(service.getProfile(assistantActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.creatorProfile.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a mismatched Owner subject instead of editing actor identity", async () => {
    const { service, prisma } = createHarness();
    prisma.creatorProfile.findUnique.mockResolvedValue({
      ...canonicalProfile,
      userId: "different-owner-user",
    });

    await expect(
      service.updateProfile(managerActor, { userName: "Changed" }),
    ).rejects.toMatchObject({
      response: { code: "CREATOR_ACTOR_SUBJECT_CONTEXT_INCONSISTENT" },
    });
  });

  it("updates only canonical User, CreatorProfile, and Organization targets", async () => {
    const { service, tx } = createHarness();
    const ownerActor: CreatorWorkspaceActorContext = {
      ...managerActor,
      actorUserId: managerActor.subjectOwnerUserId,
      actorRole: "OWNER",
    };

    await service.updateProfile(ownerActor, {
      userName: "Ava N. Creator",
      displayName: "Ava Makes",
      avatarUrl: "https://cdn.example.test/ava.png",
      primaryRegion: "US",
      organizationName: "Ava Studio LLC",
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "owner-user-1" },
      data: { name: "Ava N. Creator" },
    });
    expect(tx.creatorProfile.update).toHaveBeenCalledWith({
      where: { id: "creator-profile-1" },
      data: {
        displayName: "Ava Makes",
        avatarUrl: "https://cdn.example.test/ava.png",
        primaryRegion: "US",
      },
    });
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: "organization-1" },
      data: { name: "Ava Studio LLC" },
    });
  });

  it("prevents a Manager from mutating the Owner's personal User name", async () => {
    const { service, tx } = createHarness();

    await expect(
      service.updateProfile(managerActor, {
        userName: "Manager Changed Owner",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();

    await service.updateProfile(managerActor, {
      displayName: "Manager-updated Creator display",
      organizationName: "Manager-updated Organization",
    });
    expect(tx.creatorProfile.update).toHaveBeenCalled();
    expect(tx.organization.update).toHaveBeenCalled();
  });

  it("stores normalized structured phone and mirrors E.164 only for compatibility", async () => {
    const { service, tx, prisma } = createHarness();
    tx.creatorShippingAddress.findFirst.mockResolvedValue({ id: "contact-1" });
    tx.creatorShippingAddress.update.mockResolvedValue({ id: "contact-1" });
    prisma.creatorShippingAddress.findFirst.mockResolvedValue({
      id: "contact-1",
      recipientName: "Ava Creator",
      addressLine1: "18 Address Road",
      addressLine2: null,
      city: "Bengaluru",
      stateRegion: "Karnataka",
      postalCode: "560001",
      countryCode: "IN",
      phone: "+919876543210",
      phoneCountryCallingCode: "+91",
      phoneNationalNumber: "9876543210",
      phoneE164: "+919876543210",
      deliveryInstructionsNarrative: "Reception",
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    const result = await service.upsertDefaultContact(managerActor, {
      recipientName: "Ava Creator",
      addressLine1: "18 Address Road",
      addressLine2: null,
      city: "Bengaluru",
      stateRegion: "Karnataka",
      postalCode: "560001",
      countryCode: "IN",
      phoneCountryCallingCode: "+91",
      phoneNationalNumber: "98765 43210",
      deliveryInstructions: "Reception",
    });

    expect(tx.creatorShippingAddress.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: expect.objectContaining({
        phone: "+919876543210",
        phoneCountryCallingCode: "+91",
        phoneNationalNumber: "9876543210",
        phoneE164: "+919876543210",
        isDefault: true,
      }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.calls[0]).toContain(
      "creator-default-contact:creator-profile-1",
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.creatorShippingAddress.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.creatorShippingAddress.updateMany).toHaveBeenCalledWith({
      where: {
        creatorProfileId: "creator-profile-1",
        isDefault: true,
        id: { not: "contact-1" },
      },
      data: { isDefault: false },
    });
    expect(result.default_contact?.phone?.e164).toBe("+919876543210");
    expect(result.default_contact?.has_legacy_unstructured_phone).toBe(false);
  });

  it("does not expose a legacy unstructured phone value", async () => {
    const { service, prisma } = createHarness();
    prisma.creatorShippingAddress.findFirst.mockResolvedValue({
      id: "legacy-contact",
      recipientName: "Legacy Creator",
      addressLine1: "Long Address Line",
      addressLine2: null,
      city: "Mumbai",
      stateRegion: "Maharashtra",
      postalCode: "400001",
      countryCode: "IN",
      phone: "legacy free text",
      phoneCountryCallingCode: null,
      phoneNationalNumber: null,
      phoneE164: null,
      deliveryInstructionsNarrative: null,
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    const result = await service.getDefaultContact(managerActor);

    expect(result.default_contact?.phone).toBeNull();
    expect(result.default_contact?.has_legacy_unstructured_phone).toBe(true);
    expect(JSON.stringify(result)).not.toContain("legacy free text");
  });
});
