# Brand escrow — gaps and missing setup

What is **done**, what is **partially done**, and what still needs work before the full product vision is live.

---

## Done (usable today)

| Area | Status |
| --- | --- |
| Database models + migration | Done |
| Initialize brand vault (Razorpay virtual account) | Done |
| View balances + VBA details | Done |
| Card top-up via Razorpay Orders + checkout | Done (needs env + webhooks) |
| Bank wire credit via webhook | Done on server (needs real/simulated transfer to test) |
| Transaction ledger API + UI | Done |
| Brand Settings → Escrow UI wired to APIs | Done |
| Mock / preview data removed from escrow UI | Done |
| Missing values show **—** in UI | Done |
| Pricing tier → escrow take rate + aggregate cap on lock/breakdown | Done (`EscrowSubscriptionContextService` + `PricingModule`) |
| Billing gate on escrow lock (ACTIVE / TRIALING only) | Done |

---

## Partially done — needs configuration or follow-up

### Razorpay webhooks in non-production

- **Gap:** Card and bank credits only finalize when webhooks reach the backend.
- **Action:** Configure webhook URL + secret on Razorpay; use ngrok for local dev.
- **Symptom if missing:** Payment succeeds in Razorpay popup but balance stays zero.

### Beneficiary name on bank transfer UI

- **Gap:** Vault API does not return beneficiary name; UI shows **—**.
- **Action:** Extend vault response from Razorpay virtual account receiver name (backend + contract).

### Card payment → balance timing

- **Gap:** UI refreshes immediately after checkout success; ledger may still show `PROCESSING_GATEWAY` until webhook runs.
- **Action:** Optional polling or “processing” ledger state in UI.

### Settings → Billing page

- **Gap:** Billing overview is wired to **pricing** APIs (separate from escrow vault). Escrow sub-tab remains the vault/top-up surface.
- **Deferred:** Tier-based concurrent campaign limits, per-lock single-ticket caps, custom tranche modes — see `docs/pricing/product-docs/Pricing-escrow-connection.md` and `docs/pricing/gaps-and-missing-setup.md`.

---

## Not in frontend yet (backend exists)

These are required for the **full collaboration payout loop** but are **not** exposed in brand Settings:

| Capability | Backend path | Missing UI |
| --- | --- | --- |
| Lock funds at collaboration Stage 2 | `POST /api/v1/escrow-engine/lock-collaboration-funds` | Collaboration flow when stage advances |
| 30% advance payout | `POST /api/v1/escrow-engine/disburse-tranche-payout` | Creator payout triggers in collaboration |
| 70% final payout | Same | Same |
| Stage transition guards | `POST /api/v1/escrow-interlock/transition-stage` | Collaboration stage UI |
| Cancellation refunds | `POST /api/v1/escrow-interlock/trigger-rule-refund` | Cancel collaboration UI |
| Idempotent lock (hardened) | `POST /api/v1/hardened-escrow/lock-funds` | Caller must send `x-idempotency-key` |
| Fee / TDS preview for quotes | `POST /api/v1/escrow/calculate-breakdown` | Collaboration commercial terms UI |

**Impact:** Brands can fund a vault and see money, but **locking and paying creators** still requires wiring the collaboration product screens to these APIs.

---

## Creator side

- **Creator settlement profile** model exists in schema.
- **Gap:** No creator-facing onboarding for RazorpayX linked account / KYC in v2 frontend.
- **Impact:** Disbursement APIs may fail or no-op until creators have settlement profiles.

---

## Infrastructure / production readiness

| Item | Notes |
| --- | --- |
| Live Razorpay keys | Switch `rzp_live_` keys + live webhook URL before production |
| Webhook raw body | If signature verification fails in prod, ensure raw body is preserved for webhook route |
| Monitoring | Alert on webhook failures and stuck `PROCESSING_GATEWAY` ledger rows |
| Reconciliation | Periodic job comparing Razorpay settlements vs ledger (not built) |

---

## Quick priority list

1. **Configure Razorpay test webhooks** — unblocks card top-up testing.
2. **Set `VITE_RAZORPAY_KEY_ID`** on frontend — unblocks checkout.
3. **Wire collaboration UI** to lock + tranche + interlock APIs — unblocks end-to-end campaigns.
4. **Creator settlement onboarding** — unblocks actual payouts to creators.
5. **Add beneficiary name to vault API** — removes **—** on bank transfer screens.

---

## Related docs

- Product requirements (read-only): `product-docs/`
- Engineering overview: `README.md`
- Plain-language behaviour: `expected-behaviour.md`
- How to test: `testing-guide.md`
