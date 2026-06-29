# Settings module — integration gaps

Living tracker for **known gaps between product docs, backend APIs, and frontend UI**.  
Product copy and layout specs remain in `product-docs/`; this file tracks what is **not yet fully wired**.

Last updated: 2026-06-28

---

## Brand settings

| Area | Gap | Notes |
|------|-----|--------|
| **General → Organization** | Corporate address & tax ID not persisted | Zod accepts `organizationAddress` / `taxId` on PATCH; service only saves legal name, country, currency. UI shows `—` when null. |
| **General → Profile** | Avatar upload | UI placeholder only; no auth/upload API. |
| **General → Security** | Password change | UI placeholder only; belongs in auth module. |
| **General → Team** | Role dropdown (inline PATCH) | `PATCH team/role` exists; UI still shows role badges only. |
| **General → Team** | Resend invitation | No backend endpoint. |
| **Integrations** | Entire tab | Meta OAuth, permissions, conflict resolution — no DB/API in postgres product doc. UI remains mock. |
| **Finance → Billing** | Billing profile vs Razorpay billing identity | Subscription/invoices use pricing module; corporate GST/PAN uses `brand_billing_profiles` (settings API). |
| **Finance → Escrow** | Duplicated surfaces | Escrow init/top-up in Settings; full ledger in sidebar **Payouts** hub (`/brand/payouts`). |
| **Finance → Withdrawal** | Single active account | POST creates new row; no “replace” semantics documented in UI beyond another POST. |

---

## Creator settings

| Area | Gap | Notes |
|------|-----|--------|
| **Profile → Avatar** | Upload | UI placeholder only. |
| **Profile → Security** | Password change | UI placeholder only. |
| **Profile → Team** | Role dropdown (inline PATCH) | `PATCH team/role` exists; UI shows badges only. |
| **Profile → Team** | Resend invitation | No backend endpoint. |
| **Social → Connect** | OAuth link flows | Only `GET social` + `DELETE social/:platform`; connect CTAs disabled until OAuth routes exist. |
| **Social → Roadmap** | Gmail / Google workspace | Product placeholder; no API. |
| **Payouts & Tax → Telemetry** | Summary balances | Settings API returns bank + settlement only; earnings metrics loaded from **Payouts hub** (`GET /api/v1/creator/payouts`) or show `—`. |
| **Payouts & Tax → Clearing** | Request immediate clearing | Modal UI only; execution belongs on Payouts hub, not settings PATCH. |
| **Payouts & Tax → Invoice vault** | PDF downloads | Link placeholder; exports live on `/creator/payouts` hub. |
| **Payouts & Tax → Bank name** | Hardcoded on save | Settings `POST payouts/bank` stores bank name as `"Primary settlement bank"`. |
| **Payouts & Tax → Duplicate bank APIs** | Two write paths | Settings `POST payouts/bank` vs collaboration `POST creator/bank-details` vs hub drawer — consolidate later. |
| **Payouts & Tax → Roadmap** | Premium tier card | Product placeholder; no API. |

---

## Cross-cutting

| Gap | Notes |
|-----|--------|
| **Empty state display** | Frontend convention: missing scalar values render as em dash (`—`), not hidden rows. |
| **Role masking** | Financial/payout fields masked server-side for Campaign Manager (brand) and Assistant (creator). |
| **Sidebar vs Settings payouts** | Operational hub (`/brand/payouts`, `/creator/payouts`) vs configuration tabs — intentional split; see product docs. |

---

## Resolved (brand frontend integration)

- General profile + org (partial) + team invite/revoke/cancel → `api/v1/brand/settings`
- Finance billing profile, withdrawal account, notifications matrix → settings API
- Pricing subscription panel + escrow card remain on existing modules

## Resolved (creator frontend integration)

- Profile + shipping + workspace + team → `api/v1/creator/settings`
- Social list + disconnect → settings social API (connect OAuth still gap)
- Payouts tab bank/tax → settings payouts API; earnings summary from payouts hub API
- Roadmap cards (Gmail, premium tier) remain static placeholders
