# Creator Campaigns — Implementation vs Product Docs

Comparison of current v2 implementation against `product-docs/` (PRD, Develop Doc, Command Center pack). Product docs are aspirational in places; implementation maps to existing UCE schema.

**Legend:** ✅ Done · 🟡 Partial · ❌ Not started

---

## Screen 1 — Marketplace discovery

| Product requirement | Status | Notes |
|---------------------|--------|-------|
| Authenticated marketplace feed | ✅ | `GET /api/v1/creator/marketplace/campaigns` |
| Public unauthenticated marketplace (State A guest) | ✅ | `GET /api/v1/public/marketplace/campaigns`, routes `/marketplace` |
| Visibility scopes (everyone / eligible / invited) | ✅ | Backend filters via `visibility_scopes` + invite row |
| Application scope metadata on cards | ✅ | Badge on card (Public brief / Open pool / etc.) |
| Tier 1 teaser (no social) vs Tier 2 full | ✅ | `access_tier`, match scores hidden when teaser |
| Match score / affinity | ✅ | Mock eligibility from profile fields + affinity service |
| Filter: search | ✅ | Wired to API |
| Filter: niche, deliverable (inline strip) | ✅ | Inline controls + drawer for tier / geography / timeline |
| Filter: creator tier, geography, timeline (drawer) | ✅ | `MarketplaceFilterDrawer` → API query params |
| Match-eligible-only toggle | ✅ | Auth only; disabled for guests with copy |
| Campaign card hero image | ✅ | First product image; `-` placeholder if missing |
| Compensation teaser on card | ✅ | Masked for guests ("Sign in to view") |
| Real Instagram OAuth connection | ❌ | Handle on profile; mock metrics in dev seed |
| Cross-sell recovery tray on list | ❌ | Spec is detail-only; locked detail has tray |

---

## Screen 2 — Campaign detail & apply

| Product requirement | Status | Notes |
|---------------------|--------|-------|
| Campaign detail payload | ✅ | Auth + public detail endpoints |
| Teaser / unlocked / locked / invite UI states | ✅ | `ui_access_state` |
| Gated brief for teaser & locked | ✅ | |
| Brief accordion when unlocked / invite | ✅ | |
| Product & compensation block | ✅ | Missing values show `-`; guest masks financials |
| 3-step application wizard | ✅ | Product → brief → terms |
| Submit application | ✅ | `POST /api/v1/creator-uce/campaigns/:id/apply` |
| Invite deep-link / token acceptance | ✅ | `?invite_token=`, `/marketplace/invite/:token`, claim API |
| Share campaign link | ✅ | Clipboard via share-link API (auth) or public URL (guest) |
| Share brand collaboration page | ✅ | `/brand/:slug` + **Share brand page** on campaign detail |
| Public brand collaboration landing page | ✅ | `GET /api/v1/public/brands/:slug`, Stitch sections |
| Connect social CTA | 🟡 | Copy present; no OAuth wiring |
| Cross-sell alternatives on locked detail | ✅ | `GET .../alternatives` + `CrossSellTray` |
| Already-applied state | ✅ | Blocks re-apply in UI |
| Post-login return to invite URL | ✅ | `resolvePostLoginPath` on login page |

---

## Screen 3 — Command center

| Product requirement | Status | Notes |
|---------------------|--------|-------|
| Active production workspace | ✅ | `GET /api/v1/creator/campaigns/workspace` |
| Pending applications / invitations | ✅ | Status mapping from UCE collab status |
| Pending invitation deep-link CTA | ✅ | `invitation_token` on row → detail with `?invite_token=` |
| Velocity / panic alerts | 🟡 | Overdue + approaching deadline only; not full panic panel spec |
| Milestone-aware CTAs | 🟡 | Mapper covers logistics, review, publishing; negotiation stages generic |
| Link to collaboration chat | 🟡 | When `workflow_collaboration_id` exists on row |
| Tab counts | ✅ | |
| Mobile table → card rows | ✅ | |

---

## Screen 4 — History archive

| Product requirement | Status | Notes |
|---------------------|--------|-------|
| Closed collaboration list | ✅ | `GET /api/v1/creator/campaigns/history` |
| Summary stats (escrow, deliverables, match) | 🟡 | Computed from pipeline rows; not full escrow ledger |
| Payout column | 🟡 | Uses `total_quote` on complete rows |
| Read-only | ✅ | |

---

## Schema & data model

| Product doc schema | Status | Notes |
|--------------------|--------|-------|
| Standalone product-doc tables | ❌ | Intentionally not used |
| UCE campaign / targeting / commercials | ✅ | Extended with `visibility_scopes`, `application_scope` |
| Creator profile audience matrix | ✅ | Mock in dev seed |
| `uce_campaign_collaborations` pipeline | ✅ | Workspace + history source; `invitation_token` on invite |
| `Collaboration` workflow chat link | 🟡 | Optional relation on active rows |
| Dedicated `MarketplaceCrossSell` model | ❌ | Alternatives computed from eligible marketplace rows |

---

## Brand-side (out of scope for creator UI)

| Item | Status |
|------|--------|
| Brand wizard visibility/application scope UI | ❌ |
| Brand pipeline approve → chat | ✅ (existing UCE brand flows) |
| Brand share router modal | 🟡 | Creator share wired; brand modal may remain placeholder |

---

## Frontend architecture

| Item | Status |
|------|--------|
| Aurora primitives | ✅ |
| Feature module `src/features/creator-campaigns` | ✅ |
| Public guest layout `/marketplace` | ✅ | `MarketplaceGuestLayout` |
| Public brand landing `/brand/:slug` | ✅ | Brand Centre DNA + offerings |
| Mock data removed | ✅ |
| `displayValue` / `-` for nulls | ✅ |
| Flush shell padding fix (`.cc-workspace`) | ✅ |
| Mobile responsive layouts | ✅ |

---

## Recommended next increments

1. Instagram OAuth + real Graph API metrics ingestion.
2. Full panic panel rules from Command Center DD.
3. Brand wizard for visibility / application scope configuration.
4. Dedicated cross-sell persistence model (if product requires curated trays).
5. Brand-side share router modal with invitation token generation UI.
