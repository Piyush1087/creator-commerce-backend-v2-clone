import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AudienceV1ConsumerService } from "./creator-audience-v1.consumer.service";
import { CreatorAudienceController } from "../creator-audience/creator-audience.controller";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import { InstagramSyncCoordinatorRepository } from "../instagram-intelligence/sync/instagram-sync-coordinator.repository";
import {
  audienceV1TestOwner,
  audienceV1TestRuntime,
} from "./creator-audience-v1.test-fixture";
import type { InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";

describe("Audience V1 authenticated consumer contract", () => {
  it("rejects every caller context/query override", () => {
    const read = vi.fn();
    const controller = new CreatorAudienceController({ read } as never);
    expect(() =>
      controller.read({ user: {} } as never, { creatorProfileId: "other" }),
    ).toThrow();
    expect(() =>
      controller.read({ user: {} } as never, { window: "7days" }),
    ).toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("permits only existing authenticated no-store GET", () => {
    const controller = readFileSync(
      resolve(__dirname, "../creator-audience/creator-audience.controller.ts"),
      "utf8",
    );
    expect(controller).toContain("JwtAuthGuard");
    expect(controller).toContain('"private, no-store"');
    expect(controller).not.toMatch(/@Post|@Put|@Delete|@Patch/);
  });
  it("cannot acquire, decrypt, create a scope or publish from GET", () => {
    const service = readFileSync(
      resolve(__dirname, "creator-audience-v1.consumer.service.ts"),
      "utf8",
    );
    expect(service).toContain("resolveReadOnly");
    expect(service).not.toMatch(
      /\$executeRaw|\.upsert\(|\.create\(|decryptField|\.execute\(|\.acquire\(|fetch\(|\.readProfile\(|CreatorBrand/,
    );
    expect(service).toContain("NOT_PROCESSED");
  });
  it("rejects a missing explicit Team read action", async () => {
    const actors = { resolveReadOnly: async () => ({ allowedActions: [] }) };
    const project = vi.fn();
    const service = new AudienceV1ConsumerService(
      actors as never,
      { project } as never,
      {} as never,
    );
    await expect(service.read({} as never)).rejects.toThrow("read access");
    expect(project).not.toHaveBeenCalled();
  });
});

describe.skipIf(process.env.CREATOR_AUDIENCE_V1_DATABASE_TEST !== "true")(
  "Audience V1 read-only PostgreSQL projection",
  () => {
    const db = new PrismaClient();
    let mode: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" = "AVAILABLE";
    let calls = 0;
    const provider: InstagramIntelligenceProviderReadClient = {
      readProfile: async (credential) => ({
        availability: "AVAILABLE",
        providerAccountId: credential.providerAccountId,
        appScopedUserId: {
          state: "OBSERVED",
          value: credential.providerAccountId,
        },
        username: { state: "OBSERVED", value: "fixture" },
        name: { state: "OBSERVED", value: "Fixture" },
        accountType: { state: "OBSERVED", value: "CREATOR" },
        followersCount: { state: "OBSERVED", value: 1000 },
        followsCount: { state: "OBSERVED", value: 5 },
        mediaCount: { state: "OBSERVED", value: 10 },
      }),
      readAudienceInsights: async (_credential, population, breakdown) => {
        calls++;
        const available =
          mode !== "UNAVAILABLE" &&
          !(mode === "PARTIAL" && breakdown === "CITY");
        return {
          availability: available ? "AVAILABLE" : "UNAVAILABLE",
          population,
          breakdown,
          timeframe: "THIS_MONTH",
          denominator: available ? 100 : undefined,
          values: available
            ? [
                { dimension: "A", value: 60 },
                { dimension: "B", value: 40 },
              ]
            : [],
          limitation: available
            ? null
            : "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
        };
      },
      readMediaInventory: async () => {
        throw new Error("UNEXPECTED_EXTERNAL_METHOD");
      },
      readMediaInsights: async () => {
        throw new Error("UNEXPECTED_EXTERNAL_METHOD");
      },
      readCarouselChildren: async () => {
        throw new Error("UNEXPECTED_EXTERNAL_METHOD");
      },
    };
    const service = new AudienceV1ConsumerService(
      new CreatorWorkspaceActorService(db as never),
      new CreatorAudienceCredentialFenceService(db as never),
      db as never,
    );
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.port !== "55471" ||
        !["/creator_audience_v1_p1", "/creator_audience_v1_p4"].includes(
          url.pathname,
        )
      )
        throw new Error("TASK_DATABASE_REQUIRED");
      await db.$connect();
    });
    afterAll(async () => db.$disconnect());
    async function owner() {
      const fixture = await audienceV1TestOwner(db);
      const membership = await db.creatorWorkspaceMember.create({
        data: {
          workspaceId: fixture.workspace.id,
          userId: fixture.actor.actorUserId,
          assignedProfileId: fixture.profile.id,
          associatedEmail: "owner@example.test",
          securityRole: "OWNER",
          joinedAt: new Date(),
        },
      });
      return {
        ...fixture,
        actor: { ...fixture.actor, actorMembershipId: membership.id },
      };
    }
    function user(id: string) {
      return { id, role: "CREATOR" } as never;
    }
    async function count() {
      return db.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`SELECT
      (SELECT count(*) FROM intelligence_owner_scopes) scopes,
      (SELECT count(*) FROM intelligence_executions) executions,
      (SELECT count(*) FROM intelligence_object_generations) objects,
      (SELECT count(*) FROM intelligence_current_components) current`);
    }
    async function acquire(
      fixture: Awaited<ReturnType<typeof owner>>,
      derived = true,
    ) {
      const runtime = audienceV1TestRuntime(db, provider);
      const source = await runtime.pipeline.execute({
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt: new Date(),
        requestIdentity: "consumer:" + crypto.randomUUID(),
      });
      if (derived) await runtime.v1.execute(fixture.actor);
      return { runtime, source };
    }
    it("empty connected source remains unavailable/unprocessed with no scope or GET writes", async () => {
      const fixture = await owner();
      const before = await count();
      const value = await service.read(user(fixture.actor.actorUserId));
      expect(value.status).toBe("UNAVAILABLE");
      expect(value.processingState).toBe("IDLE");
      expect(value.change.state).toBe("NOT_PROCESSED");
      expect(value.overview.accountFollowerCount).toBeNull();
      expect(value.generatedAt).toBe(new Date(0).toISOString());
      expect(await count()).toEqual(before);
    });
    it("a real Settings-scheduled source job reports processing before any shared subject or current exists", async () => {
      const fixture = await owner();
      await new InstagramSyncCoordinatorRepository(
        db as never,
      ).scheduleCreatorAudience({
        creatorProfileId: fixture.profile.id,
        creatorWorkspaceId: fixture.workspace.id,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        trigger: "INITIAL_CONNECT",
      });
      const before = await count();
      const value = await service.read(user(fixture.actor.actorUserId));
      expect(value.status).toBe("UNAVAILABLE");
      expect(value.processingState).toBe("PROCESSING");
      expect(value.change.state).toBe("NOT_PROCESSED");
      expect(value.overview.accountFollowerCount).toBeNull();
      expect(await count()).toEqual(before);
    });
    it("valid V0 source without V1 is not re-labelled as insufficient history or approximate Intelligence", async () => {
      mode = "AVAILABLE";
      const fixture = await owner();
      await acquire(fixture, false);
      const before = await count();
      const value = await service.read(user(fixture.actor.actorUserId));
      expect(value.status).toBe("READY");
      expect(value.overview.accountFollowerCount).toBe(1000);
      expect(value.overview.facts).toEqual([]);
      expect(value.profiles).toEqual([]);
      expect(value.change.state).toBe("NOT_PROCESSED");
      expect(await count()).toEqual(before);
    });
    it("Owner/Manager/Assistant project exactly one canonical Owner current without new rows or provider work", async () => {
      mode = "AVAILABLE";
      const fixture = await owner();
      await acquire(fixture);
      const members = [fixture.actor.actorUserId];
      for (const role of ["MANAGER", "ASSISTANT"] as const) {
        const otherUser = await db.user.create({
          data: {
            email: crypto.randomUUID() + "@example.test",
            role: "CREATOR",
            authState: "ACTIVE",
            organizationId: fixture.actor.organizationId,
          },
        });
        await db.creatorWorkspaceMember.create({
          data: {
            workspaceId: fixture.workspace.id,
            userId: otherUser.id,
            associatedEmail: role + "@example.test",
            securityRole: role,
            joinedAt: new Date(),
          },
        });
        members.push(otherUser.id);
      }
      const before = await count();
      const beforeCalls = calls;
      const values = [];
      for (const id of members) values.push(await service.read(user(id)));
      expect(values.map((value) => value.context.role)).toEqual([
        "OWNER",
        "MANAGER",
        "ASSISTANT",
      ]);
      expect(
        values.every(
          (value) =>
            value.overview.accountFollowerCount === 1000 &&
            value.profiles.length === 2,
        ),
      ).toBe(true);
      expect(values[1].overview).toEqual(values[0].overview);
      expect(values[2].profiles).toEqual(values[0].profiles);
      expect(calls).toBe(beforeCalls);
      expect(await count()).toEqual(before);
    });
    it("inactive membership and cross-Creator cannot read target current", async () => {
      const fixture = await owner();
      await acquire(fixture);
      const outsider = await owner();
      expect(
        (await service.read(user(outsider.actor.actorUserId))).status,
      ).toBe("UNAVAILABLE");
      await db.creatorWorkspaceMember.updateMany({
        where: { workspaceId: fixture.workspace.id },
        data: { isActive: false },
      });
      await expect(
        service.read(user(fixture.actor.actorUserId)),
      ).rejects.toThrow();
    });
    it("disconnect/stale/generation change preserve current without invented processing or zero truth", async () => {
      const fixture = await owner();
      await acquire(fixture);
      const fresh = await service.read(user(fixture.actor.actorUserId));
      await db.creatorSocialIntegration.update({
        where: { id: fixture.integration.id },
        data: {
          disconnectedAt: new Date(),
          authorizationGeneration: { increment: 1 },
        },
      });
      const value = await service.readAt(
        user(fixture.actor.actorUserId),
        new Date(Date.now() + 192 * 3_600_000),
      );
      expect(value.overview).toEqual(fresh.overview);
      expect(value.freshness.state).toBe("STALE");
      expect(value.currentPreserved).toBe(true);
      expect(value.sourceStatus).toBe("DISCONNECTED");
      expect(value.processingState).toBe("IDLE");
      expect(value.contentContext).toEqual([]);
    });
    it("partial remains partial and failed changed source retains exact prior derived value with failed truth", async () => {
      mode = "PARTIAL";
      const partial = await owner();
      await acquire(partial);
      expect((await service.read(user(partial.actor.actorUserId))).status).toBe(
        "PARTIAL",
      );
      mode = "AVAILABLE";
      const fixture = await owner();
      const { runtime } = await acquire(fixture);
      const prior = await service.read(user(fixture.actor.actorUserId));
      mode = "UNAVAILABLE";
      await runtime.pipeline.execute({
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        requestIdentity: "consumer:failed:" + crypto.randomUUID(),
      });
      const after = await service.read(user(fixture.actor.actorUserId));
      expect(after.overview).toEqual(prior.overview);
      expect(after.currentPreserved).toBe(true);
      expect(after.processingState).toBe("FAILED");
      expect(after.sourceStatus).toBe("PROVIDER_FAILURE");
      mode = "AVAILABLE";
    });
  },
);
