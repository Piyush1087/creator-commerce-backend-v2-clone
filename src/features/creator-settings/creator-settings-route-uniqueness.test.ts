import { RequestMethod, type Type } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { CreatorProfileContactController } from "./creator-profile-contact.controller";
import { CreatorSettingsController } from "./creator-settings.controller";
import { CreatorInstagramSettingsController } from "./instagram/creator-instagram-settings.controller";
import { CreatorPayoutSettingsController } from "./payouts/creator-payout-settings.controller";
import { CreatorTeamInvitationsController } from "./team/creator-team-invitations.controller";
import { CreatorTeamController } from "./team/creator-team.controller";
import { CreatorWorkspaceActorController } from "./team/creator-workspace-actor.controller";

const controllers: Type[] = [
  CreatorProfileContactController,
  CreatorSettingsController,
  CreatorInstagramSettingsController,
  CreatorPayoutSettingsController,
  CreatorTeamController,
  CreatorTeamInvitationsController,
  CreatorWorkspaceActorController,
];

function normalizeRoute(...parts: string[]): string {
  return `/${parts
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .map((part) => (part.startsWith(":") ? ":parameter" : part))
    .join("/")}`;
}

function routeInventory(): string[] {
  return controllers.flatMap((controller) => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) as
      | string
      | undefined;
    return Object.getOwnPropertyNames(controller.prototype).flatMap(
      (methodName) => {
        if (methodName === "constructor") return [];
        const handler = Object.getOwnPropertyDescriptor(
          controller.prototype,
          methodName,
        )?.value as unknown;
        if (typeof handler !== "function") return [];
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        if (requestMethod === undefined) return [];
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as
          | string
          | undefined;
        return [
          `${RequestMethod[requestMethod]} ${normalizeRoute(
            controllerPath ?? "",
            methodPath ?? "",
          )}`,
        ];
      },
    );
  });
}

describe("C-05 Creator Settings route convergence", () => {
  it("has no duplicate HTTP method/path authority", () => {
    const routes = routeInventory();
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("exposes the canonical profile, contact, Team, Instagram, and payout routes", () => {
    expect(routeInventory()).toEqual(
      expect.arrayContaining([
        "GET /api/v1/creator/settings/profile",
        "PATCH /api/v1/creator/settings/profile",
        "GET /api/v1/creator/settings/contact",
        "PUT /api/v1/creator/settings/contact",
        "GET /api/v1/creator/settings/team",
        "DELETE /api/v1/creator/settings/team/invitations/:parameter",
        "GET /api/v1/creator/settings/instagram",
        "GET /api/v1/creator/settings/payouts",
      ]),
    );
  });
});
