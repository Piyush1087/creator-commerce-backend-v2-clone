# Backend proof files for the §11 suite

| ID | Backend proof |
| --- | --- |
| INV-01 | `src/features/auth/*`, `auth-security.static.test.ts`, `auth-security.unit.test.ts`, `auth-security.postgres.test.ts` |
| INV-02 | Prisma `User` `Organization`; `src/features/c01-persistence/c01-persistence-security.postgres.test.ts` |
| INV-03 | `src/features/creator-entry/*`, `creator-entry.postgres.test.ts` (29/29 harness ctor aligned RUN 7) |
| INV-04 | `src/features/creator-settings/team/creator-workspace-actor.*`, `creator-team.postgres.test.ts` |
| INV-05 | n/a (FE chrome). Marketplace HTTP still live: `public-marketplace.controller.ts` (OUT, classified Phase C) |
| INV-06 | `src/features/campaign-applications/*`, `src/features/brand-uce/persistence/c03-p11*.postgres.test.ts` |
| INV-07 | `src/features/campaign-applications/application-handoff.postgres.test.ts`, collaboration handoff services |
| INV-08 | `src/features/brand-escrow/*`, collaboration settlement models — not Brand Payouts v1, not C-06 |
| INV-09 | C-05 profile/contact controllers. Collaboration `collaboration-creator-profile.service.ts` writes its own shipping evidence (not C-05 `CreatorShippingAddress` consumption) |
| INV-10 | Instagram/Razorpay/Postmark clients; `mail.service.test.ts`; notification provider tests |
| INV-11 | Controllers/services own mutations; Brand Home `brand-home.postgres.test.ts` |
| INV-12 | `brand-workspace-authorization.postgres.test.ts`, C-05 team postgres |
| INV-13 | Prisma duplicates classified in `../14-migration-schema/` |

OUT modules still imported in `src/app.module.ts` are not invariant targets except “must not be required for MVP journeys”.
