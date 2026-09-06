// Run after build with an injected disposable loopback bs06_* DATABASE_URL.
require("reflect-metadata");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { Test } = require("@nestjs/testing");
const { SchedulerRegistry } = require("@nestjs/schedule");
const { JwtService } = require("@nestjs/jwt");
const { PrismaService } = require("../dist/prisma/prisma.service");
const {
  InstagramOAuthClient,
} = require("../dist/features/instagram/instagram-oauth.client");
const {
  InstagramGraphClient,
} = require("../dist/features/instagram/instagram-graph.client");
const {
  BrandIntegrationTokenExpiryScheduler,
} = require("../dist/features/brand-settings/schedulers/brand-integration-token-expiry.scheduler");

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
    !database.pathname.startsWith("/bs06_")
  )
    throw new Error("Disposable loopback bs06_* database required");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.SETTINGS_FIELD_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  // No real provider credentials are configured or printed. Fail closed on network.
  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    if (!new URL(String(url)).hostname.match(/^(localhost|127\.0\.0\.1)$/))
      throw new Error("External network disabled in BS06 smoke");
    return originalFetch(url, options);
  };
  const { AppModule } = require("../dist/app.module");
  let exchanges = 0;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider("POSTMARK_CLIENT")
    .useValue({
      sendEmailWithTemplate: () => {
        throw new Error("Unexpected mail");
      },
    })
    .overrideProvider(InstagramOAuthClient)
    .useValue({
      buildAuthorizeUrl: (redirectUri, state) =>
        `https://provider.example.test/authorize?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
      exchangeAuthorizationCode: async () => {
        exchanges++;
        return {
          accessToken: randomBytes(32).toString("hex"),
          expiresInSeconds: 3600,
          permissions: [
            "instagram_business_basic",
            "instagram_business_manage_insights",
          ],
        };
      },
    })
    .overrideProvider(InstagramGraphClient)
    .useValue({
      fetchMe: async () => ({ username: "brand", accountType: "BUSINESS" }),
      fetchGrantedPermissions: async () => [],
    })
    .compile();
  const app = module.createNestApplication({ logger: false });
  const db = app.get(PrismaService);
  let org, brand;
  try {
    await app.listen(0, "127.0.0.1");
    assert(app.get(BrandIntegrationTokenExpiryScheduler));
    const registry = app.get(SchedulerRegistry);
    const job = registry.getCronJob("brand-instagram-token-expiry");
    assert.equal(job.isActive, true);
    assert.equal(job.cronTime.source, "0 0 * * *");
    org = await db.organization.create({ data: { name: "BS06 HTTP smoke" } });
    brand = await db.brandProfile.create({
      data: {
        name: "BS06",
        domain: `${randomUUID()}.example.test`,
        industry: "D2C",
        organizationId: org.id,
        igHandle: "brand",
        isVerified: true,
      },
    });
    const user = await db.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        role: "BRAND",
        organizationId: org.id,
      },
    });
    const member = await db.brandTeamMember.create({
      data: { brandProfileId: brand.id, userId: user.id, role: "BRAND_OWNER" },
    });
    const token = app
      .get(JwtService)
      .sign({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      });
    const origin = await app.getUrl();
    const prefix = `${origin}/api/v1/brand/settings/integrations`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const redirectUri = "http://localhost:5173/brand/settings/integrations";
    assert.equal(
      (
        await fetch(
          `${prefix}/instagram/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
        )
      ).status,
      401,
    );
    const start = await fetch(
      `${prefix}/instagram/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
      { headers },
    );
    assert.equal(start.status, 200);
    assert.equal(start.headers.get("cache-control"), "no-store");
    const state = new URL((await start.json()).url).searchParams.get("state");
    const post = (body) =>
      fetch(`${prefix}/instagram/connect`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    assert.equal((await post({ code: "synthetic", redirectUri })).status, 400);
    assert.equal(
      (
        await post({
          code: "synthetic",
          redirectUri,
          state: randomBytes(32).toString("base64url"),
        })
      ).status,
      400,
    );
    assert.equal(exchanges, 0);
    const connected = await post({ code: "synthetic", redirectUri, state });
    assert.equal(connected.status, 200);
    const integration = await connected.json();
    assert.equal(integration.connected, true);
    assert.equal(exchanges, 1);
    assert.equal(
      (await post({ code: "synthetic", redirectUri, state })).status,
      400,
    );
    assert.equal(exchanges, 1);
    await db.brandIntegration.update({
      where: { id: integration.integrationId },
      data: { tokenExpiresAt: new Date(Date.now() - 1000) },
    });
    await job.fireOnTick();
    let expired;
    for (let tries = 0; tries < 100; tries++) {
      expired = await db.brandIntegration.findUniqueOrThrow({
        where: { id: integration.integrationId },
      });
      if (expired.status === "TOKEN_EXPIRED") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(expired.status, "TOKEN_EXPIRED");
    await db.brandTeamMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });
    assert.equal(
      (
        await fetch(
          `${prefix}/instagram/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
          { headers },
        )
      ).status,
      403,
    );
    console.log(
      "BS-06 HTTP/scheduler smoke: 11 checks passed; actual AppModule boot, active daily cron, callback invocation, JWT/membership, no-store, state validation/replay and fake exchange.",
    );
  } finally {
    if (brand) await db.brandProfile.delete({ where: { id: brand.id } });
    if (org) {
      await db.user.deleteMany({ where: { organizationId: org.id } });
      await db.organization.delete({ where: { id: org.id } });
    }
    await app.close();
    await db.$disconnect();
    global.fetch = originalFetch;
  }
}
main().catch((error) => {
  // Only stack frame location and error name; never dump request/provider payloads.
  console.error(
    "BS-06 smoke failed:",
    error.name,
    error.stack?.split("\n").slice(1, 3).join("\n"),
  );
  process.exitCode = 1;
});
