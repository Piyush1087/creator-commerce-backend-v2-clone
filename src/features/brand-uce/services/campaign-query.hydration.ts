/** Pure hydration outcome helper for Phase 2 smoke verification. */
export function resolveHydrationOutcome(input: {
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  executionReady: boolean;
  activeProductCount: number;
}): string {
  const { status, executionReady, activeProductCount } = input;
  if (status === "COMPLETED" || status === "ARCHIVED")
    return "STATE_9_HISTORICAL_CAMPAIGN";
  if (status === "PAUSED") return "STATE_8_PAUSED_CAMPAIGN";
  if (status === "LIVE" && !executionReady) return "POST_LIVE_READINESS_BLOCK";
  if (status === "PUBLISHED" && activeProductCount === 0)
    return "STATE_1_PRODUCT_SETUP";
  if (status === "PUBLISHED" && !executionReady) return "STATE_2_BRIEF_SETUP";
  if (status === "LIVE") return "STATE_4_DISCOVERY_ACTIVE";
  return "DRAFT";
}

export function describeCampaignQueryHydration() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };
  assert(
    resolveHydrationOutcome({
      status: "PUBLISHED",
      executionReady: false,
      activeProductCount: 0,
    }) === "STATE_1_PRODUCT_SETUP",
    "product setup",
  );
  assert(
    resolveHydrationOutcome({
      status: "LIVE",
      executionReady: false,
      activeProductCount: 1,
    }) === "POST_LIVE_READINESS_BLOCK",
    "post-live block",
  );
  assert(
    resolveHydrationOutcome({
      status: "LIVE",
      executionReady: true,
      activeProductCount: 1,
    }) === "STATE_4_DISCOVERY_ACTIVE",
    "live discovery",
  );
}
