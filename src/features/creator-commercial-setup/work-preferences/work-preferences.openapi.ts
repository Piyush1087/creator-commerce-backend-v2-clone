import { zodToJsonSchema } from "zod-to-json-schema";
import { WorkPreferencesMutationSchema } from "../contracts/work-preferences.contract";
import { WorkPreferencesConsumerSchema } from "../contracts/commercial-consumer.contract";
const response = {
  description:
    "Source-independent canonical preferences and non-secret owning projections",
  content: {
    "application/json": {
      schema: zodToJsonSchema(WorkPreferencesConsumerSchema, {
        $refStrategy: "none",
      }),
    },
  },
};
export const WORK_PREFERENCES_OPENAPI = {
  openapi: "3.1.0",
  info: { title: "Creator Work Preferences V0", version: "0.1" },
  components: {
    securitySchemes: {
      creatorSession: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/api/v1/creator/commercial-setup/work-preferences": {
      get: {
        security: [{ creatorSession: [] }],
        description: "Active Owner/Manager/Assistant read; no mutation on GET",
        responses: {
          "200": response,
          "401": { description: "Unauthenticated" },
          "403": { description: "Inactive or unauthorized actor" },
        },
      },
      put: {
        security: [{ creatorSession: [] }],
        description:
          "Active Owner/Manager only. Serialized Owner subject, CAS and idempotency. Bank country is Settings-controlled. Future pause checked at mutation time. Currency-changing manual reset requires both current revisions and explicit confirmation once Rate Card exists.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(WorkPreferencesMutationSchema, {
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": response,
          "400": { description: "Strict invalid command" },
          "401": { description: "Unauthenticated" },
          "403": { description: "Assistant/inactive actor denied" },
          "409": {
            description:
              "Revision/key/subject/country-authority conflict; no partial writes",
          },
        },
      },
    },
  },
} as const;
