import { z } from "zod";
import {
  campaignObjectiveSchema,
  dateTimeSchema,
  entityIdSchema,
  recommendationScoreBandSchema,
  reportAvailabilitySchema,
  structuredJsonSchema,
  taxonomyIdSchema,
} from "../shared/campaign.shared.schema";

const scoreSchema = z.coerce.number().finite().min(0).max(100);

export const publishCreatorRecommendationInputSchema = z.object({
  campaignCreatorId: entityIdSchema,
  recommendationRunId: entityIdSchema,
  recommendationContextId: entityIdSchema,
  score: scoreSchema,
  scoreBand: recommendationScoreBandSchema,
  rank: z.coerce.number().int().positive(),
  explanation: z.string().optional().nullable(),
  evaluatedAt: dateTimeSchema,
});

const applicantReadySchema = z.object({
  applicationId: entityIdSchema,
  status: z.literal("READY"),
  score: scoreSchema,
  strengths: structuredJsonSchema.optional().nullable(),
  weaknesses: structuredJsonSchema.optional().nullable(),
  breakdown: structuredJsonSchema.optional().nullable(),
  intelligenceArtifactId: entityIdSchema.optional().nullable(),
  intelligenceVersion: z.string().trim().min(1).optional().nullable(),
  evaluatedAt: dateTimeSchema,
});

const applicantProcessingSchema = z.object({
  applicationId: entityIdSchema,
  status: z.literal("PROCESSING"),
  score: z.null().optional(),
  strengths: z.null().optional(),
  weaknesses: z.null().optional(),
  breakdown: z.null().optional(),
  intelligenceArtifactId: entityIdSchema.optional().nullable(),
  intelligenceVersion: z.string().trim().min(1).optional().nullable(),
  evaluatedAt: dateTimeSchema.optional().nullable(),
});

const applicantUnavailableSchema = applicantProcessingSchema.extend({
  status: z.literal("UNAVAILABLE"),
});

export const publishApplicantIntelligenceInputSchema = z.discriminatedUnion("status", [
  applicantReadySchema,
  applicantProcessingSchema,
  applicantUnavailableSchema,
]);

export const publishCampaignReportCalculationInputSchema = z.object({
  campaignId: entityIdSchema,
  version: z.coerce.number().int().positive(),
  objective: campaignObjectiveSchema,
  primaryKpiId: taxonomyIdSchema,
  supportingKpiIds: z.array(taxonomyIdSchema).default([]),
  reportingVersion: z.string().trim().min(1),
  reportContextHash: z.string().trim().min(1).optional().nullable(),
  availability: reportAvailabilitySchema,
  dataFrom: dateTimeSchema,
  dataThrough: dateTimeSchema,
  metrics: structuredJsonSchema,
  insights: structuredJsonSchema.optional().nullable(),
  provenance: structuredJsonSchema.optional().nullable(),
  isFinal: z.boolean().default(false),
  calculatedAt: dateTimeSchema,
}).superRefine((value, ctx) => {
  if (value.dataThrough < value.dataFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataThrough"], message: "dataThrough must be >= dataFrom." });
  }
});
