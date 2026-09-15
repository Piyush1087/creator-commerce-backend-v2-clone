import { describe, it, expect } from "vitest";
import { RATE_CARD_OPENAPI } from "./rate-card.openapi";
describe("Strict Rate Card OpenAPI", () => {
  it("publishes independent read/write strict schemas and reconciliation semantics", () => {
    const route =
      RATE_CARD_OPENAPI.paths["/api/v1/creator/commercial-setup/rate-card"];
    expect(route.get.security).toEqual([{ creatorSession: [] }]);
    expect(route.put.description).toContain("No FX or manual currency");
    const body = route.put.requestBody.content["application/json"].schema;
    expect(body).toHaveProperty("additionalProperties", false);
    expect(body).toHaveProperty("properties.authorityFingerprint");
    expect(body).not.toHaveProperty("properties.currency");
  });
});
