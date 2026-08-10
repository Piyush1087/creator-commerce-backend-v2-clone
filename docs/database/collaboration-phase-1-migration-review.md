# Collaboration Phase 1 migration review

This migration adds the canonical Application-based Collaboration persistence
foundation without deleting legacy UCE Collaboration tables or legacy child
records that are still read by production code.

## Identity and rollout

- `collaborations.source_application_id` is unique and is the only supported
  identity for newly provisioned Collaborations.
- It is temporarily nullable so existing production Collaboration rows can be
  retained and backfilled safely. New provisioning never creates a null value.
- The old Campaign/Creator unique constraint is dropped and replaced with a
  non-unique lookup index, allowing distinct approved Applications for the same
  Campaign and Creator.
- A later reviewed migration may make `source_application_id` non-null after
  legacy rows have been mapped or explicitly classified as non-canonical.

## New upstream lineage

The migration adds the minimum canonical Campaign persistence needed by
Collaboration: Campaign Creator, Application/Application Snapshot, and
first-class Brief Deliverable records. Existing UCE Campaign Product and Brief
tables are adapted as Campaign Asset and Brief sources rather than replaced.

## Locked execution records

New tables persist the execution snapshot, neutral commercial agreement,
fulfillment applicability, per-Deliverable execution/publishing state, and
creation events. `publishing_required` is non-null and has no database default.

## Intentionally retained legacy structures

`UceCampaignCollaboration`, `CollaborationCommercial`,
`CollaborationLogistics`, `CollaborationMedia`,
`CollaborationFinalization`, existing messages, escrow locks, and inbox
projection fields remain for compatibility and migration/reference. New
provisioning writes canonical records while creating only the legacy one-to-one
rows required by the current Phase 1 read model. These records are not the new
workflow authority.

## Operational prerequisites

Before approving an Application, its Brief must have first-class
`UceBriefDeliverable` rows and the caller must explicitly resolve
`publishingRequired` for every one. Existing JSON-only deliverable inventories
need a separate reviewed data backfill; no derivation rule is invented here.

Review and deploy the SQL manually. No production migration is run by startup.
