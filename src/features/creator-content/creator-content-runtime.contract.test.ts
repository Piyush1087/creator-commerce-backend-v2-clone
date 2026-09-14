import { describe, expect, it } from "vitest";
import {
  CREATOR_CONTENT_COMPONENT_PATHS,
  CREATOR_CONTENT_REGISTRY_KEY,
  CreatorContentProcessorInputSchema,
  creatorContentVerifiedContract,
} from "./creator-content-runtime.contract";

describe("Creator Content frozen executable bundle", () => {
  it("owns exactly one Object and the eight frozen paths", () => {
    const verified = creatorContentVerifiedContract();
    expect(verified.registration).toMatchObject({
      ...CREATOR_CONTENT_REGISTRY_KEY,
      ownedObjectSemanticIds: ["creator_content"],
      executionEnabled: true,
    });
    expect(
      verified.registration.ownedPathPatterns.map(
        (item) => item.componentPathPattern,
      ),
    ).toEqual(CREATOR_CONTENT_COMPONENT_PATHS);
    expect(CREATOR_CONTENT_COMPONENT_PATHS).toHaveLength(8);
  });

  it("fails closed for untrusted or expanded processor output", () => {
    expect(
      CreatorContentProcessorInputSchema.safeParse({
        kind: "CREATOR_CONTENT_PROCESSOR_INPUT_V1",
        value: {
          contractVersion: "creator_content_v0.1",
          rawProviderPayload: {},
        },
      }).success,
    ).toBe(false);
  });
});
