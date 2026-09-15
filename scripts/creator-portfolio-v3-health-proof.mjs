import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { AppModule } = require("../dist/app.module");
const {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
} = require("../dist/features/instagram/instagram-intelligence-provider.types");
const route = new URL(process.env.DATABASE_URL ?? "");
assert.equal(route.hostname, "localhost");
assert.equal(route.port, "55472");
assert.ok(
  ["/creator_portfolio_v3_p2", "/creator_portfolio_v3_p4"].includes(
    route.pathname,
  ),
);
process.env.C03_INVITATION_IDENTITY_HMAC_PEPPER ??=
  randomBytes(32).toString("hex");
let externalAttempts = 0,
  providerCalls = 0,
  app;
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
const noProvider = {
  readProfile: async () => {
    providerCalls++;
    throw new Error("UNEXPECTED_PROVIDER_CALL");
  },
  readAudienceInsights: async () => {
    providerCalls++;
    throw new Error("UNEXPECTED_PROVIDER_CALL");
  },
  readMediaInventory: async () => {
    providerCalls++;
    throw new Error("UNEXPECTED_PROVIDER_CALL");
  },
  readMediaInsights: async () => {
    providerCalls++;
    throw new Error("UNEXPECTED_PROVIDER_CALL");
  },
  readCarouselChildren: async () => {
    providerCalls++;
    throw new Error("UNEXPECTED_PROVIDER_CALL");
  },
};
try {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider("POSTMARK_CLIENT")
    .useValue({
      sendEmail: async () => {
        externalAttempts++;
        throw new Error("EXTERNAL_EMAIL_PROHIBITED");
      },
      sendEmailWithTemplate: async () => {
        externalAttempts++;
        throw new Error("EXTERNAL_EMAIL_PROHIBITED");
      },
    })
    .overrideProvider(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    .useValue(noProvider)
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.listen(33492, "127.0.0.1");
  for (const endpoint of ["/health/live", "/health"]) {
    const response = await fetch(`http://localhost:33492${endpoint}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    if (endpoint === "/health") assert.equal(body.info.database.status, "up");
    console.log(
      JSON.stringify({
        gate: "PORTFOLIO_PRODUCTION_HEALTH",
        endpoint,
        status: response.status,
        response: body,
      }),
    );
  }
  assert.equal(providerCalls, 0);
  assert.equal(externalAttempts, 0);
  console.log(
    JSON.stringify({
      gate: "PORTFOLIO_PRODUCTION_BOOT",
      providerCalls,
      externalAttempts,
      authBypass: false,
    }),
  );
} finally {
  await app?.close();
  globalThis.fetch = originalFetch;
  console.log("Portfolio-owned backend health process cleanup COMPLETE");
}
