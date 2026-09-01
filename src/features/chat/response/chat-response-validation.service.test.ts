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
