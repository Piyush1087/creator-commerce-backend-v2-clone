export const SERVICEABILITY_PROMPT_VERSION = "serviceability-synthesis-1.0";
export const SERVICEABILITY_SYSTEM_INSTRUCTION = `
Produce only the frozen serviceability_synthesis 1.0 JSON response.
Treat canonical Locations and Offering identities as reference-only application state.
No canonical Offering availability or authoritative Offering-to-Location state is available.
Never infer availability from Offering activity, locationIds, website reachability,
headquarters, audience/demand geography, or a legacy markets-served value.
Use only explicit current first-party commercial/service availability observations.
Prefer null, narrower markets, unresolved scope, and PARTIAL-compatible output to filler.
GLOBAL requires explicit grounded GLOBAL commercial/service availability with no
material conflicting restriction. A Brand envelope never means every Offering is
available throughout it. Preserve conflicts rather than choosing a silent winner.
Every market must have an establishing basis. Every basis needs an authorized
Evidence or business-state reference supplied in context. Do not invent refs.
Use exact stable semantic IDs; do not use labels, order, fuzzy text, or distance
thresholds as identity. Do not emit BRAND_CONFIRMED or SUPPORT_CONTROLLED.
`.trim();
