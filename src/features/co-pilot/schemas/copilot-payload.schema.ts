import { z } from "zod";

export const MetricStatusColorSchema = z.enum([
  "GREEN",
  "YELLOW",
  "RED",
  "NEUTRAL",
]);

export const MetricItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  changePercentage: z.number().optional(),
  statusColor: MetricStatusColorSchema,
});

export const CoPilotFormatTypeSchema = z.enum([
  "CONVERSATIONAL_NARRATIVE",
  "METRIC_HIGHLIGHT_GRID",
  "TABULAR_AUDIT_DATA",
  "POLYMORPHIC_ENTITY_CAROUSEL",
  "INTERACTIVE_EXECUTION_WIDGET",
  "SLOT_FILLING_CLARIFICATION",
  "VALIDATION_CHECKLIST",
]);

export const SlotFieldSchema = z.object({
  fieldName: z.string(),
  uiLabel: z.string(),
  inputType: z.enum(["TEXT", "NUMBER", "SINGLE_SELECT", "DATE"]),
  selectOptions: z.array(z.string()).optional(),
  placeholderText: z.string(),
});

export const SlotFillingSchema = z.object({
  intentWorkspaceContext: z.string(),
  stagedPayload: z.record(z.unknown()),
  missingSlots: z.array(SlotFieldSchema),
});

export const HitlResolutionSchema = z.object({
  status: z.enum(["CONFIRMED", "DISCARDED"]),
  resolvedAt: z.string().datetime(),
  summary: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  campaignName: z.string().optional(),
  plannerCardId: z.string().uuid().optional(),
  brandCentreJobId: z.string().uuid().optional(),
});

export const ExecutionWidgetSchema = z.object({
  formTargetRoute: z.string(),
  idempotencyKey: z.string().uuid(),
  prefilledFields: z.record(z.unknown()),
  requiredZodValidationSchemaName: z.string(),
  primaryActionLabel: z.string(),
  cancelActionLabel: z.string(),
  resolution: HitlResolutionSchema.optional(),
});

export const DataTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))),
  actionButtonLabel: z.string().optional(),
  targetEntityId: z.string().uuid().optional(),
});

export const EntityCardSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string(),
  subtitle: z.string(),
  imageUrl: z.string().url().optional(),
  metadataPills: z.array(z.string()),
  primaryMetric: z.string().optional(),
  actionType: z.enum([
    "SHORTLIST",
    "VIEW_PROFILE",
    "SELECT_PRODUCT",
    "EDIT_BRIEF",
  ]),
});

export const ValidationChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  satisfied: z.boolean(),
  helpText: z.string().optional(),
  repairHint: z.string().optional(),
});

export const ValidationChecklistDataSchema = z.object({
  title: z.string(),
  action: z.string(),
  code: z.string(),
  campaignId: z.string().uuid().optional(),
  campaignName: z.string().optional(),
  autoResume: z.boolean(),
  deepLinkPath: z.string().optional(),
  items: z.array(ValidationChecklistItemSchema),
  primaryActionLabel: z.string(),
  cancelActionLabel: z.string(),
  /** Same HITL idempotency key so "Try again" can re-confirm. */
  idempotencyKey: z.string().uuid().optional(),
});

export const GeminiCoPilotOutputSchema = z.object({
  formatType: z.literal("CONVERSATIONAL_NARRATIVE"),
  narrativeText: z.string().min(1),
});

export const CoPilotChatPayloadSchema = z.object({
  messageId: z.string().uuid(),
  threadId: z.string().uuid(),
  timestamp: z.string().datetime(),
  formatType: CoPilotFormatTypeSchema,
  narrativeText: z.string(),
  metricGridData: z.array(MetricItemSchema).optional(),
  tableData: DataTableSchema.optional(),
  carouselEntities: z.array(EntityCardSchema).optional(),
  slotFillingData: SlotFillingSchema.optional(),
  executionWidget: ExecutionWidgetSchema.optional(),
  validationChecklistData: ValidationChecklistDataSchema.optional(),
});

export type MetricItem = z.infer<typeof MetricItemSchema>;
export type DataTableData = z.infer<typeof DataTableSchema>;
export type EntityCardData = z.infer<typeof EntityCardSchema>;
export type SlotFillingData = z.infer<typeof SlotFillingSchema>;
export type ExecutionWidgetData = z.infer<typeof ExecutionWidgetSchema>;
export type ValidationChecklistData = z.infer<
  typeof ValidationChecklistDataSchema
>;
export type GeminiCoPilotOutput = z.infer<typeof GeminiCoPilotOutputSchema>;
export type CoPilotChatPayload = z.infer<typeof CoPilotChatPayloadSchema>;
