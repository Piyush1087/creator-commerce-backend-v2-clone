import { describe, expect, it } from "vitest";
import { WORK_PREFERENCES_OPENAPI } from "./work-preferences.openapi";
describe("Work Preferences executable OpenAPI", () => {
  it("documents authenticated read/write only from owning strict Zod contracts", () => {
    expect(WORK_PREFERENCES_OPENAPI.openapi).toBe("3.1.0");
    const path =
      WORK_PREFERENCES_OPENAPI.paths[
        "/api/v1/creator/commercial-setup/work-preferences"
      ];
    expect(Object.keys(path)).toEqual(["get", "put"]);
    expect(path.get.security).toEqual([{ creatorSession: [] }]);
    expect(path.put.responses["409"].description).toContain(
      "no partial writes",
    );
    const request = JSON.stringify(path.put.requestBody.content);
    expect(request).toContain('"additionalProperties":false');
    expect(request).toContain("confirmMonetaryReset");
    expect(request).toContain("expectedRateCardRevision");
    expect(request).not.toContain("ownerCreatorProfileId");
    expect(request).not.toContain("accessToken");
  });
});
