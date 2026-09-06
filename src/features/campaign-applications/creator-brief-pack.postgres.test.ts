import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applicationHarness,
  creatorFixture,
  brandFixture,
  campaignFixture,
  teamFixture,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CreatorBriefPackService } from "./creator-brief-pack.service";
import { projectCreatorBriefPack } from "./creator-brief-pack.projection";

describe.skipIf(process.env.C03_P5_DATABASE_TEST !== "true")(
  "P5 immutable Brief Pack PostgreSQL",
  () => {
    const prisma = new PrismaClient({ transactionOptions: { timeout: 30000 } });
    const h = applicationHarness(prisma);
    const packs = new CreatorBriefPackService(
      prisma as unknown as PrismaService,
      h.actors,
    );
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (url.hostname !== "localhost" || url.pathname !== "/c03_p5")
        throw new Error("P5_DISPOSABLE_DATABASE_REQUIRED");
      await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const owner = await creatorFixture(prisma),
        brand = await brandFixture(prisma);
      const c = await campaignFixture(prisma, brand.brand.id);
      const result = await h.submit.submit(
        owner.user,
        c.campaign.id,
        c.selection(),
        randomUUID(),
      );
      return { owner, brand, c, applicationId: result.applicationId };
    }
    it("uses the immutable submitted evidence for every current role and historical status", async () => {
      const f = await fixture();
      const original = await packs.get(f.owner.user, f.applicationId);
      expect(original.commercial).toMatchObject({
        compensationModel: "FIXED",
        offer: "100",
        currency: "INR",
        brandSupportEstimatedValue: null,
      });
      for (const role of ["MANAGER", "ASSISTANT"] as const) {
        const teammate = await teamFixture(prisma, f.owner, role);
        expect(await packs.get(teammate.user, f.applicationId)).toEqual(
          original,
        );
        await prisma.creatorWorkspaceMember.update({
          where: { id: teammate.member.id },
          data: { isActive: false },
        });
        await expect(
          packs.get(teammate.user, f.applicationId),
        ).rejects.toMatchObject({ status: 403 });
      }
      const outsider = await creatorFixture(prisma);
      await expect(
        packs.get(outsider.user, f.applicationId),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "APPLICATION_NOT_FOUND" },
      });
      await expect(packs.get(f.owner.user, randomUUID())).rejects.toMatchObject(
        { status: 404, response: { code: "APPLICATION_NOT_FOUND" } },
      );
      for (const authorizationHealth of [
        "UNKNOWN",
        "REAUTHORIZATION_REQUIRED",
        "PROVIDER_ACCESS_BLOCKED",
        "DISCONNECTED",
      ] as const) {
        await prisma.creatorSocialIntegration.update({
          where: { id: f.owner.integration.id },
          data: {
            authorizationHealth,
            disconnectedAt:
              authorizationHealth === "DISCONNECTED" ? new Date() : null,
          },
        });
        expect(await packs.get(f.owner.user, f.applicationId)).toEqual(
          original,
        );
      }
      await prisma.creatorSocialIntegration.delete({
        where: { id: f.owner.integration.id },
      });
      await prisma.uceCampaign.update({
        where: { id: f.c.campaign.id },
        data: { name: "CHANGED_CURRENT_CAMPAIGN" },
      });
      await prisma.uceCampaignAsset.update({
        where: { id: f.c.asset.id },
        data: { status: "PAUSED" },
      });
      await prisma.canonicalCampaignBrief.update({
        where: { id: f.c.briefs[0].id },
        data: { creatorBrief: "CHANGED_CURRENT_BRIEF" },
      });
      await prisma.brandProfile.update({
        where: { id: f.brand.brand.id },
        data: { name: "CHANGED_CURRENT_BRAND" },
      });
      expect(await packs.get(f.owner.user, f.applicationId)).toEqual(original);
      const serialized = JSON.stringify(original);
      for (const forbidden of [
        f.owner.user.id,
        f.owner.member.id,
        f.owner.profile.id,
        f.owner.user.email,
        "actorContext",
        "attributionContext",
        "invitation",
        "oauth",
        "CHANGED_CURRENT",
      ])
        expect(serialized).not.toContain(forbidden);
    });
    it.each(["APPROVED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const)(
      "preserves the pack after %s",
      async (status) => {
        const f = await fixture();
        const original = await packs.get(f.owner.user, f.applicationId);
        if (status === "WITHDRAWN")
          await h.terminal.withdraw(
            f.owner.user,
            f.applicationId,
            randomUUID(),
          );
        else if (status === "EXPIRED")
          await h.terminal.expirePending([f.applicationId]);
        else
          await h.terminal.decide(
            f.brand.user,
            f.c.campaign.id,
            f.applicationId,
            status === "APPROVED" ? "APPROVE" : "REJECT",
            randomUUID(),
          );
        expect(await packs.get(f.owner.user, f.applicationId)).toEqual(
          original,
        );
      },
    );
    it("rejects malformed copies of genuine stored evidence without rewriting immutable rows", async () => {
      const f = await fixture();
      const row = await prisma.uceApplication.findUniqueOrThrow({
        where: { id: f.applicationId },
        include: { snapshot: true },
      });
      for (const data of [
        { schemaVersion: null },
        { campaignContext: {} },
        { briefContext: {} },
        { commercialContext: {} },
      ])
        expect(() =>
          projectCreatorBriefPack({
            ...row,
            snapshot: { ...row.snapshot, ...data },
          }),
        ).toThrow("Conflict Exception");
      expect(() => projectCreatorBriefPack({ ...row, snapshot: null })).toThrow(
        "Conflict Exception",
      );
      for (const compensationModel of ["FIXED", "NEGOTIABLE"] as const)
        for (const currency of ["INR", "USD"] as const)
          for (const offer of ["0", "1234.50"])
            for (const support of [false, true]) {
              const commercialContext = {
                compensationModel,
                currency,
                offer,
                receivesBrandSupport: support,
                brandSupportType: support ? "PRODUCT" : null,
                brandSupportEstimatedValue: support ? "0" : null,
              };
              expect(
                projectCreatorBriefPack({
                  ...row,
                  snapshot: { ...row.snapshot, commercialContext },
                }).commercial,
              ).toEqual(commercialContext);
            }
    });
  },
);
