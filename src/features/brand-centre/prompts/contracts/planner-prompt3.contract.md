# MACHINE JSON CONTRACT — Planner Aggregate (Prompt 3)

**This section is binding.** Return exactly **one JSON object** — never an array, never markdown fences.

## Root object (required)

| Field | Rule |
| --- | --- |
| cardType | `NEW_CAMPAIGN` \| `SUGGESTED_UPDATE` \| `AUTO_PAUSE_LOG` |
| aggregationKey | object with `objective`, `targetCreatorTier`, `aiContextHook` (string ≥5) |
| existingTargetCampaignId | UUID string or `null` |
| campaignMetadata | audience + budget + ISO deadline |
| assetsAndBriefsMatrix | array, min 1 entity with production briefs |
| workflowStatus | optional; default `PENDING_USER_REVIEW` |

## aggregationKey enums

- **objective:** `PULSE`, `PROOF`, `PUSH`, `PRODUCTION`
- **targetCreatorTier:** `NANO`, `MICRO`, `MID_TIER`, `MEGA`, `CELEBRITY`

## Card type rules

- `NEW_CAMPAIGN` → `existingTargetCampaignId` must be `null`
- `SUGGESTED_UPDATE` → `existingTargetCampaignId` must be a valid UUID from `ACTIVE_RUNNING_CAMPAIGNS_JSON`
- `AUTO_PAUSE_LOG` → `workflowStatus` = `AUTO_EXECUTED_BYPASS`

## Budget

- `minAllocationThreshold` ≥ 500
- `maxAllocationThreshold` ≥ min

## entities in assetsAndBriefsMatrix

- **entityType:** `PRODUCT`, `MODULE`, `TREATMENT`, `EXPERIENCE`, `COLLECTION` (optional)
- Each entity: ≥1 `productionBriefs` with `requiredDeliverables` (quantity ≥ 1)

## Do not

- Wrap the object in `[...]`
- Use JSON `null` for optional strings — omit or use explicit `null` only where schema allows (`existingTargetCampaignId`)
