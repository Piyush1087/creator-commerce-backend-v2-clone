import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { CreatorSettingsController } from "./creator-settings.controller";

const actor: CreatorWorkspaceActorContext = {
  actorUserId: "owner-user",
  actorMembershipId: "owner-membership",
  actorRole: "OWNER",
  workspaceId: "workspace",
  organizationId: "organization",
  subjectCreatorProfileId: "creator-profile",
  subjectOwnerUserId: "owner-user",
  allowedActions: ["CONTACT_READ", "CONTACT_MANAGE"],
};

const request = {
  user: {
    id: "owner-user",
    email: "owner@example.test",
    name: "Owner",
    role: UserRole.CREATOR,
    organizationId: "organization",
  },
} as RequestWithAuthUser;

describe("C-05 legacy Settings adapters", () => {
  it("fails closed instead of erasing an unresolved legacy phone", async () => {
    const upsertDefaultContact = vi.fn();
    const controller = new CreatorSettingsController(
      { resolve: vi.fn().mockResolvedValue(actor) } as never,
      {
        getDefaultContact: vi.fn().mockResolvedValue({
          actor_role: "OWNER",
          allowed_actions: actor.allowedActions,
          default_contact: {
            contact_id: "contact",
            recipient_name: "Owner",
            address_line_1: "1 Existing Road",
            address_line_2: null,
            city: "Mumbai",
            state_region: "Maharashtra",
            postal_code: "400001",
            country_code: "IN",
            phone: null,
            has_legacy_unstructured_phone: true,
            delivery_instructions: null,
            updated_at: "2026-09-01T00:00:00.000Z",
          },
        }),
        upsertDefaultContact,
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.upsertShipping(request, {
        recipientLegalName: "Owner",
        streetAddressLine1: "2 Updated Road",
        streetAddressLine2: null,
        city: "Mumbai",
        stateProvince: "Maharashtra",
        postalCodeZip: "400001",
        countryIsoCode: "IN",
        deliveryInstructionsNarrative: null,
        isPrimaryDestination: true,
      }),
    ).rejects.toMatchObject({
      response: { code: "CREATOR_CONTACT_PHONE_RECONCILIATION_REQUIRED" },
    } satisfies Partial<ConflictException>);
    expect(upsertDefaultContact).not.toHaveBeenCalled();
  });
});
