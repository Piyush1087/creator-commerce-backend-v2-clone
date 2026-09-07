import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applicationHarness,
  creatorFixture,
  brandFixture,
  campaignFixture,
  teamFixture,
  boundInvitationFixture,
} from "../../../test/fixtures/c03-application-fixtures";

describe.skipIf(process.env.C03_P13_DATABASE_TEST !== "true")(
  "C03 P1.3 real PostgreSQL commands and history",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { timeout: 30000, maxWait: 10000 },
    });
    const h = applicationHarness(prisma);
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !==
          (process.env.C03_P14_DATABASE_TEST === "true"
            ? "/c03_p14_handoff"
            : "/c03_p13")
      )
        throw new Error("C03_P13_DISPOSABLE_DATABASE_REQUIRED");
      await prisma.$connect();
    });
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const owner = await creatorFixture(prisma),
        brand = await brandFixture(prisma);
      const c = await campaignFixture(prisma, brand.brand.id);
      return { owner, brand, c };
    }
    async function submit(
      f: Awaited<ReturnType<typeof fixture>>,
      i = 0,
      key = randomUUID(),
    ) {
      return h.submit.submit(
        f.owner.user,
        f.c.campaign.id,
        f.c.selection(i),
        key,
      );
    }

    it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
      "%s submits with separate durable actor and Owner subject",
      async (role) => {
        const f = await fixture();
        const actor =
          role === "OWNER" ? f.owner : await teamFixture(prisma, f.owner, role);
        const result = await h.submit.submit(
          actor.user,
          f.c.campaign.id,
          f.c.selection(),
          randomUUID(),
        );
        const row = await prisma.uceApplication.findUniqueOrThrow({
          where: { id: result.applicationId },
          include: {
            snapshot: true,
            domainEvents: true,
            commandReceipts: true,
          },
        });
        expect(row).toMatchObject({
          actorUserId: actor.user.id,
          actorRole: role,
          subjectCreatorProfileId: f.owner.profile.id,
          statusVersion: 1,
        });
        expect(row.snapshot?.actorContext).toMatchObject({
          actorUserId: actor.user.id,
          actorRole: role,
        });
        expect(row.snapshot?.schemaVersion).toBe("C03_APPLICATION_SNAPSHOT_V1");
        expect(row.domainEvents).toHaveLength(1);
        expect(row.commandReceipts).toHaveLength(1);
        expect(row.domainEvents[0].actorRole).toBe(role);
      },
    );

    it("revalidates membership lost after preliminary resolve", async () => {
      const f = await fixture(),
        assistant = await teamFixture(prisma, f.owner, "ASSISTANT");
      const local = applicationHarness(prisma);
      const resolve = local.actors.resolve.bind(local.actors);
      vi.spyOn(local.actors, "resolve").mockImplementationOnce(async (user) => {
        const actor = await resolve(user);
        await prisma.creatorWorkspaceMember.update({
          where: { id: assistant.member.id },
          data: { isActive: false },
        });
        return actor;
      });
      await expect(
        local.submit.submit(
          assistant.user,
          f.c.campaign.id,
          f.c.selection(),
          randomUUID(),
        ),
      ).rejects.toThrow();
      expect(
        await prisma.uceApplication.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(0);
    });

    it("uses a changed current role in the submitted snapshot", async () => {
      const f = await fixture(),
        manager = await teamFixture(prisma, f.owner, "MANAGER");
      const local = applicationHarness(prisma),
        resolve = local.actors.resolve.bind(local.actors);
      vi.spyOn(local.actors, "resolve").mockImplementationOnce(async (user) => {
        const actor = await resolve(user);
        await prisma.creatorWorkspaceMember.update({
          where: { id: manager.member.id },
          data: { securityRole: "ASSISTANT" },
        });
        return actor;
      });
      const result = await local.submit.submit(
        manager.user,
        f.c.campaign.id,
        f.c.selection(),
        randomUUID(),
      );
      expect(
        (
          await prisma.uceApplication.findUniqueOrThrow({
            where: { id: result.applicationId },
          })
        ).actorRole,
      ).toBe("ASSISTANT");
    });

    it.each([
      "closed",
      "instagram",
      "ineligible",
      "unavailable",
      "asset",
      "brief",
      "mismatch",
    ])(
      "rejects stale %s authority without Application or receipt",
      async (kind) => {
        const f = await fixture();
        await prisma.campaignIngressTouch.create({
          data: {
            campaignId: f.c.campaign.id,
            kind: "QUALIFIED_INGRESS",
            entrySurface: "DIRECT_CAMPAIGN_LINK",
            entryAuthorityKind: "DIRECT",
            boundCreatorProfileId: f.owner.profile.id,
            boundCreatorWorkspaceId: f.owner.workspace.id,
            boundAt: new Date(),
          },
        });
        if (kind === "closed")
          await prisma.uceCampaign.update({
            where: { id: f.c.campaign.id },
            data: { status: "PAUSED" },
          });
        if (kind === "instagram")
          await prisma.creatorSocialIntegration.update({
            where: { id: f.owner.integration.id },
            data: { tokenStateCondition: "EXPIRED" },
          });
        if (kind === "ineligible" || kind === "unavailable")
          await prisma.uceCampaignTargeting.update({
            where: { campaignId: f.c.campaign.id },
            data: {
              visibilityScope: "ELIGIBLE_ONLY",
              visibilityScopes: ["ELIGIBLE_ONLY"],
              ...(kind === "ineligible"
                ? { targetLocations: ["IN"] }
                : { creatorArchetypes: ["unsupported"] }),
            },
          });
        if (kind === "asset")
          await prisma.uceCampaignAsset.update({
            where: { id: f.c.asset.id },
            data: { status: "PAUSED" },
          });
        if (kind === "brief")
          await prisma.canonicalCampaignBrief.update({
            where: { id: f.c.briefs[0].id },
            data: { status: "DRAFT" },
          });
        await expect(
          h.submit.submit(
            f.owner.user,
            f.c.campaign.id,
            kind === "mismatch"
              ? { ...f.c.selection(), briefId: randomUUID() }
              : f.c.selection(),
            randomUUID(),
          ),
        ).rejects.toMatchObject({
          response: {
            code: (
              {
                closed: "CAMPAIGN_APPLICATIONS_CLOSED",
                instagram: "RECONNECT_REQUIRED",
                ineligible: "ELIGIBILITY_INELIGIBLE",
                unavailable: "ELIGIBILITY_UNAVAILABLE",
                asset: "CAMPAIGN_BRIEF_UNAVAILABLE",
                brief: "BRIEF_NOT_PUBLISHED",
                mismatch: "APPLICATION_SELECTION_INVALID",
              } as Record<string, string>
            )[kind],
          },
        });
        expect(
          await prisma.uceApplication.count({
            where: { campaignId: f.c.campaign.id },
          }),
        ).toBe(0);
        expect(
          await prisma.applicationCommandReceipt.count({
            where: { actorUserId: f.owner.user.id },
          }),
        ).toBe(0);
      },
    );

    it.each(["valid", "expired", "revoked", "wrong-subject"])(
      "handles %s bound invitation without trusting a client ID",
      async (kind) => {
        const f = await fixture();
        await prisma.uceCampaignTargeting.update({
          where: { campaignId: f.c.campaign.id },
          data: {
            visibilityScope: "INVITED_ONLY",
            visibilityScopes: ["INVITED_ONLY"],
            creatorArchetypes: ["not-supported"],
          },
        });
        const owner =
          kind === "wrong-subject" ? await creatorFixture(prisma) : f.owner;
        const invitation = await boundInvitationFixture(
          prisma,
          owner,
          f.c.campaign.id,
        );
        if (kind === "expired") {
          await prisma.creatorSocialIntegration.update({
            where: { id: f.owner.integration.id },
            data: { tokenExpiresAt: new Date(Date.now() + 7 * 86400000) },
          });
          // Expiry is immutable, so create the fixture with an already-expired clock.
          const clock = new Date(invitation.expiresAt.getTime() + 1000);
          vi.useFakeTimers({ toFake: ["Date"] });
          vi.setSystemTime(clock);
        }
        if (kind === "revoked")
          await prisma.campaignOpportunityInvitation.update({
            where: { id: invitation.id },
            data: {
              revokedAt: new Date(),
              revokedByActorUserId: f.brand.user.id,
            },
          });
        try {
          if (kind === "valid")
            expect((await submit(f)).status).toBe("PENDING");
          else
            await expect(submit(f)).rejects.toMatchObject({
              response: {
                code:
                  kind === "expired"
                    ? "INVITATION_EXPIRED"
                    : kind === "revoked"
                      ? "INVITATION_REVOKED"
                      : "OPPORTUNITY_NOT_AVAILABLE",
              },
            });
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it("same key replays the committed result even after withdrawal; changed selection conflicts", async () => {
      const f = await fixture(),
        key = randomUUID();
      const first = await submit(f, 0, key);
      await h.terminal.withdraw(
        f.owner.user,
        first.applicationId,
        randomUUID(),
      );
      expect(await submit(f, 0, key)).toEqual(first);
      await expect(submit(f, 1, key)).rejects.toMatchObject({
        response: { code: "APPLICATION_IDEMPOTENCY_KEY_REUSED" },
      });
      const receipts = await prisma.applicationCommandReceipt.findMany({
        where: { actorUserId: f.owner.user.id },
      });
      expect(JSON.stringify(receipts)).not.toContain(key);
      expect(
        receipts.every((r) => /^[a-f0-9]{64}$/.test(r.idempotencyKeyDigest)),
      ).toBe(true);
    });

    it.each(["WITHDRAWN", "EXPIRED", "REJECTED", "PENDING"] as const)(
      "reapply after %s obeys duplicate and quota semantics",
      async (status) => {
        const f = await fixture(),
          first = await submit(f);
        if (status === "WITHDRAWN")
          await h.terminal.withdraw(
            f.owner.user,
            first.applicationId,
            randomUUID(),
          );
        if (status === "EXPIRED")
          await h.terminal.expirePending([first.applicationId]);
        if (status === "REJECTED")
          await h.terminal.decide(
            f.brand.user,
            f.c.campaign.id,
            first.applicationId,
            "REJECT",
            randomUUID(),
          );
        if (status === "WITHDRAWN" || status === "EXPIRED") {
          const second = await submit(f);
          expect(second.applicationId).not.toBe(first.applicationId);
          if (status === "EXPIRED")
            await expect(submit(f, 1)).rejects.toMatchObject({
              response: { code: "APPLICATION_CAMPAIGN_LIMIT_REACHED" },
            });
        } else
          await expect(submit(f)).rejects.toMatchObject({
            response: { code: "APPLICATION_OPPORTUNITY_ALREADY_USED" },
          });
      },
    );

    it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
      "%s reads historical snapshots during provider and Campaign recovery",
      async (role) => {
        const f = await fixture(),
          submitted = await submit(f);
        const actor =
          role === "OWNER" ? f.owner : await teamFixture(prisma, f.owner, role);
        await prisma.creatorSocialIntegration.update({
          where: { id: f.owner.integration.id },
          data: { disconnectedAt: new Date() },
        });
        await prisma.uceCampaign.update({
          where: { id: f.c.campaign.id },
          data: { status: "ARCHIVED", name: "Mutated Campaign" },
        });
        await prisma.canonicalCampaignBrief.update({
          where: { id: f.c.briefs[0].id },
          data: { briefName: "Mutated Brief", status: "PAUSED" },
        });
        const detail = await h.history.detail(
          actor.user,
          submitted.applicationId,
        );
        expect(detail.campaign.name).toBe("Historical Campaign");
        expect(detail.brief.briefName).toBe("Historical Brief 0");
        expect(detail.canWithdrawPending).toBe(role !== "ASSISTANT");
        expect((await h.history.collection(actor.user)).items).toHaveLength(1);
        expect(JSON.stringify(detail)).not.toMatch(
          /actorUserId|campaignInvitationId|utmSource|oauthAccessToken|provider-fixture/,
        );
      },
    );

    it("preserves historical access after the submission invitation expires", async () => {
      const f = await fixture();
      const invitation = await boundInvitationFixture(
        prisma,
        f.owner,
        f.c.campaign.id,
      );
      const submitted = await submit(f);
      expect(
        (
          await prisma.uceApplication.findUniqueOrThrow({
            where: { id: submitted.applicationId },
          })
        ).campaignInvitationId,
      ).toBe(invitation.id);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(invitation.expiresAt.getTime() + 1000));
      try {
        expect(
          (await h.history.detail(f.owner.user, submitted.applicationId))
            .status,
        ).toBe("PENDING");
        expect((await h.history.collection(f.owner.user)).items).toHaveLength(
          1,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("denies removed history membership and returns the same 404 for cross-subject and unknown IDs", async () => {
      const f = await fixture(),
        submitted = await submit(f),
        other = await creatorFixture(prisma);
      for (const id of [submitted.applicationId, randomUUID()])
        await expect(h.history.detail(other.user, id)).rejects.toMatchObject({
          response: { code: "APPLICATION_NOT_FOUND" },
        });
      const member = await teamFixture(prisma, f.owner, "ASSISTANT");
      await prisma.creatorWorkspaceMember.update({
        where: { id: member.member.id },
        data: { isActive: false },
      });
      await expect(
        h.history.detail(member.user, submitted.applicationId),
      ).rejects.toThrow();
    });

    it.each(["OWNER", "MANAGER", "ASSISTANT"] as const)(
      "%s withdrawal permission and receipt replay",
      async (role) => {
        const f = await fixture(),
          submitted = await submit(f),
          key = randomUUID();
        const actor =
          role === "OWNER" ? f.owner : await teamFixture(prisma, f.owner, role);
        if (role === "ASSISTANT") {
          await expect(
            h.terminal.withdraw(actor.user, submitted.applicationId, key),
          ).rejects.toMatchObject({
            response: { code: "APPLICATION_ROLE_DENIED" },
          });
          expect(
            (await h.history.detail(f.owner.user, submitted.applicationId))
              .status,
          ).toBe("PENDING");
        } else {
          const result = await h.terminal.withdraw(
            actor.user,
            submitted.applicationId,
            key,
          );
          expect(result.status).toBe("WITHDRAWN");
          expect(
            await h.terminal.withdraw(actor.user, submitted.applicationId, key),
          ).toEqual(result);
          await expect(
            h.terminal.withdraw(
              actor.user,
              submitted.applicationId,
              randomUUID(),
            ),
          ).rejects.toMatchObject({
            response: { code: "APPLICATION_TRANSITION_CONFLICT" },
          });
        }
      },
    );

    it("Brand rejection consumes history without current Creator gates or sibling mutation", async () => {
      const f = await fixture(),
        first = await submit(f),
        sibling = await submit(f, 1),
        key = randomUUID();
      await prisma.creatorSocialIntegration.update({
        where: { id: f.owner.integration.id },
        data: { disconnectedAt: new Date() },
      });
      const wrong = await brandFixture(prisma);
      await expect(
        h.terminal.decide(
          wrong.user,
          f.c.campaign.id,
          first.applicationId,
          "REJECT",
          key,
        ),
      ).rejects.toMatchObject({ response: { code: "APPLICATION_NOT_FOUND" } });
      const result = await h.terminal.decide(
        f.brand.user,
        f.c.campaign.id,
        first.applicationId,
        "REJECT",
        key,
      );
      expect(result.status).toBe("REJECTED");
      expect(
        await h.terminal.decide(
          f.brand.user,
          f.c.campaign.id,
          first.applicationId,
          "REJECT",
          key,
        ),
      ).toEqual(result);
      expect(
        (await h.history.detail(f.owner.user, sibling.applicationId)).status,
      ).toBe("PENDING");
      expect(
        await prisma.uceCampaignCollaboration.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(0);
    });

    it("canonical approval uses the installed P1.4 handoff with event and receipt", async () => {
      const f = await fixture(),
        first = await submit(f);
      await expect(
        h.terminal.decide(
          f.brand.user,
          f.c.campaign.id,
          first.applicationId,
          "APPROVE",
          randomUUID(),
        ),
      ).resolves.toMatchObject({ status: "APPROVED" });
      expect(
        (await h.history.detail(f.owner.user, first.applicationId)).status,
      ).toBe("APPROVED");
      expect(
        await prisma.applicationDomainEvent.count({
          where: { applicationId: first.applicationId, eventName: "APPROVED" },
        }),
      ).toBe(1);
      expect(
        await prisma.applicationCommandReceipt.count({
          where: { applicationId: first.applicationId, commandType: "APPROVE" },
        }),
      ).toBe(1);
      expect(
        await prisma.uceCampaignCollaboration.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(0);
    });

    it("internal expiry is bounded, has no human actor and is replay safe", async () => {
      const f = await fixture(),
        first = await submit(f);
      expect(
        await h.terminal.expirePending([first.applicationId]),
      ).toHaveLength(1);
      expect(await h.terminal.expirePending([first.applicationId])).toEqual([]);
      const event = await prisma.applicationDomainEvent.findFirstOrThrow({
        where: { applicationId: first.applicationId, eventName: "EXPIRED" },
      });
      expect(event).toMatchObject({
        actorClass: "SYSTEM",
        actorUserId: null,
        actorMembershipId: null,
        applicationVersion: 2,
      });
      await expect(
        h.terminal.expirePending(
          Array.from({ length: 101 }, () => randomUUID()),
        ),
      ).rejects.toThrow();
    });

    it.each([0, 1, 2, 3, 4, 5])(
      "subject Brand quota boundary at %i existing rows",
      async (count) => {
        const f = await fixture();
        for (let i = 0; i < count; i++) {
          const c = await campaignFixture(prisma, f.brand.brand.id, 1);
          await h.submit.submit(
            f.owner.user,
            c.campaign.id,
            c.selection(),
            randomUUID(),
          );
        }
        if (count === 5)
          await expect(submit(f)).rejects.toMatchObject({
            response: { code: "APPLICATION_BRAND_LIMIT_REACHED" },
          });
        else expect((await submit(f)).status).toBe("PENDING");
      },
    );

    it("withdrawal rechecks a Manager demoted before the transaction", async () => {
      const f = await fixture(),
        first = await submit(f),
        manager = await teamFixture(prisma, f.owner, "MANAGER");
      const local = applicationHarness(prisma),
        resolve = local.actors.resolve.bind(local.actors);
      vi.spyOn(local.actors, "resolve").mockImplementationOnce(async (user) => {
        const actor = await resolve(user);
        await prisma.creatorWorkspaceMember.update({
          where: { id: manager.member.id },
          data: { securityRole: "ASSISTANT" },
        });
        return actor;
      });
      await expect(
        local.terminal.withdraw(
          manager.user,
          first.applicationId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({
        response: { code: "APPLICATION_ROLE_DENIED" },
      });
      expect(
        (await h.history.detail(f.owner.user, first.applicationId)).status,
      ).toBe("PENDING");
    });

    it("Brand rejection rechecks membership removed after preliminary authorization", async () => {
      const f = await fixture(),
        first = await submit(f),
        local = applicationHarness(prisma);
      const resolve = local.brands.resolveBrandProfileIdInTransaction.bind(
        local.brands,
      );
      vi.spyOn(
        local.brands,
        "resolveBrandProfileIdInTransaction",
      ).mockImplementationOnce(async (tx, user) => {
        const id = await resolve(tx, user);
        await prisma.brandTeamMember.updateMany({
          where: { brandProfileId: id, userId: user.id },
          data: { isActive: false },
        });
        return id;
      });
      await expect(
        local.terminal.decide(
          f.brand.user,
          f.c.campaign.id,
          first.applicationId,
          "REJECT",
          randomUUID(),
        ),
      ).rejects.toThrow();
      expect(
        (await h.history.detail(f.owner.user, first.applicationId)).status,
      ).toBe("PENDING");
    });

    it.each(["DIRECT", "SHARE", "other-subject"])(
      "server-bound %s attribution never grants access or crosses subjects",
      async (kind) => {
        const f = await fixture();
        const bound =
          kind === "other-subject" ? await creatorFixture(prisma) : f.owner;
        const share = await prisma.uceCampaignShare.create({
          data: {
            campaignId: f.c.campaign.id,
            requestId: randomUUID(),
            channel: "COPY_LINK",
            trackingToken: randomUUID(),
          },
        });
        const touch = await prisma.campaignIngressTouch.create({
          data: {
            campaignId: f.c.campaign.id,
            kind: "QUALIFIED_INGRESS",
            entrySurface:
              kind === "DIRECT"
                ? "DIRECT_CAMPAIGN_LINK"
                : "TRACKED_CAMPAIGN_SHARE",
            entryAuthorityKind: kind === "DIRECT" ? "DIRECT" : "SHARE",
            campaignShareId: kind === "DIRECT" ? null : share.id,
            boundCreatorProfileId: bound.profile.id,
            boundCreatorWorkspaceId: bound.workspace.id,
            boundAt: new Date(),
            utmSource: "safe-normalized-fixture",
          },
        });
        const first = await submit(f);
        const row = await prisma.uceApplication.findUniqueOrThrow({
          where: { id: first.applicationId },
          include: { snapshot: true, conversionTouch: true },
        });
        expect(row.source).toBe(kind === "SHARE" ? "SHARE" : "DIRECT");
        expect(row.firstQualifiedTouchId).toBe(
          kind === "other-subject" ? null : touch.id,
        );
        expect(row.conversionTouch?.boundCreatorProfileId).toBe(
          f.owner.profile.id,
        );
        expect(row.conversionTouch?.kind).toBe("APPLICATION_CONVERSION");
        expect(
          JSON.stringify(await h.history.detail(f.owner.user, row.id)),
        ).not.toContain("safe-normalized-fixture");
      },
    );

    it.each(["FIXED_FEE", "NEGOTIABLE"] as const)(
      "snapshot preserves explicit zero %s offer and never collects a Creator proposal",
      async (compensationType) => {
        const f = await fixture();
        await prisma.uceCampaignCommercials.update({
          where: { campaignId: f.c.campaign.id },
          data: {
            compensationType,
            commercialOffer: 0,
            receivesBrandSupport: true,
            brandSupportType: "PRODUCT",
            brandSupportEstimatedValue: 0,
          },
        });
        const first = await submit(f);
        const snapshot = await prisma.uceApplicationSnapshot.findUniqueOrThrow({
          where: { applicationId: first.applicationId },
        });
        expect(snapshot.commercialContext).toMatchObject({
          offer: "0",
          brandSupportEstimatedValue: "0",
          currency: "INR",
          compensationModel:
            compensationType === "FIXED_FEE" ? "FIXED" : "NEGOTIABLE",
        });
        expect(JSON.stringify(snapshot)).not.toMatch(
          /proposedAmount|initialQuote|totalCampaignBudget|oauthAccessToken/,
        );
        expect(snapshot.briefContext).toMatchObject({
          deliverables: [{ displayOrder: 0 }, { displayOrder: 1 }],
        });
      },
    );

    it("history cursor uses the entire ordering tuple for tied timestamps without duplicates or omissions", async () => {
      const owner = await creatorFixture(prisma),
        fixedNow = new Date();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(fixedNow);
      const ids: string[] = [];
      try {
        for (let i = 0; i < 21; i++) {
          const brand = await brandFixture(prisma),
            c = await campaignFixture(prisma, brand.brand.id, 1);
          ids.push(
            (
              await h.submit.submit(
                owner.user,
                c.campaign.id,
                c.selection(),
                randomUUID(),
              )
            ).applicationId,
          );
        }
      } finally {
        vi.useRealTimers();
      }
      const first = await h.history.collection(owner.user);
      expect(first.items).toHaveLength(20);
      expect(first.nextCursor).not.toBeNull();
      const second = await h.history.collection(owner.user, first.nextCursor!);
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect(
        [...first.items, ...second.items].map((row) => row.applicationId),
      ).toEqual(ids.sort().reverse());
      await expect(
        h.history.collection(owner.user, "invalid-cursor"),
      ).rejects.toMatchObject({
        response: { code: "APPLICATION_CURSOR_INVALID" },
      });
    });
  },
);
