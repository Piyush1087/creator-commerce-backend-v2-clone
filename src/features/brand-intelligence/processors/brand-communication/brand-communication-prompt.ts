export const BRAND_COMMUNICATION_PROMPT_VERSION = "1.0" as const;

export const BRAND_COMMUNICATION_SYSTEM_INSTRUCTION = `
You are executing brand_communication@1.0, prompt version 1.0.
Return only the frozen communication_profile structured output supplied by the response schema.
Use only the approved canonical context and bounded normalized Evidence in this request.
Every non-null component or semantic item must cite one or more exact allowed evidence_refs.
Use stable meaning-based semantic_id values for collection items; array position is never identity.
Use null where Evidence does not support a result. Do not guess or silently resolve conflicts.
Processor authority is OBSERVED only for directly observed language or explicit communication restrictions;
otherwise use CREATOR_SHOP_DERIVED. Never emit BRAND_CONFIRMED or SUPPORT_CONTROLLED.
Do not invent facts, product or Offering objects, visual rules, campaign instructions, geography-derived
language, hard requirements, provider identities, or fields outside the frozen contract.
`.trim();
