import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { normalizeCreatorAudience } from "./creator-audience-normalizer";
import { CreatorAudienceRepository } from "./creator-audience.repository";
import { InstagramSyncCoordinatorRepository } from "../instagram-intelligence/sync/instagram-sync-coordinator.repository";

const enabled = process.env.CREATOR_AUDIENCE_P2_DATABASE_TEST === "true";

describe.skipIf(!enabled)(
  "Creator Audience V0 shared lineage (PostgreSQL)",
  () => {
    const db = new PrismaClient();
    const scopes = new IntelligenceOwnerScopeRepository(db as PrismaService);
    const repository = new CreatorAudienceRepository(
      db as PrismaService,
      scopes,
    );
    const coordinator = new InstagramSyncCoordinatorRepository(
      db as PrismaService,
    );

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.pathname !== "/creator_audience_p2_clean"
      ) {
        throw new Error("CREATOR_AUDIENCE_P2_DISPOSABLE_DATABASE_REQUIRED");
      }
      await db.$connect();
    });
    afterAll(() => db.$disconnect());

    async function owner() {
      const suffix = randomUUID();
      const organization = await db.organization.create({
        data: { kind: "CREATOR", name: `P2 ${suffix}` },
      });
      const user = await db.user.create({
        data: {
          email: `${suffix}@example.test`,
          normalizedEmail: `${suffix}@example.test`,
          role: "CREATOR",
          authState: "ACTIVE",
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      const profile = await db.creatorProfile.create({
        data: { userId: user.id },
      });
      const workspace = await db.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: organization.id },
      });
      return { profile, workspace };
    }

    it("persists exact Resource → Capture → Evidence → Object/component → current lineage and replays stably", async () => {
      const { profile, workspace } = await owner();
      const identity = {
        creatorProfileId: profile.id,
        creatorWorkspaceId: workspace.id,
        integrationId: randomUUID(),
        providerAccountId: `account-${randomUUID()}`,
        authorizationGeneration: 1,
        requestIdentity: `creator-audience:test:${randomUUID()}`,
      };
      const results = (["FOLLOWERS", "ENGAGED_AUDIENCE"] as const).flatMap(
        (population) =>
          (["AGE", "GENDER", "COUNTRY", "CITY"] as const).map((breakdown) => ({
            availability: "AVAILABLE" as const,
            population,
            breakdown,
            timeframe: "THIS_MONTH" as const,
            values: [
              { dimension: "A", value: 60 },
              { dimension: "B", value: 40 },
            ],
            denominator: 100,
            limitation: null,
          })),
      );
      const acquisition = {
        capturedAt: "2026-09-14T10:00:00.000Z",
        followerCount: { state: "OBSERVED" as const, value: 1000 },
        results,
      };
      const value = normalizeCreatorAudience({
        acquisition,
        role: "OWNER",
        now: new Date("2026-09-14T10:00:00Z"),
      });
      await repository.publish({ identity, acquisition, value });
      const scope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: profile.id,
        creatorWorkspaceId: workspace.id,
      });
      const countsBefore = await db.$queryRawUnsafe<
        Array<Record<string, bigint>>
      >(
        `SELECT
       (SELECT count(*) FROM data_extraction_resources WHERE owner_scope_id=$1) resources,
       (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id=$1 AND captured_at IS NOT NULL) captures,
       (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id=$1) evidence,
       (SELECT count(*) FROM intelligence_object_generations WHERE owner_scope_id=$1) objects,
       (SELECT count(*) FROM intelligence_component_generations WHERE owner_scope_id=$1) components,
       (SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=$1) current`,
        scope.id,
      );
      expect(countsBefore[0]).toEqual({
        resources: 1n,
        captures: 1n,
        evidence: 8n,
        objects: 1n,
        components: 6n,
        current: 6n,
      });
      await expect(repository.replay(identity)).resolves.toMatchObject({
        status: "READY",
      });
      const countsAfter = await db.$queryRawUnsafe<
        Array<Record<string, bigint>>
      >(
        `SELECT
       (SELECT count(*) FROM data_extraction_resources WHERE owner_scope_id=$1) resources,
       (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id=$1) captures,
       (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id=$1) evidence,
       (SELECT count(*) FROM intelligence_object_generations WHERE owner_scope_id=$1) objects,
       (SELECT count(*) FROM intelligence_component_generations WHERE owner_scope_id=$1) components,
       (SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=$1) current`,
        scope.id,
      );
      expect(countsAfter).toEqual(countsBefore);
      const websiteRef = `creator-website:${randomUUID()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO data_extraction_resources
          (id, resource_ref, owner_scope_id, brand_id, source_class,
           resource_type, canonical_resource_key, canonical_resource_key_hash,
           canonical_url)
         VALUES ($1,$2,$3,NULL,'OWNED_WEBSITE','OWNED_WEB_PAGE',$2,$4,$5)`,
        randomUUID(),
        websiteRef,
        scope.id,
        "f".repeat(64),
        "https://creator.example.test/about",
      );
      expect(await scopes.purgeCreatorInstagram(scope.id)).toBeGreaterThan(0);
      const remaining = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) count FROM data_extraction_resources WHERE owner_scope_id=$1 AND source_class='INSTAGRAM_OWNED'
       UNION ALL SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=$1`,
        scope.id,
      );
      expect(remaining.every((row) => row.count === 0n)).toBe(true);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: websiteRef },
        }),
      ).toBe(1);
      expect(
        await db.intelligenceOwnerScope.count({ where: { id: scope.id } }),
      ).toBe(1);
    });

    it("schedules immediate Creator Audience work and returns to weekly cadence on the shared coordinator", async () => {
      await db.$executeRawUnsafe(
        "DELETE FROM instagram_intelligence_sync_jobs WHERE creator_integration_id IS NOT NULL",
      );
      const { profile, workspace } = await owner();
      const integration = await db.creatorSocialIntegration.create({
        data: {
          creatorProfileId: profile.id,
          platformNetwork: "INSTAGRAM",
          nativePlatformUserId: `account-${randomUUID()}`,
          channelHandleString: "fixture_creator",
          oauthAccessTokenEncrypted: "synthetic-test-ciphertext",
          tokenScopePermissions: [
            "instagram_business_basic",
            "instagram_business_manage_insights",
          ],
          tokenStateCondition: "ACTIVE",
          authorizationGeneration: 1,
          authorizationHealth: "USABLE",
          basicAuthorizationCapability: "AVAILABLE",
          insightsCapability: "AVAILABLE",
          professionalAccountType: "CREATOR",
        },
      });
      await coordinator.scheduleCreatorAudience({
        creatorProfileId: profile.id,
        creatorWorkspaceId: workspace.id,
        integrationId: integration.id,
        providerAccountId: integration.nativePlatformUserId,
        authorizationGeneration: 1,
        trigger: "INITIAL_CONNECT",
      });
      const lease = await coordinator.claimNextCreator("creator-p2-test");
      expect(lease).toMatchObject({
        integrationId: integration.id,
        providerAccountId: integration.nativePlatformUserId,
        authorizationGeneration: 1,
        capabilityClass: "AUDIENCE",
      });
      expect(lease?.actor).toMatchObject({
        workspaceId: workspace.id,
        subjectCreatorProfileId: profile.id,
      });
      await coordinator.complete(lease!, ["audience-generation"]);
      const rows = await db.$queryRawUnsafe<
        Array<{ status: string; delayHours: number; manualPending: boolean }>
      >(
        `SELECT status::text, EXTRACT(EPOCH FROM (next_due_at-last_success_at))/3600 AS "delayHours", manual_pending AS "manualPending"
       FROM instagram_intelligence_sync_jobs WHERE creator_integration_id=$1`,
        integration.id,
      );
      expect(rows[0].status).toBe("PENDING");
      expect(Number(rows[0].delayHours)).toBeGreaterThanOrEqual(168);
      expect(Number(rows[0].delayHours)).toBeLessThanOrEqual(168.5);
      expect(rows[0].manualPending).toBe(false);
    });
  },
);
