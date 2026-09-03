import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { ChatResponseValidationService } from "./chat-response-validation.service";
import type { ChatGroundedResponse } from "./chat-response.contract";
import { CHAT_RESPONSE_STATUSES } from "./chat-response.contract";

describe("Chat response contract and evidence validation", () => {
  const validator = new ChatResponseValidationService();
  const brand = { type: "BRAND" as const, id: "brand-a" };
  const evidence = {
    invokedCapabilityIds: ["brand.current.read"],
    authorizedEntityRefs: [brand],
    allowedNavigationDestinationIds: ["BRAND_CENTRE"],
    executedGroundingResultRefs: [
      {
        capabilityId: "brand.current.read",
        resultRefs: ["brand.current:brand-a"],
      },
    ],
  };

  const response = (
    status: (typeof CHAT_RESPONSE_STATUSES)[number],
  ): ChatGroundedResponse => ({
    contractVersion: "1.0",
    status,
    answer: "Server-grounded answer",
    grounding: [
      {
        sourceType: "CANONICAL",
        capabilityId: "brand.current.read",
        entityRefs: [brand],
      },
    ],
    entityRefs: [brand],
    freshnessNotes: [],
    limitations: [],
    ...(status === "NAVIGATION"
      ? { navigation: { destinationId: "BRAND_CENTRE", entityRef: brand } }
      : {}),
  });

  it.each(CHAT_RESPONSE_STATUSES)("accepts the %s status", (status) => {
    expect(validator.validate(response(status), evidence).status).toBe(status);
  });

  it("requires non-mutating recommendations and rejects unknown vocabularies", () => {
    expect(() =>
      validator.validate(
        {
          ...response("ANSWERED"),
          recommendation: {
            text: "Consider this",
            basisRefs: ["brand-a"],
            nonMutating: false,
          },
        },
        evidence,
      ),
    ).toThrow();
    expect(() =>
      validator.validate({ ...response("ANSWERED"), status: "DONE" }, evidence),
    ).toThrow();
    expect(() =>
      validator.validate(
        {
          ...response("ANSWERED"),
          grounding: [
            {
              sourceType: "MODEL",
              capabilityId: "brand.current.read",
              entityRefs: [brand],
            },
          ],
        },
        evidence,
      ),
    ).toThrow();
  });

  it("accepts recommendation basis refs produced by executed authorized grounding", () => {
    expect(
      validator.validate(
        {
          ...response("ANSWERED"),
          recommendation: {
            text: "Review the current Brand state.",
            basisRefs: ["brand.current:brand-a"],
            nonMutating: true,
          },
        },
        evidence,
      ).recommendation,
    ).toMatchObject({ basisRefs: ["brand.current:brand-a"] });
  });

  it.each(["unknown:result", "foreign:result"])(
    "rejects unexecuted recommendation basis ref %s",
    (basisRef) => {
      expect(() =>
        validator.validate(
          {
            ...response("ANSWERED"),
            recommendation: {
              text: "Review this.",
              basisRefs: [basisRef],
              nonMutating: true,
            },
          },
          evidence,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it("rejects a basis ref asserted through a non-invoked capability", () => {
    expect(() =>
      validator.validate(
        {
          ...response("ANSWERED"),
          recommendation: {
            text: "Review this.",
            basisRefs: ["campaign.read:foreign"],
            nonMutating: true,
          },
        },
        {
          ...evidence,
          executedGroundingResultRefs: [
            ...evidence.executedGroundingResultRefs,
            {
              capabilityId: "campaign.read",
              resultRefs: ["campaign.read:foreign"],
            },
          ],
        },
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects execution claims from a non-mutating response", () => {
    expect(() =>
      validator.validate(
        { ...response("ANSWERED"), answer: "I approved the campaign." },
        evidence,
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects grounding, entity refs, and navigation not proven by server evidence", () => {
    expect(() =>
      validator.validate(
        {
          ...response("ANSWERED"),
          grounding: [
            {
              sourceType: "CANONICAL",
              capabilityId: "campaign.read",
              entityRefs: [brand],
            },
          ],
        },
        evidence,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate(
        {
          ...response("ANSWERED"),
          entityRefs: [{ type: "CAMPAIGN", id: "foreign" }],
        },
        evidence,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate(
        {
          ...response("NAVIGATION"),
          navigation: { destinationId: "ADMIN" },
        },
        evidence,
      ),
    ).toThrow(BadRequestException);
  });
});
