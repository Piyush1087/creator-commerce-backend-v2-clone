import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { CollaborationActorClass, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CollaborationAccessService } from "./services/collaboration-access.service";
import {
  confirmDefaultDestinationSchema,
  overrideDestinationSchema,
} from "./schemas/collaboration-destination-command.schema";
import { submitCreatorProposalSchema } from "./schemas/collaboration-commercial-command.schema";
import { appendCommandEvent } from "./utils/collaboration-command-support";

const creator = {
  id: "actor-user",
  role: UserRole.CREATOR,
} as any;

function actor(role: "OWNER" | "MANAGER" | "ASSISTANT" = "OWNER") {
  return {
    actorUserId: creator.id,
    actorMembershipId: "membership-1",
    actorRole: role,
    workspaceId: "workspace-1",
    organizationId: "organization-1",
    subjectCreatorProfileId: "profile-1",
    subjectOwnerUserId: "owner-user",
    allowedActions: [],
  } as const;
}

function accessHarness(role: "OWNER" | "MANAGER" | "ASSISTANT" = "OWNER") {
  const prisma = {
    collaboration: {
      findUnique: vi.fn().mockResolvedValue({
        id: "collaboration-1",
        creatorUserId: "owner-user",
        creatorProfileId: "profile-1",
        creatorWorkspaceId: "workspace-1",
      }),
    },
  } as any;
  const actors = { resolve: vi.fn().mockResolvedValue(actor(role)) } as any;
  return { service: new CollaborationAccessService(prisma, actors), actors };
}

describe("C04 Creator Team collaboration boundary", () => {
  it.each(["OWNER", "MANAGER"] as const)(
    "permits %s commands",
    async (role) => {
      const { service } = accessHarness(role);
      await expect(
        service.assertThreadForUser(creator, "collaboration-1", "COMMAND"),
      ).resolves.toMatchObject({ id: "collaboration-1" });
    },
  );

  it("limits Assistant to read and chat", async () => {
    const { service } = accessHarness("ASSISTANT");
    await expect(
      service.assertThreadForUser(creator, "collaboration-1", "CHAT"),
    ).resolves.toBeTruthy();
    await expect(
      service.assertThreadForUser(creator, "collaboration-1", "COMMAND"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not enumerate a different Creator subject", async () => {
    const { service, actors } = accessHarness();
    actors.resolve.mockResolvedValue({
      ...actor(),
      subjectCreatorProfileId: "other",
    });
    await expect(
      service.assertThreadForUser(creator, "collaboration-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("C04 bounded command contracts", () => {
  const envelope = { commandId: "command-1", expectedAggregateVersion: 1 };

  it("accepts a currency-bound first Creator proposal", () => {
    expect(
      submitCreatorProposalSchema.parse({
        ...envelope,
        proposedFee: 1250,
        currency: "inr",
      }),
    ).toMatchObject({ proposedFee: 1250, currency: "INR" });
  });

  it("rejects malformed proposal currency and negative value", () => {
    expect(
      submitCreatorProposalSchema.safeParse({
        ...envelope,
        proposedFee: -1,
        currency: "IN",
      }).success,
    ).toBe(false);
  });

  it("requires exact default-contact freshness evidence", () => {
    expect(
      confirmDefaultDestinationSchema.safeParse({
        ...envelope,
        sourceContactId: "bb762911-7f31-4c32-a251-985cc4aa1471",
        sourceContactUpdatedAt: "2026-09-06T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(confirmDefaultDestinationSchema.safeParse(envelope).success).toBe(
      false,
    );
  });

  it("accepts a Collaboration-only destination override", () => {
    expect(
      overrideDestinationSchema.safeParse({
        ...envelope,
        recipientName: "Creator",
        addressLine1: "1 Test Street",
        city: "Mumbai",
        postalCode: "400001",
        countryCode: "in",
      }).success,
    ).toBe(true);
  });
});

describe("C04 event audit and projection fan-out", () => {
  it("records the actual Team actor and three independent outbox projections", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const createMany = vi.fn().mockResolvedValue({ count: 3 });
    const tx = {
      collaboration: {
        findUnique: vi.fn().mockResolvedValue({
          creatorWorkspaceId: "workspace-1",
          creatorProfileId: "profile-1",
          creatorWorkspace: { organizationId: "organization-1" },
        }),
      },
      creatorWorkspaceMember: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "membership-1", securityRole: "MANAGER" }),
      },
      collaborationEvent: { create },
      collaborationProjectionOutbox: { createMany },
    } as any;
    await appendCommandEvent(tx, {
      collaborationId: "collaboration-1",
      eventType: "CREATOR_PROPOSAL_SUBMITTED",
      actorClass: CollaborationActorClass.CREATOR,
      actorUserId: "actor-user",
      commandId: "command-1",
      aggregateVersion: 2,
      requestFingerprint: "fingerprint",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorMembershipId: "membership-1",
          actorRole: "MANAGER",
          subjectCreatorProfileId: "profile-1",
        }),
      }),
    );
    expect(
      createMany.mock.calls[0][0].data.map((row: any) => row.projectionType),
    ).toEqual(["SYSTEM_MESSAGE", "NOTIFICATION", "SOCKET_INVALIDATION"]);
  });
});

describe("C04 legacy cutover", () => {
  it("routes legacy Brand application decisions to HTTP 410 before legacy mutation", () => {
    const source = readFileSync(
      "src/features/brand-uce/services/campaign-application.service.ts",
      "utf8",
    );
    const route = source.slice(
      source.indexOf("async routeDecision"),
      source.indexOf("syncLegacyApplicantsCompatibilityCommand"),
    );
    expect(route).toContain("C04_LEGACY_APPLICATION_WRITER_RETIRED");
    expect(route).not.toContain("this.approve(");
    expect(route).not.toContain("this.reject(");
  });
});
