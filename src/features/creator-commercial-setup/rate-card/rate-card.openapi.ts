import { zodToJsonSchema } from "zod-to-json-schema";
import { RateCardMutationSchema } from "../contracts/rate-card.contract";
import { RateCardConsumerSchema } from "../contracts/commercial-consumer.contract";
const response = {
  description:
    "Starting-from references; Campaign and final agreement supersede these preferences",
  content: {
    "application/json": {
      schema: zodToJsonSchema(RateCardConsumerSchema, { $refStrategy: "none" }),
    },
  },
};
export const RATE_CARD_OPENAPI = {
  openapi: "3.1.0",
  info: { title: "Creator Rate Card V0", version: "0.1" },
  components: {
    securitySchemes: {
      creatorSession: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/api/v1/creator/commercial-setup/rate-card": {
      get: {
        security: [{ creatorSession: [] }],
        description:
          "Active Owner/Manager/Assistant; no writes. Stale authority hides money and retains rights/payment preferences.",
        responses: {
          "200": response,
          "401": { description: "Unauthenticated" },
          "403": { description: "Inactive or unauthorized" },
        },
      },
      put: {
        security: [{ creatorSession: [] }],
        description:
          "Active Owner/Manager only; exact Work Preferences revision, Rate Card revision and current authority fingerprint. When stored authority is stale, this write reconciles first: same-currency money is preserved; cross-currency money clears. New money is entered by a subsequent revision. No FX or manual currency.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(RateCardMutationSchema, {
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": response,
          "400": { description: "Invalid strict command" },
          "401": { description: "Unauthenticated" },
          "403": { description: "Assistant/inactive denied" },
          "409": {
            description:
              "Revision/key/subject/country fence conflict; no partial writes",
          },
        },
      },
    },
  },
} as const;
