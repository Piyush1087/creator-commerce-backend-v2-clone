# Campaign Module Phase 1 — Developer Handoff File List

**Status:** PHASE 1 HANDOFF  
**Scope:** Campaign Module Contract Completion (Phase 1A–1D) only.  
**Use:** The developer already has an older copy of this reference repository. Copy/replace the files below from current `main`; do not manually merge their contents unless production architecture requires adaptation.

## ADD

Add these files if they do not exist in the developer copy:

- `campaign/create_campaign/field_validation_reconciliation.md`
- `campaign/campaign_module_contract.md`
- `campaign/frontend/module_state_contract.md`
- `campaign/backend/module_runtime_contract.md`
- `backend/validation/campaign/campaign.schema.test.ts`
- `campaign/phase_1_developer_handoff_files.md`

## REPLACE WITH CURRENT `dummy_tcs/main` VERSION

Replace the older reference-repository versions with the current versions:

- `campaign/create_campaign/field_object_contract.yaml`
- `campaign/create_campaign/runtime_contract.yaml`
- `backend/validation/shared/campaign.shared.schema.ts`
- `backend/validation/campaign/campaign.schema.ts`

## DO NOT REPLACE FOR PHASE 1

Phase 1 does not require a structural replacement of:

- `backend/campaign_schema.prisma`
- `campaign/canonical/audience_affinities.yaml`
- `campaign/canonical/creator_archetypes.yaml`
- `campaign/canonical/kpi_framework.yaml`
- Campaign Page operational contracts under `campaign/campaign_page/`
- Add Product / Add Brief focused contracts
- Campaign Intelligence implementation (deferred)
- Collaboration implementation (independently owned/deferred)

## IMPORTANT PRODUCTION INTEGRATION NOTES

The executable validation changes intentionally remove historical Brand-input authority for derived KPI IDs and Campaign currency. Production `CampaignService` must resolve these values from the canonical KPI framework and Brand country respectively.

The current product-facing Campaign visibility values are:

- `PUBLIC`
- `ELIGIBLE_CREATORS_ONLY`
- `INVITE_ONLY`

The reference Prisma persistence currently uses different enum names. Use the explicit adapter mapping in `backend/validation/shared/campaign.shared.schema.ts`; do not rename production persistence only for UI terminology unless a production migration is intentionally approved.

The current product-facing compensation vocabulary uses `FIXED` / `NEGOTIABLE`; persistence may map `FIXED` to historical `FIXED_FEE`.

Create Campaign Drafts may be incomplete. Invalid entered field values are not canonical autosaved values. Step-completion validation and final Publish validation remain separate boundaries.

The shared normalized geography contract is still the authority for Google Maps/Places geography semantics. Prisma JSON shape alone is not sufficient validation.

## VALIDATION STATUS

Phase 1D adds focused validation tests in `backend/validation/campaign/campaign.schema.test.ts` covering the reconciled field semantics. These tests should be executed in the production/developer environment together with typecheck/lint and affected Campaign tests before merge.

This file list covers Phase 1 only. The broader frontend implementation delta created after the developer's earlier repository copy should be handed off as a separate merge package so Campaign-module contract completion is not confused with the staging frontend implementation history.
