# LEGACY_DISPOSITION_REGISTER

Canonical copy. Original RUN 1 file at `../03-legacy-disposition.md` is a pointer.

| Area | Disposition | This checkpoint |
| --- | --- | --- |
| Aurora, app shell, auth, Prisma, health, SST | SHARED_INFRASTRUCTURE_RETAIN | keep |
| Accepted modules in register IN | CANONICAL_ACCEPTED | keep |
| Brand escrow + Settings billing | SHARED / Settings authority | keep; not Brand Payouts v1 |
| C-05 Settings payout destinations | CANONICAL_ACCEPTED | keep |
| Old `src/features/brand-payouts` hub | LEGACY_REPLACE (not accepted Brand Payouts v1) | hide nav; code left for later delete |
| Old `src/features/creator-payouts` hub | OUT (C-06) | hide nav; redirect to Settings payouts |
| Co-Pilot modules + Prisma tables | OUT_OF_MVP | hide; schema drop later |
| Creator Centre / Media Kit / Analytics | DEFERRED | hide routes |
| Marketplace browse / guest marketplace | OUT_OF_MVP | keep C-03 redirects only |
| `creator-marketplace` Apply helpers | CANONICAL_PENDING (C-03 mixed folder) | keep module wired |
| C-02A / C-04 / Brand Payouts v1 | CANONICAL_PENDING_CONVERGENCE | not pulled |
| Duplicate persistence (UCE collab vs Collaboration) | PREEXISTING_ACCEPTED_DEBT | later schema amendment; no drop this freeze |
| `/brand/intelligence/identity-test` | LEGACY_COMPATIBILITY_ONLY | inbound redirects to Home (RUN 9); page files kept |
| BE `CoPilotModule` / `CreatorCoPilotModule` | OUT_OF_MVP | still imported; not in nav |

Docs for OUT/DEFERRED modules are not deleted. Classification folders: `../deferred/` and `../out-of-mvp/`.
