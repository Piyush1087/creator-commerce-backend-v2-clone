// Run after npm run build, only with an injected disposable bs02_* DATABASE_URL.
require("reflect-metadata");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { Test } = require("@nestjs/testing");
const { ThrottlerModule } = require("@nestjs/throttler");
const { JwtService } = require("@nestjs/jwt");
const { PrismaClient } = require("@prisma/client");
const {
  BrandTeamInvitationsController,
} = require("../dist/features/brand-settings/brand-team-invitations.controller");
const {
  BrandTeamInvitationsService,
  hashInvitationToken,
} = require("../dist/features/brand-settings/services/brand-team-invitations.service");
const { AuthService } = require("../dist/features/auth/auth.service");

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.startsWith("/bs02_")
  )
    throw new Error("Disposable local bs02_* database required");
  const db = new PrismaClient();
  const jwt = new JwtService({ secret: randomBytes(32).toString("hex") });
  const service = new BrandTeamInvitationsService(
    db,
    undefined,
    new AuthService(db, jwt),
    undefined,
  );
  let app, org, brand;
  try {
    org = await db.organization.create({ data: { name: "BS02 HTTP smoke" } });
    brand = await db.brandProfile.create({
      data: {
        name: "BS02 HTTP Brand",
        domain: `${randomUUID()}.example.test`,
        industry: "D2C",
        organizationId: org.id,
      },
    });
    const raw = randomBytes(32).toString("hex");
    await db.teamInvitation.create({
      data: {
        brandProfileId: brand.id,
        email: `${randomUUID()}@example.test`,
        token: hashInvitationToken(raw),
        role: "FINANCE_ADMIN",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const expiredRaw = randomBytes(32).toString("hex");
    const expired = await db.teamInvitation.create({
      data: {
        brandProfileId: brand.id,
        email: `${randomUUID()}@example.test`,
        token: hashInvitationToken(expiredRaw),
        role: "CAMPAIGN_MANAGER",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 120 }]),
      ],
      controllers: [BrandTeamInvitationsController],
      providers: [{ provide: BrandTeamInvitationsService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, "127.0.0.1");
    const origin = await app.getUrl();
    const post = (action, body) =>
      fetch(`${origin}/api/v1/brand/team-invitations/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    let response = await post("inspect", { token: raw });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).requires_account_bootstrap, true);
    response = await post("accept", {
      token: raw,
      password: randomBytes(18).toString("hex"),
    });
    assert.equal(response.status, 200);
    const accepted = await response.json();
    assert.equal(jwt.verify(accepted.accessToken).sub, accepted.user.id);
    assert.equal((await post("accept", { token: raw })).status, 409);
    assert.equal((await post("inspect", {})).status, 400);
    assert.equal((await post("inspect", { token: expiredRaw })).status, 410);
    assert.equal(
      (await db.teamInvitation.findUnique({ where: { id: expired.id } }))
        .status,
      "EXPIRED",
    );
    assert.equal(
      (await post("inspect", { token: hashInvitationToken(raw) })).status,
      400,
    );
    let limited = false;
    for (let i = 0; i < 12; i++)
      if (
        (await post("inspect", { token: randomBytes(32).toString("hex") }))
          .status === 429
      )
        limited = true;
    assert.equal(limited, true);
    console.log(
      "BS-02 HTTP smoke: 7 checks passed (inspect/no-store, accept/JWT, replay, committed expiry, missing token, digest rejection, throttle).",
    );
  } finally {
    if (app) await app.close();
    if (brand) {
      await db.teamInvitation.deleteMany({
        where: { brandProfileId: brand.id },
      });
      await db.brandProfile.delete({ where: { id: brand.id } });
    }
    if (org) {
      await db.user.deleteMany({ where: { organizationId: org.id } });
      await db.organization.delete({ where: { id: org.id } });
    }
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("BS-02 HTTP smoke failed (sensitive payloads omitted).");
  process.exitCode = 1;
});
