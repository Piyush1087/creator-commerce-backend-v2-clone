# Settings module — UI testing guide

Manual verification checklist for **brand** and **creator** settings after API integration.  
Run frontend (`creator-commerce-frontend-v2`) against backend (`creator-commerce-backend-v2`) with a valid JWT in local storage.

Product specs: `product-docs/brand-settings/` and `product-docs/creator-settings/`  
Known gaps: [`INTEGRATION-GAPS.md`](./INTEGRATION-GAPS.md)

---

## Prerequisites

1. Backend running with migrations applied (`npm run db:migrate:deploy` in backend-v2).
2. Frontend dev server: `npm run dev` in `creator-commerce-frontend-v2`.
3. Log in as **brand** or **creator** so `ccs.auth.v1` exists in localStorage.
4. Optional: `SETTINGS_FIELD_ENCRYPTION_KEY` set in backend `.env` for brand withdrawal account encryption.

---

## Brand settings

Base URL: `http://localhost:5173`

| Route | Tab |
|-------|-----|
| `/brand/settings/general` | General |
| `/brand/settings/integrations` | Integrations (mock) |
| `/brand/settings/billing` | Finance → Billing overview |
| `/brand/settings/escrow` | Finance → Secure escrow |

### General tab

| # | Test | Expected |
|---|------|----------|
| B-G1 | Load page | Personal profile, org, brand identity, team render; empty fields show `—`. |
| B-G2 | Edit first/last name + company name, save | Unsaved bar appears; PATCH succeeds; bar clears after save. |
| B-G3 | Refresh after save | Values persist. |
| B-G4 | Email field | Read-only; shows account email. |
| B-G5 | Brand identity | Display name + website read-only/locked. |
| B-G6 | Invite member (admin role) | Drawer → valid email → invite; pending row in team table. |
| B-G7 | Cancel pending invite | Pending row removed. |
| B-G8 | Revoke active member (not self) | Confirm checkbox → member removed. |
| B-G9 | Campaign Manager login | Org fields disabled; invite disabled or read-only messaging. |

### Finance tab (billing)

| # | Test | Expected |
|---|------|----------|
| B-F1 | Subscription / plan section | Pricing panel loads (trial, plan, or empty). |
| B-F2 | Invoice history | Table or empty row with `—` / no invoices copy. |
| B-F3 | Add billing profile | Drawer → company + address (+ optional GSTIN/PAN) → save → summary shows values. |
| B-F4 | Link withdrawal account | Drawer → bank details + confirm checkbox → save → masked account + IFSC. |
| B-F5 | Notifications matrix | Toggle in-app/email/slack; slack requires URL when enabled; save persists. |
| B-F6 | Escrow card | Existing escrow init/top-up flow still works below finance sections. |
| B-F7 | Campaign Manager | Billing profile / withdrawal read-only; notification save disabled. |

### Integrations tab (mock)

| # | Test | Expected |
|---|------|----------|
| B-I1 | Load page | Meta card, drawers, modals work with local state only (no network for integrations). |

### Sidebar cross-check

| # | Test | Expected |
|---|------|----------|
| B-X1 | `/brand/payouts` | Operational ledger hub still loads independently of Settings. |

---

## Creator settings

| Route | Tab |
|-------|-----|
| `/creator/settings/profile` | General (profile, shipping, team) |
| `/creator/settings/social` | Social channels |
| `/creator/settings/payouts` | Payouts & Tax |

### Profile tab

| # | Test | Expected |
|---|------|----------|
| C-P1 | Load page | Profile, shipping, workspace name, team; empty fields show `—`. |
| C-P2 | Edit name + workspace name, save | PATCH profile + workspace; shipping PUT if changed. |
| C-P3 | Shipping address | Save full address; reload persists. |
| C-P4 | Invite / revoke / cancel invite | Same patterns as brand team (admin roles). |
| C-P5 | Assistant role | Profile/shipping edits disabled. |

### Social tab

| # | Test | Expected |
|---|------|----------|
| C-S1 | Load page | Instagram, TikTok, YouTube cards always visible. |
| C-S2 | Connected channel (if DB row exists) | Handle, token state, last sync; `—` for missing metadata. |
| C-S3 | Disconnect | Confirm modal → DELETE → channel shows not connected. |
| C-S4 | Connect button | Disabled or noop until OAuth (documented gap). |

### Payouts & Tax tab

| # | Test | Expected |
|---|------|----------|
| C-T1 | Earnings summary | Values from payouts hub or `—` if hub empty/unavailable. |
| C-T2 | Bank node | Shows settings API bank or `—`; replace drawer saves via `POST payouts/bank`. |
| C-T3 | PAN / tax row | Settlement profile or `—`; verification badge from API. |
| C-T4 | Request clearing | Modal only (no API); link mentally to `/creator/payouts` for real ops. |
| C-T5 | Assistant role | Bank drawer disabled / read-only. |

### Sidebar cross-check

| # | Test | Expected |
|---|------|----------|
| C-X1 | `/creator/payouts` | Earnings hub loads; bank drawer there uses collaboration API (known duplicate). |

---

## Regression smoke

| # | Test | Expected |
|---|------|----------|
| R-1 | `npm run build` (frontend-v2) | Passes. |
| R-2 | Brand + creator sidebar Settings nav | Routes resolve, shell tabs highlight correctly. |
| R-3 | Mobile width ≤768px | Settings stacks; team table readable (cards if implemented). |

---

## Reporting issues

When filing a bug, include:

- Role (brand owner / campaign manager / creator owner / assistant)
- Route + action
- API response status/body (Network tab)
- Whether value should be `—` vs a real field per `INTEGRATION-GAPS.md`
