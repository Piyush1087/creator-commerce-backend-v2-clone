# MACHINE JSON CONTRACT — Intelligence Refresh (Prompt 2)

**This section is binding.** Return a **JSON array** of insight cards only.

## Per card

| Field | Rule |
| --- | --- |
| insightTitle | string, min 5 chars |
| shortDescription20Words | string, **10–150 characters** (card UI limit; stay concise) |
| priorityRank | `HIGH` \| `MEDIUM` \| `LOW` \| `NEGLIGIBLE` |
| leakBucket | `PDP` \| `PAID` \| `ROSTER` \| `CREATIVE_HOOK` |
| performanceStatus | `GREEN` \| `YELLOW` \| `RED` |
| projectedLiftPercentage | number 1–100 (omit cards below 1%) |
| drawerDeepDive.underlyingDataLogic | min 20 words |
| drawerDeepDive.competitiveDiscrepancy | min 20 words |
| drawerDeepDive.actionableStepsChecklist | min 1 step with `stepId`, `stepLabel` |

- Do **not** use JSON `null` for any field.
- Cumulative `projectedLiftPercentage` across all cards must not exceed **500**.
- Return **at least 1 card** (prefer 3–6 when data supports it). Never return an empty array.
