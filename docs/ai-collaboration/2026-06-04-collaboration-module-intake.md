# Collaboration module intake (2026-06-04)

## Source of truth

- `docs/collaboration/product-docs/` (read-only product requirements)

## Schema

- `UserRole.INFLUENCER` renamed to `CREATOR` (Postgres enum value rename).
- New unified workflow tables: `collaborations`, `collaboration_commercials`,
  `collaboration_logistics`, `collaboration_media`, `collaboration_finalization`,
  `collaboration_messages`.
- Creator prerequisites: `creator_profiles`, `creator_bank_details`,
  `creator_shipping_addresses`.
- Optional bridge: `collaborations.uce_pipeline_collaboration_id` →
  `uce_campaign_collaborations`.

## API surface

- Base path: `api/v1/collaboration`
- Brand + creator JWT roles share endpoints; access is scoped by `UserRole`.
- UCE applicant approval auto-provisions a collaboration thread via
  `CollaborationProvisionService`.

## Migration (no shadow DB)

```bash
npm run prisma:generate
npm run db:migrate:deploy
```

Use `db:migrate:deploy` instead of `db:migrate:dev` when shadow replay fails.

## Intentional overlap with UCE pipeline

- `uce_campaign_collaborations` remains the campaign CRM (prospects / applicants /
  reporting pipeline).
- `collaborations` is the chat-first unified engine for brand + creator after
  approval.
