import "reflect-metadata";
import { PrismaClient, type User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPasswordAsync } from "../../shared/crypto/password.util";
import { portfolioTestOwner } from "../creator-portfolio/testing/portfolio.fixture";

describe.skipIf(process.env.CREATOR_MEDIA_KIT_BROWSER_FIXTURE !== "true")(
  "Creator Media Kit V3 bounded browser fixture",
  () => {
    const db = new PrismaClient();

    beforeAll(async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "127.0.0.1" ||
        !["/media_kit_v3", "/media_kit_v3_upgrade"].includes(route.pathname)
      )
        throw new Error("TASK_OWNED_MEDIA_KIT_DATABASE_REQUIRED");
      if (
        !process.env.CREATOR_MEDIA_KIT_FIXTURE_PASSWORD ||
        !process.env.CREATOR_MEDIA_KIT_FIXTURE_MANIFEST
      )
        throw new Error("BOUNDED_BROWSER_FIXTURE_INPUT_REQUIRED");
      await db.$connect();
    });

    afterAll(async () => db.$disconnect());

    it("creates only synthetic users and admission fences through accepted test builders", async () => {
      const passwordHash = await hashPasswordAsync(
        process.env.CREATOR_MEDIA_KIT_FIXTURE_PASSWORD!,
      );
      const attachPassword = async (user: Pick<User, "id">) => {
        await db.userAuthMethod.upsert({
          where: { userId_type: { userId: user.id, type: "PASSWORD" } },
          create: {
            userId: user.id,
            type: "PASSWORD",
            credentialHash: passwordHash,
          },
          update: { credentialHash: passwordHash, disabledAt: null },
        });
      };

      const live = await portfolioTestOwner(db);
      const draft = await portfolioTestOwner(db);
      await db.creatorProfile.update({
        where: { id: live.profile.id },
        data: {
          displayName: "Media Kit Fixture Creator",
          instagramHandle: "fixture_creator",
        },
      });
      for (const actor of [
        live.owner,
        live.manager,
        live.assistant,
        draft.owner,
      ])
        await attachPassword(actor.auth);

      const inactiveUser = await db.user.create({
        data: {
          email: `media-kit-inactive-${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: live.actor.organizationId,
          emailVerifiedAt: new Date(),
        },
      });
      await attachPassword(inactiveUser);
      await db.creatorWorkspaceMember.create({
        data: {
          workspaceId: live.workspace.id,
          userId: inactiveUser.id,
          associatedEmail: inactiveUser.email,
          securityRole: "ASSISTANT",
          isActive: false,
        },
      });

      const createBrand = async (verified: boolean, label: string) => {
        const organization = await db.organization.create({
          data: { name: label, kind: "BRAND" },
        });
        const profile = await db.brandProfile.create({
          data: {
            organizationId: organization.id,
            domain: `${randomUUID()}.example.test`,
            name: label,
            industry: "D2C",
            brandValues: [],
            policyFlags: [],
            isVerified: verified,
            verifiedAt: verified ? new Date() : null,
          },
        });
        const user = await db.user.create({
          data: {
            email: `mk-brand-${randomUUID()}@example.test`,
            role: "BRAND",
            authState: "ACTIVE",
            organizationId: organization.id,
            emailVerifiedAt: new Date(),
          },
        });
        await attachPassword(user);
        await db.brandTeamMember.create({
          data: {
            brandProfileId: profile.id,
            userId: user.id,
            role: "BRAND_OWNER",
            isActive: true,
          },
        });
        return { user, profile };
      };
      const verified = await createBrand(true, "Verified Fixture Brand");
      const unverified = await createBrand(false, "Unverified Fixture Brand");
      const foreign = await createBrand(true, "Foreign Fixture Brand");

      const manifest = {
        creatorOwnerEmail: live.owner.auth.email,
        creatorManagerEmail: live.manager.auth.email,
        creatorAssistantEmail: live.assistant.auth.email,
        draftCreatorOwnerEmail: draft.owner.auth.email,
        inactiveCreatorEmail: inactiveUser.email,
        verifiedBrandEmail: verified.user.email,
        unverifiedBrandEmail: unverified.user.email,
        foreignBrandEmail: foreign.user.email,
        verifiedBrandProfileId: verified.profile.id,
        foreignBrandProfileId: foreign.profile.id,
      };
      await writeFile(
        process.env.CREATOR_MEDIA_KIT_FIXTURE_MANIFEST!,
        JSON.stringify(manifest),
        { encoding: "utf8", flag: "wx" },
      );
      expect(Object.keys(manifest)).toHaveLength(10);
    });
  },
);
