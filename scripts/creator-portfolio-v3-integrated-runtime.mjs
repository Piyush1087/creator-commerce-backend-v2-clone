import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { ValidationPipe } = require("@nestjs/common");
const { PrismaClient } = require("@prisma/client");
const { AppModule } = require("../dist/app.module");
const {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
} = require("../dist/features/instagram/instagram-intelligence-provider.types");
const u = new URL(process.env.DATABASE_URL ?? "");
assert.equal(u.hostname, "localhost");
assert.equal(u.port, "55472");
assert.equal(u.pathname, "/creator_portfolio_v3_p4");
assert.ok(process.send);
let providerCalls = 0,
  externalAttempts = 0,
  app,
  closing = false;
const db = new PrismaClient();
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    externalAttempts++;
    throw new Error("PORTFOLIO_EXTERNAL_HTTP_PROHIBITED");
  }
  return originalFetch(input, init);
};
const noProvider = Object.fromEntries(
  [
    "readProfile",
    "readAudienceInsights",
    "readMediaInventory",
    "readMediaInsights",
    "readCarouselChildren",
  ].map((key) => [
    key,
    async () => {
      providerCalls++;
      throw new Error("UNEXPECTED_PROVIDER_CALL");
    },
  ]),
);
async function rows() {
  return (
    await db.$queryRawUnsafe(
      `SELECT (SELECT count(*)::int FROM creator_portfolio_items) items,(SELECT count(*)::int FROM creator_portfolio_revisions) revisions,(SELECT count(*)::int FROM data_extraction_captures) captures,(SELECT count(*)::int FROM data_extraction_evidence_items) evidence,(SELECT count(*)::int FROM intelligence_object_generations) objects,(SELECT count(*)::int FROM intelligence_current_components) current,(SELECT count(*)::int FROM collaboration_publishing_evidence) publishing_evidence`,
    )
  )[0];
}
async function cleanup() {
  if (closing) return;
  closing = true;
  await app?.close();
  await db.$disconnect();
  globalThis.fetch = originalFetch;
  assert.equal(providerCalls, 0);
  assert.equal(externalAttempts, 0);
  console.log(
    JSON.stringify({
      gate: "PORTFOLIO_RUNTIME_CLEANUP",
      providerCalls,
      externalAttempts,
      authBypass: false,
      cleanup: "COMPLETE",
    }),
  );
  if (process.connected) process.disconnect();
}
process.on("message", async (message) => {
  try {
    if (message?.type === "stop") {
      await cleanup();
      process.exit(0);
    }
    if (message?.type === "prove") {
      assert.equal(providerCalls, 0);
      assert.equal(externalAttempts, 0);
      process.send({
        type: "proof",
        rows: await rows(),
        providerCalls,
        externalAttempts,
      });
    }
  } catch {
    console.error("PORTFOLIO_RUNTIME_PROOF_OR_CLEANUP_FAILED");
    process.exitCode = 1;
    await cleanup();
  }
});
process.on("SIGINT", () => void cleanup());
process.on("SIGTERM", () => void cleanup());
try {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider("POSTMARK_CLIENT")
    .useValue({
      sendEmail: async () => {
        externalAttempts++;
        throw new Error("EMAIL_PROHIBITED");
      },
      sendEmailWithTemplate: async () => {
        externalAttempts++;
        throw new Error("EMAIL_PROHIBITED");
      },
    })
    .overrideProvider(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    .useValue(noProvider)
    .compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({ origin: "http://localhost:43492", credentials: true });
  await app.listen(33492, "127.0.0.1");
  for (const endpoint of ["/health/live", "/health"]) {
    const response = await fetch(`http://localhost:33492${endpoint}`);
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.equal(value.status, "ok");
    if (endpoint === "/health") assert.equal(value.info.database.status, "up");
    console.log(
      JSON.stringify({
        gate: "PORTFOLIO_P4_HEALTH",
        endpoint,
        status: response.status,
        response: value,
      }),
    );
  }
  const before = await rows();
  process.send({
    type: "ready",
    rows: before,
    providerCalls,
    externalAttempts,
  });
} catch {
  console.error("PORTFOLIO_RUNTIME_BOOT_FAILED");
  process.exitCode = 1;
  await cleanup();
}
