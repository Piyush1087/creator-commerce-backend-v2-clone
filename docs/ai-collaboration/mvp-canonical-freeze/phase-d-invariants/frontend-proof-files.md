# Frontend proof files for the §11 suite

Freeze-branch FE files. Execution: `../18-validation/11-invariant-results.md`.

| ID | Frontend proof |
| --- | --- |
| INV-01 | `src/shared/auth/*`, `src/features/auth/*`, `src/shared/auth/require-auth.tsx`, `src/features/auth/auth-security-static.test.ts` |
| INV-02 | C-01 session/org via `src/features/creator-onboarding/*` (ownership is BE Prisma; FE consumes role) |
| INV-03 | `src/features/creator-onboarding/components/creator-platform-route-guard.tsx` (+ `.test.ts`) |
| INV-04 | `src/features/settings/components/creator-settings-action-guard.tsx`, `src/layouts/app-shell/creator-shell-capabilities.ts` |
| INV-05 | `src/layouts/app-shell/sidebar-items.ts`, `bottom-nav-items.ts`, `src/routes/app-routes.tsx`, `c05-frontend-convergence.architecture.test.ts` |
| INV-06 | `src/pages/creator/campaigns/c03-pages.tsx`, `src/features/creator-campaigns/*` |
| INV-07 | `src/features/collaboration/components/CollaborationRouteGuard.tsx`, `src/pages/brand/collaborations/*`, `src/pages/creator/collaborations/creator-collaborations-page.tsx` |
| INV-08 | Brand Settings billing/escrow pages; not Brand Payouts hub |
| INV-09 | `src/features/settings/components/creator/creator-profile-contact-settings.tsx`, `src/features/settings/contracts/creator-settings.contracts.ts` |
| INV-10 | No FE provider success simulation in auth/OTP clients |
| INV-11 | Feature `src/features/*/api/` clients; `src/features/chat/chat-architecture.test.ts`; `src/features/brand-dashboard/brand-home-architecture.test.ts` |
| INV-12 | `require-auth.tsx`, `getHomeRouteForRole` in `src/features/auth/constants.ts` |
| INV-13 | n/a (schema) |

C-02A Home is not a proof target. `/creator/home` is `src/pages/creator/home/creator-workspace-entry-page.tsx` (C-05 entry).
