import "dotenv/config";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { PrismaClient } = require("@prisma/client");
const load = (path) => require("../dist/" + path);
const { AppModule } = load("app.module");
const { CreatorAudiencePipelineService } = load(
  "features/creator-audience/creator-audience-pipeline.service",
);
const { AudienceV1Pipeline } = load(
  "features/creator-audience-v1/creator-audience-v1.pipeline",
);
const { CreatorContentPipelineService } = load(
  "features/creator-content/creator-content-pipeline.service",
);
const { InstagramSyncCoordinatorRepository } = load(
  "features/instagram-intelligence/sync/instagram-sync-coordinator.repository",
);
const { audienceV1TestOwner } = load(
  "features/creator-audience-v1/creator-audience-v1.test-fixture",
);
const { audienceV1ContentTestFixture } = load(
  "features/creator-audience-v1/creator-audience-v1.content-test-fixture",
);
const { hashPasswordAsync } = load("shared/crypto/password.util");
const { INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT } = load(
  "features/instagram/instagram-intelligence-provider.types",
);
const guardUrl = new URL(process.env.DATABASE_URL ?? "");
assert.equal(guardUrl.hostname, "localhost");
assert.equal(guardUrl.port, "55471");
assert.ok(
  ["/creator_audience_v1_p1", "/creator_audience_v1_p4"].includes(
    guardUrl.pathname,
  ),
);
assert.ok(process.env.CREATOR_AUDIENCE_V1_FIXTURE_PASSWORD);
assert.ok(["--prove", "--serve"].includes(process.argv[2]));
process.env.INSTAGRAM_IMAGE_VISUAL_ENABLED = "true";
process.env.INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED = "true";
process.env.INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED = "true";
const db = new PrismaClient();
const port = 33491;
const base = "http://localhost:" + port;
const route = "/api/v1/creator/insights/audience";
const prefix =
  process.argv[2] === "--serve"
    ? "audience-v1-p4"
    : "audience-v1-p2-" + Date.now();
let app,
  external,
  stopping = false;
let calls = 0,
  share = 60,
  mode = "AVAILABLE",
  externalAttempts = 0;
const localFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    externalAttempts++;
    throw new Error("AUDIENCE_V1_EXTERNAL_HTTP_PROHIBITED");
  }
  return localFetch(input, init);
};
const safeLog = (value) =>
  console.log(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
async function cleanup() {
  if (stopping) return;
  stopping = true;
  await app?.close();
  await db.$disconnect();
  if (external) {
    const root = resolve(dirname(external.imageStore.getRootForDiagnostics()));
    assert.ok(
      basename(root).startsWith("creator-content-correction-audience-v1-"),
    );
    assert.equal(dirname(root), resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
}
process.on("SIGINT", () => void cleanup().then(() => process.exit(0)));
process.on("SIGTERM", () => void cleanup().then(() => process.exit(0)));
async function seedOwner(name, passwordHash) {
  const email = prefix + "-" + name + "@example.test";
  assert.equal(
    await db.user.count({ where: { email } }),
    0,
    "Fixture collision: no overwrite allowed",
  );
  const fixture = await audienceV1TestOwner(db);
  await db.user.update({
    where: { id: fixture.actor.actorUserId },
    data: {
      email,
      normalizedEmail: email,
      name: "Audience " + name,
      hashedPassword: passwordHash,
      authMethods: {
        create: { type: "PASSWORD", credentialHash: passwordHash },
      },
    },
  });
  const member = await db.creatorWorkspaceMember.create({
    data: {
      workspaceId: fixture.workspace.id,
      userId: fixture.actor.actorUserId,
      assignedProfileId: fixture.profile.id,
      associatedEmail: email,
      securityRole: "OWNER",
      joinedAt: new Date(),
    },
  });
  return {
    ...fixture,
    email,
    actor: { ...fixture.actor, actorMembershipId: member.id },
  };
}
async function source(fixture, at) {
  return app.get(CreatorAudiencePipelineService).execute({
    actor: fixture.actor,
    integrationId: fixture.integration.id,
    providerAccountId: fixture.providerAccountId,
    authorizationGeneration: 1,
    capturedAt: at,
    requestIdentity: "audience-v1-harness:" + crypto.randomUUID(),
  });
}
async function rows() {
  return db.$queryRawUnsafe(`SELECT
    (SELECT count(*) FROM intelligence_owner_scopes) scopes,
    (SELECT count(*) FROM data_extraction_resources) resources,
    (SELECT count(*) FROM data_extraction_captures) captures,
    (SELECT count(*) FROM data_extraction_evidence_items) evidence,
    (SELECT count(*) FROM data_extraction_semantic_observations) observations,
    (SELECT count(*) FROM data_extraction_observation_support) support,
    (SELECT count(*) FROM intelligence_executions) executions,
    (SELECT count(*) FROM intelligence_object_generations) objects,
    (SELECT count(*) FROM intelligence_component_generations) components,
    (SELECT count(*) FROM intelligence_component_transitions) transitions,
    (SELECT count(*) FROM intelligence_current_components) current_rows`);
}
async function login(email) {
  const response = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: process.env.CREATOR_AUDIENCE_V1_FIXTURE_PASSWORD,
    }),
  });
  assert.equal(response.status, 200, "Real password login must succeed");
  const body = await response.json();
  assert.ok(body.accessToken);
  return body.accessToken;
}
async function read(token, suffix = "") {
  const response = await fetch(base + route + suffix, {
    headers: token ? { authorization: "Bearer " + token } : {},
  });
  return { response, value: await response.json() };
}
try {
  const latestAt = new Date();
  const content = await audienceV1ContentTestFixture(db, latestAt);
  external = content.external;
  const provider = {
    ...content.provider,
    readProfile: async (credential) => ({
      availability: "AVAILABLE",
      providerAccountId: credential.providerAccountId,
      appScopedUserId: {
        state: "OBSERVED",
        value: credential.providerAccountId,
      },
      username: { state: "OBSERVED", value: "audience_fixture" },
      name: { state: "OBSERVED", value: "Audience Fixture" },
      accountType: { state: "OBSERVED", value: "CREATOR" },
      followersCount: { state: "OBSERVED", value: 1000 },
      followsCount: { state: "OBSERVED", value: 5 },
      mediaCount: { state: "OBSERVED", value: 10 },
    }),
    readAudienceInsights: async (_credential, population, breakdown) => {
      calls++;
      const available =
        mode !== "UNAVAILABLE" && !(mode === "PARTIAL" && breakdown === "CITY");
      return {
        availability: available ? "AVAILABLE" : "UNAVAILABLE",
        population,
        breakdown,
        timeframe: "THIS_MONTH",
        denominator: available ? 100 : undefined,
        values: available
          ? [
              { dimension: "A", value: share },
              { dimension: "B", value: 100 - share },
            ]
          : [],
        limitation: available ? null : "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
      };
    },
  };
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    .useValue(provider);
  const overrides = [
    [
      "features/instagram/media/instagram-contained-image-acquisition.service",
      "InstagramImageLocatorClient",
      external.imageLocator,
    ],
    [
      "features/instagram/media/video/instagram-video-locator.client",
      "InstagramVideoLocatorClient",
      external.videoLocator,
    ],
    [
      "features/instagram/media/instagram-secure-image-downloader",
      "NodeInstagramImageDnsResolver",
      external.resolver,
    ],
    [
      "features/instagram/media/instagram-secure-image-downloader",
      "NodeInstagramPinnedHttpsTransport",
      external.transport,
    ],
    [
      "features/instagram/media/instagram-image-temporary-store",
      "InstagramImageTemporaryStore",
      external.imageStore,
    ],
    [
      "features/instagram/media/video/instagram-video-temporary-store",
      "InstagramVideoTemporaryStore",
      external.videoStore,
    ],
    [
      "features/instagram/media/video/instagram-video-decoder",
      "InstagramVideoDecoderPort",
      external.decoder,
    ],
    [
      "features/instagram/media/video/instagram-audio-extractor",
      "InstagramAudioExtractorPort",
      external.audio,
    ],
    [
      "features/instagram-intelligence/media/instagram-b3a-visual-observation",
      "InstagramB3aVisualModelPort",
      external.visual,
    ],
    [
      "features/instagram-intelligence/media/instagram-w1-video-frame-observation",
      "InstagramW1VideoFrameModelPort",
      external.frameModel,
    ],
    [
      "features/instagram/media/instagram-visual-text",
      "InstagramVisualTextModelPort",
      external.ocr,
    ],
    [
      "features/instagram/media/video/instagram-speech",
      "InstagramSpeechTranscriptionPort",
      external.speech,
    ],
    [
      "features/creator-content/creator-content-multimodal.service",
      "CreatorContentGroundedModelPort",
      external.grounded,
    ],
  ];
  for (const [path, name, value] of overrides)
    builder = builder.overrideProvider(load(path)[name]).useValue(value);
  const module = await builder.compile();
  app = module.createNestApplication({ logger: false });
  app.enableCors({ origin: "http://localhost:43491", credentials: true });
  await app.listen(port, "127.0.0.1");
  for (const endpoint of ["/health/live", "/health"]) {
    const response = await fetch(base + endpoint);
    assert.equal(response.status, 200);
    const body = await response.json();
    safeLog({
      gate: "HEALTH",
      endpoint,
      status: response.status,
      response: body,
    });
  }
  const passwordHash = await hashPasswordAsync(
    process.env.CREATOR_AUDIENCE_V1_FIXTURE_PASSWORD,
  );
  const main = await seedOwner("owner", passwordHash);
  const identities = [{ email: main.email, role: "OWNER", expected: 200 }];
  for (const [role, active] of [
    ["MANAGER", true],
    ["ASSISTANT", true],
    ["ASSISTANT", false],
  ]) {
    const email =
      prefix +
      "-" +
      (active ? role.toLowerCase() : "inactive") +
      "@example.test";
    assert.equal(await db.user.count({ where: { email } }), 0);
    const member = await db.user.create({
      data: {
        email,
        normalizedEmail: email,
        name: "Audience " + role,
        role: "CREATOR",
        authState: "ACTIVE",
        organizationId: main.actor.organizationId,
        emailVerifiedAt: new Date(),
        hashedPassword: passwordHash,
        authMethods: {
          create: { type: "PASSWORD", credentialHash: passwordHash },
        },
      },
    });
    await db.creatorWorkspaceMember.create({
      data: {
        workspaceId: main.workspace.id,
        userId: member.id,
        associatedEmail: email,
        securityRole: role,
        isActive: active,
        joinedAt: active ? new Date() : null,
      },
    });
    identities.push({ email, role, expected: active ? 200 : 403 });
  }
  share = 50;
  await source(main, new Date(latestAt.getTime() - 14 * 86_400_000));
  share = 60;
  await source(main, new Date(latestAt.getTime() - 7 * 86_400_000));
  share = 70;
  await source(main, latestAt);
  await app.get(CreatorContentPipelineService).execute({
    actor: main.actor,
    integrationId: main.integration.id,
    providerAccountId: main.providerAccountId,
    authorizationGeneration: 1,
    capturedAt: latestAt,
    requestIdentity: "audience-v1-harness-content:" + crypto.randomUUID(),
  });
  const beforeReplay = await rows();
  const beforeCalls = {
    audience: calls,
    content: content.providerCalls(),
    external: { ...external.count },
  };
  const replay = await app.get(AudienceV1Pipeline).execute(main.actor);
  assert.equal(replay.reused, true);
  assert.deepEqual(await rows(), beforeReplay);
  assert.deepEqual(
    {
      audience: calls,
      content: content.providerCalls(),
      external: { ...external.count },
    },
    beforeCalls,
  );
  const stateFixtures = [];
  mode = "PARTIAL";
  const partial = await seedOwner("partial", passwordHash);
  await source(partial, latestAt);
  stateFixtures.push([partial, "PARTIAL"]);
  mode = "AVAILABLE";
  const empty = await seedOwner("empty", passwordHash);
  stateFixtures.push([empty, "UNAVAILABLE"]);
  const stale = await seedOwner("stale", passwordHash);
  await source(stale, new Date(latestAt.getTime() - 193 * 3_600_000));
  stateFixtures.push([stale, "READY"]);
  mode = "UNAVAILABLE";
  await source(stale, latestAt);
  mode = "AVAILABLE";
  const preserved = await seedOwner("preserved", passwordHash);
  await source(preserved, latestAt);
  mode = "PARTIAL";
  await source(preserved, latestAt);
  stateFixtures.push([preserved, "READY"]);
  mode = "AVAILABLE";
  const processing = await seedOwner("processing", passwordHash);
  await app.get(InstagramSyncCoordinatorRepository).scheduleCreatorAudience({
    creatorProfileId: processing.profile.id,
    creatorWorkspaceId: processing.workspace.id,
    integrationId: processing.integration.id,
    providerAccountId: processing.providerAccountId,
    authorizationGeneration: 1,
    trigger: "INITIAL_CONNECT",
  });
  stateFixtures.push([processing, "UNAVAILABLE"]);
  const disconnected = await seedOwner("disconnected", passwordHash);
  await source(disconnected, latestAt);
  await db.creatorSocialIntegration.update({
    where: { id: disconnected.integration.id },
    data: { disconnectedAt: new Date() },
  });
  stateFixtures.push([disconnected, "READY"]);
  const capabilityUnknown = await seedOwner("capability", passwordHash);
  await db.creatorSocialIntegration.update({
    where: { id: capabilityUnknown.integration.id },
    data: { insightsCapability: "UNKNOWN" },
  });
  stateFixtures.push([capabilityUnknown, "UNAVAILABLE"]);
  const beforeReads = await rows();
  const readCalls = calls;
  const anonymous = await read(null);
  assert.equal(anonymous.response.status, 401);
  for (const identity of identities) {
    const token = await login(identity.email);
    const result = await read(token);
    assert.equal(result.response.status, identity.expected);
    if (identity.expected === 200) {
      assert.equal(result.value.contractVersion, "creator_audience_v1.1");
      assert.equal(result.value.context.role, identity.role);
      assert.equal(result.value.overview.accountFollowerCount, 1000);
      assert.equal(result.value.profiles.length, 2);
      assert.equal(result.value.change.state, "AVAILABLE");
      assert.equal(result.value.change.observations[0].snapshotCount, 3);
      assert.ok(result.value.contentContext.length > 0);
      assert.equal(
        result.response.headers.get("cache-control"),
        "private, no-store",
      );
      assert.match(result.response.headers.get("vary") ?? "", /Authorization/);
      assert.equal(
        (await read(token, "?creatorProfileId=" + empty.profile.id)).response
          .status,
        400,
      );
    }
    safeLog({
      gate: "REAL_HTTP_AUTH",
      role: identity.role,
      active: identity.expected === 200,
      status: result.response.status,
    });
  }
  for (const [fixture, status] of stateFixtures) {
    const result = await read(await login(fixture.email));
    assert.equal(result.response.status, 200);
    assert.equal(result.value.status, status);
    if (fixture === empty) {
      assert.equal(result.value.overview.accountFollowerCount, null);
      assert.equal(result.value.change.state, "NOT_PROCESSED");
    }
    if (fixture === stale) {
      assert.equal(result.value.freshness.state, "STALE");
      assert.equal(result.value.processingState, "FAILED");
      assert.equal(result.value.currentPreserved, true);
    }
    if (fixture === preserved)
      assert.equal(result.value.currentPreserved, true);
    if (fixture === processing)
      assert.equal(result.value.processingState, "PROCESSING");
    if (fixture === disconnected) {
      assert.equal(result.value.sourceStatus, "DISCONNECTED");
      assert.equal(result.value.currentPreserved, true);
    }
    if (fixture === capabilityUnknown)
      assert.equal(result.value.sourceStatus, "CAPABILITY_UNKNOWN");
    safeLog({
      gate: "STATE",
      fixture: fixture.email,
      status: result.value.status,
      sourceStatus: result.value.sourceStatus,
      freshness: result.value.freshness.state,
      processing: result.value.processingState,
      preserved: result.value.currentPreserved,
    });
  }
  assert.deepEqual(await rows(), beforeReads);
  assert.equal(calls, readCalls);
  assert.equal(externalAttempts, 0);
  safeLog({
    gate: "P2_PRODUCTION_BUILT_RUNTIME",
    result: "PASS",
    migrations: 104,
    lineage: await rows(),
    replayAdditionalRows: 0,
    replayAdditionalCalls: 0,
    readonlyAdditionalRows: 0,
    externalHttpAttempts: externalAttempts,
    liveGraphCalls: "NONE",
    liveModelCalls: "NONE",
    credentials: "NOT_REPORTED",
    temporaryMedia: "EPHEMERAL_CLEANUP_ON_EXIT",
  });
  if (process.argv[2] === "--serve") {
    safeLog({
      gate: "P4_FIXTURES_READY",
      frontend: "http://localhost:43491",
      backend: base,
      fixturePrefix: prefix,
    });
    await new Promise(() => {});
  }
} finally {
  await cleanup();
}
