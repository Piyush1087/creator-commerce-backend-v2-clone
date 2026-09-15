import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient, UserRole, type CreatorTeamRole } from "@prisma/client";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { CreatorBrandRepository } from "./creator-brand.repository";
import { CreatorBrandService } from "./creator-brand.service";
import { CreatorBrandProfileInputSchema } from "./contracts/creator-brand-profile.contract";
import { CreatorBrandConsumerSchema } from "./dto/creator-brand-consumer.schema";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "../auth/auth.module";
import { AuthSessionService } from "../auth/auth-session.service";
import { CreatorBrandModule } from "./creator-brand.module";
import { CreatorInstagramSettingsService } from "../creator-settings/instagram/creator-instagram-settings.service";

export const emptyBrand = () => ({
  headline: null,
  commercialBio: null,
  primaryNicheIds: [],
  creatorArchetypeIds: [],
  archetypeState: "UNCONFIGURED" as const,
  voiceDescriptorIds: [],
  voiceDescription: null,
  visualStyleDescriptors: [],
  palette: null,
  languages: [],
});
describe.skipIf(process.env.CREATOR_BRAND_P1_DATABASE_TEST !== "true")(
  "Creator Brand P1 real PostgreSQL",
  () => {
    const db = new PrismaClient();
    const prisma = db as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(prisma);
    const service = new CreatorBrandService(
      new CreatorBrandRepository(prisma, actors),
    );
    const scopes = new IntelligenceOwnerScopeRepository(prisma);
    type Fixture = Awaited<ReturnType<typeof fixture>>;
    let a: Fixture, b: Fixture;
    let historyBefore: unknown;
    let campaignId: string, applicationId: string, collaborationId: string;
    const sharedIdempotencyKey = randomUUID();
    const auth = (user: { id: string; email: string }): AuthUser => ({
      ...user,
      name: null,
      role: UserRole.CREATOR,
      organizationId: null,
    });
    async function fixture() {
      const org = await db.organization.create({
        data: { name: "P1 synthetic workspace", kind: "CREATOR" },
      });
      const owner = await db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: org.id,
        },
      });
      const profile = await db.creatorProfile.create({
        data: {
          userId: owner.id,
          displayName: "Canonical owner",
          avatarUrl: "https://example.test/avatar.png",
          instagramHandle: "legacy_stale",
        },
      });
      const workspace = await db.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: org.id },
      });
      const member = async (role: CreatorTeamRole, user: typeof owner) =>
        db.creatorWorkspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            assignedProfileId: role === "OWNER" ? profile.id : null,
            associatedEmail: user.email,
            securityRole: role,
            isActive: true,
          },
        });
      const ownerSeat = await member("OWNER", owner);
      const manager = await db.user.create({
        data: {
          organizationId: org.id,
          email: `${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
        },
      });
      const assistant = await db.user.create({
        data: {
          organizationId: org.id,
          email: `${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
        },
      });
      const managerSeat = await member("MANAGER", manager);
      const assistantSeat = await member("ASSISTANT", assistant);
      const scope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: profile.id,
        creatorWorkspaceId: workspace.id,
      });
      return {
        owner: auth(owner),
        manager: auth(manager),
        assistant: auth(assistant),
        ownerSeat,
        managerSeat,
        assistantSeat,
        profile,
        workspace,
        scope,
      };
    }
    async function historical() {
      return {
        campaign: await db.uceCampaign.findUnique({
          where: { id: campaignId },
        }),
        application: await db.uceApplication.findUnique({
          where: { id: applicationId },
        }),
        collaboration: await db.collaboration.findUnique({
          where: { id: collaborationId },
        }),
      };
    }
    async function counts(f: Fixture) {
      return {
        profiles: await db.creatorBrandProfile.count({
          where: { workspaceId: f.workspace.id },
        }),
        revisions: await db.creatorBrandRevision.count({
          where: { profile: { workspaceId: f.workspace.id } },
        }),
        current: await db.intelligenceCurrentComponent.count({
          where: { ownerScopeId: f.scope.id },
        }),
        objects: await db.intelligenceObjectGeneration.count({
          where: { ownerScopeId: f.scope.id },
        }),
      };
    }
    function command(
      expectedRevision = 0,
      values: unknown = emptyBrand(),
      idempotencyKey = randomUUID(),
    ) {
      return { intent: "MANUAL", values, expectedRevision, idempotencyKey };
    }
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        ![
          "/brand_p1_final",
          "/c05_creator_brand_upgrade",
          "/c05_creator_brand_upgrade_shared",
        ].includes(url.pathname)
      )
        throw new Error("Disposable P1 route required");
      a = await fixture();
      b = await fixture();
      const brand = await db.brandProfile.create({
        data: {
          domain: `${randomUUID()}.example.test`,
          name: "Unrelated brand",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      const campaign = await db.uceCampaign.create({
        data: {
          brandProfileId: brand.id,
          name: "Preserved historical campaign",
        },
      });
      campaignId = campaign.id;
      const legacyCreator = await db.uceCampaignCreator.create({
        data: {
          campaignId,
          creatorProfileId: a.profile.id,
          socialHandle: "synthetic",
          normalizedSocialHandle: "synthetic",
        },
      });
      const legacyProduct = await db.uceCampaignProduct.create({
        data: { campaignId, productName: "Historical asset" },
      });
      const legacyBrief = await db.uceCampaignBrief.create({
        data: {
          campaignId,
          productId: legacyProduct.id,
          internalTitle: "Historical brief",
          creativeGuidelines: "Preserved",
          requiredPlatforms: ["INSTAGRAM"],
        },
      });
      applicationId = (
        await db.uceApplication.create({
          data: {
            campaignId,
            legacyRequestId: randomUUID(),
            campaignCreatorId: legacyCreator.id,
            legacyCampaignProductId: legacyProduct.id,
            legacyBriefId: legacyBrief.id,
          },
        })
      ).id;
      collaborationId = (
        await db.collaboration.create({
          data: {
            brandProfileId: brand.id,
            campaignId,
            creatorUserId: a.owner.id,
            industry: "D2C_ECOMMERCE",
            briefId: legacyBrief.id,
          },
        })
      ).id;
      historyBefore = await historical();
      if (process.env.CREATOR_BRAND_P1_UPGRADE === "true") {
        const tables = await db.$queryRaw<
          Array<{ tablename: string }>
        >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
        const fingerprints = async () =>
          Promise.all(
            tables.map(async ({ tablename }) => {
              if (!/^[a-z0-9_]+$/u.test(tablename))
                throw new Error("Unsafe table name");
              return db.$queryRawUnsafe(
                `SELECT count(*)::int AS rows, md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) AS digest FROM "${tablename}" t`,
              );
            }),
          );
        const before = await fingerprints();
        expect(
          await db.$queryRaw<
            Array<{ n: number }>
          >`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
        ).toEqual([{ n: 101 }]);
        execFileSync(
          process.execPath,
          [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
          { stdio: "pipe", env: process.env },
        );
        expect(await fingerprints()).toEqual(before);
        console.log(
          `UPGRADE_PRESERVED_TABLES=${tables.length}; predecessor row counts/digests exact`,
        );
      }
      expect(
        await db.$queryRaw<
          Array<{ n: number }>
        >`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 102 }]);
      expect(
        await db.creatorBrandProfile.count({
          where: { workspaceId: { in: [a.workspace.id, b.workspace.id] } },
        }),
      ).toBe(0);
    }, 60000);
    afterAll(async () => {
      await db.$disconnect();
    });

    it("Owner creates source-independent progressive profile and exact replay", async () => {
      expect(await service.read(a.owner)).toMatchObject({
        currentRevision: 0,
        state: "UNCONFIGURED",
        identity: {
          creatorName: "Canonical owner",
          primaryInstagramHandle: null,
        },
        suggestions: { state: "NOT_IMPLEMENTED" },
      });
      const input = command(0, emptyBrand(), sharedIdempotencyKey);
      const first = await service.mutate(a.owner, input);
      expect(first.currentRevision).toBe(1);
      expect(await service.mutate(a.owner, input)).toEqual(first);
      expect(await service.read(a.owner)).toEqual(first);
      expect(await counts(a)).toEqual({
        profiles: 1,
        revisions: 1,
        current: 0,
        objects: 0,
      });
      await expect(
        service.mutate(a.owner, {
          ...input,
          values: { ...emptyBrand(), headline: "Changed" },
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(service.mutate(a.owner, command(0))).rejects.toMatchObject({
        status: 409,
      });
    });
    it("Manager creates and updates; role projection and immutable monotonic audit", async () => {
      const otherCommand = command(0, emptyBrand(), sharedIdempotencyKey);
      expect(
        (await service.mutate(b.manager, otherCommand)).currentRevision,
      ).toBe(1);
      await db.creatorWorkspaceMember.update({
        where: { id: b.managerSeat.id },
        data: { isActive: false },
      });
      await expect(
        service.mutate(b.manager, otherCommand),
      ).rejects.toMatchObject({ status: 403 });
      await db.creatorWorkspaceMember.update({
        where: { id: b.managerSeat.id },
        data: { isActive: true },
      });
      await db.user.update({
        where: { id: b.manager.id },
        data: { authState: "PROVISIONAL", organizationId: null },
      });
      await expect(service.read(b.manager)).rejects.toMatchObject({
        status: 403,
      });
      await db.user.update({
        where: { id: b.manager.id },
        data: {
          authState: "ACTIVE",
          organizationId: b.workspace.organizationId,
        },
      });
      const values = {
        ...emptyBrand(),
        headline: "Manual identity",
        creatorArchetypeIds: ["UGC_CREATOR"],
        archetypeState: "CONFIRMED",
      };
      const result = await service.mutate(a.manager, command(1, values));
      expect(result).toMatchObject({
        currentRevision: 2,
        profile: values,
        context: { role: "MANAGER" },
      });
      expect((await service.read(a.owner)).profile).toEqual(result.profile);
      const rows = await db.creatorBrandRevision.findMany({
        where: { profile: { workspaceId: a.workspace.id } },
        orderBy: { revision: "asc" },
      });
      expect(
        rows.map((r) => [r.revision, r.previousRevision, r.origin]),
      ).toEqual([
        [1, 0, "MANUAL"],
        [2, 1, "MANUAL"],
      ]);
      expect(rows[1]).toMatchObject({
        actorUserId: a.manager.id,
        actorMembershipId: a.managerSeat.id,
        actorRole: "MANAGER",
        suggestionCandidateId: null,
      });
      await expect(
        db.creatorBrandRevision.update({
          where: { id: rows[0].id },
          data: { origin: "SUGGESTION_USED" },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorBrandRevision.delete({ where: { id: rows[0].id } }),
      ).rejects.toThrow();
    });
    it("Assistant reads only and failed authorization is atomic", async () => {
      const baseline = await counts(a);
      const read = await service.read(a.assistant);
      expect(read.context.allowedActions).toEqual(["CREATOR_BRAND_READ"]);
      await expect(
        service.mutate(a.assistant, command(2)),
      ).rejects.toMatchObject({ status: 403 });
      await db.creatorWorkspaceMember.update({
        where: { id: a.assistantSeat.id },
        data: { isActive: false },
      });
      await expect(service.read(a.assistant)).rejects.toMatchObject({
        status: 403,
      });
      await db.creatorWorkspaceMember.update({
        where: { id: a.assistantSeat.id },
        data: { isActive: true },
      });
      await expect(
        service.read({ ...a.owner, role: UserRole.BRAND_OWNER }),
      ).rejects.toMatchObject({ status: 403 });
      const outsider = await db.user.create({
        data: {
          organizationId: b.workspace.organizationId,
          email: `${randomUUID()}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
        },
      });
      await expect(service.read(auth(outsider))).rejects.toMatchObject({
        status: 403,
      });
      expect(await counts(a)).toEqual(baseline);
    });
    it("strict bounds, projected identity, subject and suggestion input fail before rows", async () => {
      const baseline = await counts(a);
      const invalid = [
        {
          ...emptyBrand(),
          creatorArchetypeIds: ["EDUCATOR"],
          archetypeState: "UNCONFIGURED",
        },
        { ...emptyBrand(), primaryNicheIds: ["CUSTOM"] },
        {
          ...emptyBrand(),
          creatorArchetypeIds: [
            "EDUCATOR",
            "STORYTELLER",
            "UGC_CREATOR",
            "DEMONSTRATOR",
          ],
          archetypeState: "CONFIRMED",
        },
        { ...emptyBrand(), headline: "x".repeat(161) },
        { ...emptyBrand(), languages: ["en", "EN"] },
      ];
      for (const values of invalid)
        await expect(
          service.mutate(a.owner, command(2, values)),
        ).rejects.toMatchObject({ status: 400 });
      for (const key of [
        "creatorWorkspaceId",
        "ownerCreatorProfileId",
        "creatorName",
        "avatarImageReference",
        "primaryInstagramHandle",
        "origin",
        "suggestionReference",
      ])
        await expect(
          service.mutate(a.owner, { ...command(2), [key]: b.profile.id }),
        ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.mutate(a.owner, { ...command(2), intent: "USE_SUGGESTION" }),
      ).rejects.toMatchObject({ status: 400 });
      expect(await counts(a)).toEqual(baseline);
    });
    it("concurrent same-revision writers commit at most one; replay retains original revision", async () => {
      const input = command(2, {
        ...emptyBrand(),
        headline: "Concurrent first",
      });
      const outcomes = await Promise.allSettled([
        service.mutate(a.owner, input),
        service.mutate(
          a.manager,
          command(2, { ...emptyBrand(), headline: "Concurrent second" }),
        ),
      ]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(await counts(a)).toMatchObject({
        profiles: 1,
        revisions: 3,
        current: 0,
        objects: 0,
      });
      const read = await service.read(a.owner);
      expect(read.currentRevision).toBe(3);
      await service.mutate(a.owner, command(3));
      if (outcomes[0].status === "fulfilled")
        expect((await service.mutate(a.owner, input)).currentRevision).toBe(3);
      expect((await service.read(a.owner)).currentRevision).toBe(4);
    });
    it("database defenses reject cross subject, invalid snapshot and backward current", async () => {
      const c = await fixture();
      const profile = await db.creatorBrandProfile.findUniqueOrThrow({
        where: { workspaceId: a.workspace.id },
      });
      await expect(
        db.creatorBrandProfile.create({
          data: {
            workspaceId: c.workspace.id,
            ownerProfileId: b.profile.id,
            currentRevision: 1,
            snapshot: emptyBrand(),
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorBrandProfile.update({
          where: { id: profile.id },
          data: { currentRevision: 3 },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorBrandProfile.update({
          where: { id: profile.id },
          data: { currentRevision: 5, snapshot: {} },
        }),
      ).rejects.toThrow();
      expect((await service.read(b.owner)).currentRevision).toBe(1);
      expect((await service.read(a.owner)).currentRevision).toBe(4);
      expect(CreatorBrandProfileInputSchema.parse(emptyBrand())).toEqual(
        emptyBrand(),
      );
    });
    it("source failure/disconnect/target purge retain canonical and unrelated historical rows", async () => {
      const before = await service.read(a.owner);
      const source = await db.creatorSocialIntegration.create({
        data: {
          creatorProfileId: a.profile.id,
          platformNetwork: "INSTAGRAM",
          nativePlatformUserId: randomUUID(),
          channelHandleString: "current_handle",
          oauthAccessTokenEncrypted: "synthetic-not-decrypted",
          authorizationHealth: "USABLE",
          tokenStateCondition: "ACTIVE",
        },
      });
      expect(
        (await service.read(a.owner)).identity.primaryInstagramHandle,
      ).toBe("current_handle");
      await db.creatorSocialIntegration.update({
        where: { id: source.id },
        data: { authorizationHealth: "PROVIDER_ACCESS_BLOCKED" },
      });
      expect((await service.read(a.owner)).profile).toEqual(before.profile);
      const unusedPort = {};
      const settings = new CreatorInstagramSettingsService(
        prisma,
        actors,
        unusedPort as ConstructorParameters<
          typeof CreatorInstagramSettingsService
        >[2],
        unusedPort as ConstructorParameters<
          typeof CreatorInstagramSettingsService
        >[3],
        unusedPort as ConstructorParameters<
          typeof CreatorInstagramSettingsService
        >[4],
      );
      expect(await settings.disconnect(a.owner)).toMatchObject({
        disconnected: true,
      });
      expect(
        (await service.read(a.owner)).identity.primaryInstagramHandle,
      ).toBeNull();
      const refs = [randomUUID(), randomUUID(), randomUUID()];
      for (let i = 0; i < refs.length; i++)
        await db.$executeRawUnsafe(
          `INSERT INTO data_extraction_resources (id,resource_ref,owner_scope_id,brand_id,source_class,resource_type,canonical_resource_key,canonical_resource_key_hash,canonical_url,provider_account_id) VALUES ($1,$2,$3,NULL,$4::"DataExtractionSourceClass",$5::"DataExtractionResourceType",$2,$6,$7,CASE WHEN $4='INSTAGRAM_OWNED' THEN 'synthetic-account' ELSE NULL END)`,
          randomUUID(),
          refs[i],
          i === 2 ? b.scope.id : a.scope.id,
          i === 1 ? "OWNED_WEBSITE" : "INSTAGRAM_OWNED",
          i === 1 ? "OWNED_WEB_PAGE" : "INSTAGRAM_MEDIA",
          String(i).repeat(64),
          "https://example.test/source",
        );
      expect(await scopes.purgeCreatorInstagram(a.scope.id)).toBeGreaterThan(0);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: refs[0] },
        }),
      ).toBe(0);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: { in: [refs[1], refs[2]] } },
        }),
      ).toBe(2);
      expect(await counts(a)).toMatchObject({
        profiles: 1,
        revisions: 4,
        current: 0,
        objects: 0,
      });
      expect((await service.read(a.owner)).profile).toEqual(before.profile);
      expect(await historical()).toEqual(historyBefore);
      expect(
        await db.creatorProfile.findUnique({ where: { id: a.profile.id } }),
      ).toEqual(a.profile);
      expect(
        CreatorBrandConsumerSchema.parse(await service.read(a.owner)),
      ).toBeDefined();
      console.log(
        "P1_FINAL_COUNTS target=1 profile/4 revisions; other=1 profile/1 revision; no Intelligence writes; historical unchanged",
      );
    });
    it("real authenticated HTTP GET/PUT and anonymous/inactive/cross-owner isolation", async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
          (
            createRequire(resolve("package.json"))(
              resolve("dist/features/auth/auth.module.js"),
            ) as { AuthModule: typeof AuthModule }
          ).AuthModule,
          (
            createRequire(resolve("package.json"))(
              resolve("dist/features/creator-brand/creator-brand.module.js"),
            ) as { CreatorBrandModule: typeof CreatorBrandModule }
          ).CreatorBrandModule,
        ],
      }).compile();
      const app = module.createNestApplication({ logger: false });
      try {
        await app.listen(0, "127.0.0.1");
        const address = app.getHttpServer().address() as { port: number };
        const base = `http://127.0.0.1:${address.port}/api/v1/creator/brand`;
        const sessionClass = (
          createRequire(resolve("package.json"))(
            resolve("dist/features/auth/auth-session.service.js"),
          ) as { AuthSessionService: typeof AuthSessionService }
        ).AuthSessionService;
        const sessions = app.get(sessionClass);
        const ownerToken = (await sessions.create(a.owner.id)).accessToken;
        const managerToken = (await sessions.create(a.manager.id)).accessToken;
        const assistantToken = (await sessions.create(a.assistant.id))
          .accessToken;
        const otherToken = (await sessions.create(b.owner.id)).accessToken;
        const read = (token: string) =>
          fetch(base, { headers: { Authorization: `Bearer ${token}` } });
        const put = (token: string, body: unknown) =>
          fetch(base, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
        expect((await fetch(base)).status).toBe(401);
        expect(
          (
            await fetch(base, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(command(4)),
            })
          ).status,
        ).toBe(401);
        for (const token of [ownerToken, managerToken, assistantToken]) {
          const response = await read(token);
          expect(response.status).toBe(200);
          expect(
            CreatorBrandConsumerSchema.parse(await response.json())
              .currentRevision,
          ).toBe(4);
        }
        expect(
          CreatorBrandConsumerSchema.parse(
            await (await read(otherToken)).json(),
          ).currentRevision,
        ).toBe(1);
        expect((await put(assistantToken, command(4))).status).toBe(403);
        expect(
          (
            await put(ownerToken, {
              ...command(4),
              creatorProfileId: b.profile.id,
            })
          ).status,
        ).toBe(400);
        const substitution = await fetch(
          `${base}?workspaceId=${b.workspace.id}&creatorProfileId=${b.profile.id}`,
          { headers: { Authorization: `Bearer ${ownerToken}` } },
        );
        expect(
          CreatorBrandConsumerSchema.parse(await substitution.json())
            .currentRevision,
        ).toBe(4);
        const mutation = await put(
          managerToken,
          command(4, { ...emptyBrand(), headline: "HTTP committed" }),
        );
        expect(mutation.status).toBe(200);
        expect(
          CreatorBrandConsumerSchema.parse(await mutation.json())
            .currentRevision,
        ).toBe(5);
        expect(
          CreatorBrandConsumerSchema.parse(
            await (await read(ownerToken)).json(),
          ).profile?.headline,
        ).toBe("HTTP committed");
        await db.creatorWorkspaceMember.update({
          where: { id: a.assistantSeat.id },
          data: { isActive: false },
        });
        expect((await read(assistantToken)).status).toBe(403);
        await db.creatorWorkspaceMember.update({
          where: { id: a.assistantSeat.id },
          data: { isActive: true },
        });
        expect(await counts(a)).toEqual({
          profiles: 1,
          revisions: 5,
          current: 0,
          objects: 0,
        });
        expect(await counts(b)).toEqual({
          profiles: 1,
          revisions: 1,
          current: 0,
          objects: 0,
        });
        console.log(
          "HTTP_PROOF roles GET=200; anonymous=401; Assistant PUT=403; mutation=200 revision5; isolated other revision1",
        );
      } finally {
        await app.close();
      }
    }, 30000);
  },
);
