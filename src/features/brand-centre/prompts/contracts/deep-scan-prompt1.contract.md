# MACHINE JSON CONTRACT — Deep Scan (Prompt 1)

**This section is binding.** Output must pass server validation. When unsure, omit a field or use the defaults below — never invent invalid types.

## Global rules

- Return **one JSON object** only (no markdown fences).
- **Do not use JSON `null`.** Omit optional fields instead. For missing social handles, **omit** `ytHandle` / `tiktokHandle` / `igHandle` entirely.
- Social handles must start with `@` when present.

## `brandProfile` (optional)

| Field | Type | Notes |
| --- | --- | --- |
| logoUrl | string (URL) | omit if unknown |
| igHandle, ytHandle, tiktokHandle | string | omit if brand has no account |
| lifecycleStage | string | omit if unknown |

## `inventoryInfrastructure.entities[]`

| Field | Rule |
| --- | --- |
| entityType | **Only:** `PRODUCT`, `MODULE`, `TREATMENT`, `EXPERIENCE`, `COLLECTION` |
| entityName | min 2 chars |
| entityUrl | must match `BRAND_URL` domain |
| sellingPoints | **exactly 3** strings |
| productDoNotSay | optional string array |

Use `COLLECTION` for bundles / kits / multi-SKU pages. Do **not** use `SERVICE` or other labels.

## `baselineHealth.archetypeMatch`

Both distributions must use keys `everyman`, `expert`, `jester`, `rebel` as **integers** that sum to **exactly 100**.

Example (required pattern):

```json
"ourBrandDistribution": { "everyman": 25, "expert": 25, "jester": 25, "rebel": 25 }
```

## `financials.strategyMix`

- `assetMix`: product + collection + sale = **100**
- `tierMix`: nano + micro + midTier + mega + celebrity = **100**
- `objectiveMix`: pulse + proof + push + production = **100**

## `offersLedger`

Array of offers with ISO datetimes for `validityStart` / `validityEnd`. May be `[]`.

## `growthImpactMatrix`

- `statusIndicator`: `GREEN` | `YELLOW` | `RED`
- `projectedRevenueLiftPercentage`: 0–500
