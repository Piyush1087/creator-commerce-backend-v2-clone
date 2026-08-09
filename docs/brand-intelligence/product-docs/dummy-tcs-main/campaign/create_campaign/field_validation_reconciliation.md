# Campaign Create/Edit Field & Validation Reconciliation

**Status:** CANONICAL / PHASE 1A

**Purpose:** Freeze the Campaign definition field semantics and validation timing before executable Zod/runtime reconciliation. This artifact records the later product decisions that govern Create Campaign, Edit Campaign, and Campaign Details/View over the same Campaign field object.

## 1. Authority

For Campaign definition semantics in Phase 1A, use this order:

1. `campaign/create_campaign/field_object_contract.yaml` — canonical Campaign field semantics and editability.
2. This reconciliation — canonical validation timing and explicit resolution of drift discovered across older executable contracts.
3. `campaign/create_campaign/runtime_contract.yaml` — runtime orchestration; to be reconciled in Phase 1B.
4. `backend/validation/campaign/campaign.schema.ts` and shared schemas — executable validation; to be reconciled after this contract freeze.
5. `backend/campaign_schema.prisma` — persistence representation; storage names may differ from product vocabulary where an explicit mapping exists.

This artifact does not redesign Create Campaign fields.

## 2. Canonical field decisions

- Campaign name: 3–60 characters.
- Publishing schedule/window: retain the rules in `field_object_contract.yaml`.
- Campaign objective: Brand-selected canonical Campaign objective.
- Primary/supporting KPIs: system-derived from Campaign objective through the canonical KPI framework; not independent Brand-authored Campaign inputs.
- MVP platform: Instagram.
- Campaign visibility product vocabulary: `PUBLIC`, `ELIGIBLE_CREATORS_ONLY`, `INVITE_ONLY`.
- Creator archetypes: canonical library, 1–5 required for step completion/publish.
- Creator following: minimum >= 0; maximum, when present, must be greater than minimum as frozen in the field contract.
- Audience gender/age/affinities: retain field-contract rules; age is 13–65 and affinity IDs are canonical.
- Audience geography: user input is acquired through Google Maps Places and persisted as structured normalized geography aligned to the shared Brand/Intelligence geography contract.
- Brand support, compensation, commercial offer, total budget, advance-payment percentage and payment terms: retain field-contract semantics.
- Advance payment values: 0/25/50/75/100 only.
- Payment terms: 7/15/30/45/60 days only.
- Campaign commercial currency is derived, not user-authored: India -> INR; United States -> USD; Rest of World -> USD.

## 3. Validation timing

Validation is progressive and interaction-aware.

### Field exit / blur

- Do not mark untouched future required fields invalid merely because the user has entered a step.
- When a user exits a field that has been entered, validate that field and any directly triggered conditional/cross-field rule.
- An invalid local form value is not accepted as a valid autosaved domain value.
- If a previously valid persisted value exists for that field, preserve it until a new valid value is accepted; otherwise the persisted field may remain unset.
- Other valid Draft fields continue to autosave independently.

### Step completion / Next

When the user selects `Next`, validate the whole current step:

- required-field presence;
- entered field validity;
- conditional requirements;
- relevant cross-field invariants;
- required derived values for that step.

If validation fails, remain on the current step and surface the relevant errors. Missing untouched required fields are first required to surface here if the user never interacted with them.

### Publish / final aggregate validation

Before Publish, validate the complete Campaign definition across all steps, including canonical references, derived KPIs and cross-field invariants. Publish must not succeed with an incomplete/invalid aggregate.

### Draft semantics

A Draft may be incomplete. A Draft should not treat an invalid entered value as an accepted canonical field value. This distinction allows autosave/resume without prematurely showing errors on untouched fields.

## 4. Create/Edit/View reuse

The Campaign definition is one field object reused by:

- Create Campaign;
- Edit Campaign;
- Campaign Details/View.

Do not create a duplicate Edit Campaign field schema. Editability differs by lifecycle and creation source, not by defining a second Campaign field object.

Existing manual-vs-AI editability decisions remain frozen and must be consolidated in the Phase 1B runtime/editability matrix rather than redesigned.

## 5. Explicit executable drift to reconcile

The current executable validation contains historical drift that must be reconciled deliberately, including:

- Campaign name currently 1–50 vs canonical 3–60.
- Audience age currently permits values outside 13–65.
- KPI IDs are currently caller-supplied even though KPI resolution is Campaign-owned/system-derived.
- Currency is currently caller-supplied even though it is Brand-country-derived.
- Advance payment currently permits any integer 0–100 instead of the canonical discrete set.
- Payout terms currently include `IMMEDIATE`, which is not part of the frozen field contract.
- Visibility uses persistence/executable names (`EVERYONE`, `ELIGIBLE_ONLY`, `INVITED_ONLY`) rather than canonical product vocabulary; an explicit translation is required if persistence names are retained.
- Total Campaign budget must be at least the commercial offer.
- Structured geography executable validation is currently generic JSON and does not by itself enforce the normalized geography contract.

These items must not be silently resolved by frontend code.

## 6. AI-generated Campaign name

The Campaign name field may be AI-authored in an AI-recommended Campaign, but the generated value remains subject to the same canonical Campaign-name field constraints and accepted Campaign ownership. The detailed AI naming-generation logic was previously discussed but is not restated in the currently available canonical repository artifacts; Phase 1A therefore does not invent or replace that prompt/reasoning policy.

## 7. Phase boundary

Phase 1A freezes field semantics and validation timing. Phase 1B will consolidate Create/Edit/View runtime behavior and lifecycle/editability. Executable Zod/service reconciliation must preserve the tested Campaign Page work and should be applied with downstream fixture/test updates rather than by breaking the current staging package mid-contract freeze.
