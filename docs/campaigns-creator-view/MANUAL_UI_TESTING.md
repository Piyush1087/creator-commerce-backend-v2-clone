# Creator Campaigns — Manual UI Testing

UI-only verification checklist for the public guest marketplace, authenticated creator marketplace, campaign detail, invite deep-links, application wizard, command center, and history flows.

**Prerequisites**

- Backend running locally with migrations applied (`npm run db:migrate:deploy`).
- Dev creator seeded: `npm run db:seed:dev-creator` (sets Instagram handle + mock audience metrics).
- Frontend running with `VITE_API_URL` pointing at the backend.
- Log in as creator: `test@creator.com` / OTP `123456`.

**Display rule under test:** Any field with no DB value should render as `-` in the UI (not hidden).

---

## 1. App shell & navigation

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Log in as creator | Lands on creator dashboard (or return URL if signing in from invite) |
| 1.2 | Check top spacing below header on Marketplace, Campaign detail, Command Center, History | Content has visible padding (not flush against header) |
| 1.3 | Desktop sidebar | Links: Home, Marketplace, Campaigns, Chat |
| 1.4 | Mobile viewport (<768px) | Bottom nav shows Home, Marketplace, Campaigns, Chat; content clears bottom nav |
| 1.5 | Breadcrumbs on campaign detail | Marketplace / {campaign name} |

---

## 2. Creator dashboard (`/creator/dashboard`)

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Open dashboard | No static mock campaign list |
| 2.2 | Click **Open Marketplace** | Navigates to `/creator/marketplace` |
| 2.3 | Click **Campaign Command Center** | Navigates to `/creator/campaigns` |
| 2.4 | Click **Collaboration Chat** | Navigates to `/creator/collaborations` |

---

## 3. Public guest marketplace (`/marketplace`) — no login

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Open `http://localhost:5173/marketplace` in incognito / logged out | Guest shell header (logo + Sign in); no app sidebar |
| 3.2 | Load page | Campaign cards from `GET /api/v1/public/marketplace/campaigns` |
| 3.3 | Card badge | **Public brief** on cards |
| 3.4 | Compensation on card | Shows "Sign in to view" |
| 3.5 | Match eligibility toggle | Hidden/disabled with "Match filters available after sign-in" |
| 3.6 | Search + niche + deliverable filters | Refetch public list via API |
| 3.7 | **More filters** drawer | Geography + production timeline (no creator tier for guests) |
| 3.8 | Click campaign card | Opens `/marketplace/:campaignId` teaser detail |
| 3.9 | Guest banner on list + detail | Copy explains masked compensation/brief |
| 3.10 | Click **Sign in** from guest shell | Login page; after OTP returns to same marketplace URL (creator → authed marketplace) |

---

## 4. Authenticated marketplace (`/creator/marketplace`)

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Load page | Campaign cards from API (not mock); loading state then grid |
| 4.2 | Missing hero image on a campaign | Placeholder tile shows `-` |
| 4.3 | Missing compensation / objective / industry | Card shows `-` for that line |
| 4.4 | Toggle **Show Match Eligibility Only** | List refetches; only eligible campaigns when connected |
| 4.5 | Search by brand or campaign name | List filters via API `search_query` |
| 4.6 | Inline niche + deliverable filters | API refetch with `niche` / `deliverable_type` |
| 4.7 | **More filters** drawer | Tier, geography, timeline → API |
| 4.8 | **Reset Filters** | Clears search, eligibility toggle, and drawer filters |
| 4.9 | Match score badge | Shown when social connected; application-scope badge when teaser |
| 4.10 | Click a campaign card | Opens `/creator/marketplace/:campaignId` |
| 4.11 | Mobile | Single-column cards; filter strip stacks vertically |

---

## 5. Campaign detail (`/creator/marketplace/:id` or `/marketplace/:id`)

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Open active campaign (auth) | Detail from `GET /api/v1/creator/marketplace/campaigns/:id` |
| 5.2 | Open same campaign as guest | Detail from public endpoint; financials masked |
| 5.3 | Teaser tier (no Instagram on profile) | Brief gated/blurred; CTA mentions connecting social |
| 5.4 | Unlocked tier (seeded creator, eligible) | Brief accordion expandable; apply CTA enabled |
| 5.5 | Locked tier (campaign targeting mismatch) | Mismatch alert; apply disabled; cross-sell tray loads |
| 5.6 | Cross-sell tray (locked) | Up to 3 alternative campaigns; links to detail |
| 5.7 | Missing brand logo, product image, tagline, execution window | Each shows `-` |
| 5.8 | **Share campaign link** | Copies URL to clipboard; toast/message confirms |
| 5.9 | **Submit Application** (unlocked) | Opens 3-step wizard |

---

## 6. Invite deep-link & token acceptance

**Setup:** From brand UCE pipeline, invite a prospect (sets `invitation_token` on collaboration row).

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Open `/marketplace/:campaignId?invite_token=<token>` logged out | Invite banner; teaser with masked brief |
| 6.2 | Click primary CTA as guest | Login; after OTP lands on `/creator/marketplace/:id?invite_token=...` |
| 6.3 | Logged-in invited creator on detail | `ui_access_state` = **invite**; CTA **Claim Exclusive Invitation** |
| 6.4 | Claim + apply | `POST /api/v1/creator/marketplace/invitations/claim` then wizard |
| 6.5 | Open `/marketplace/invite/<token>` | Resolves token → redirects to campaign detail with query param |
| 6.6 | Invalid / expired token | Error state or not-found message |
| 6.7 | Command center → Pending → invitation row CTA | Opens detail with `?invite_token=` when token exists |
| 6.8 | Share link (auth, invited row) | Copied URL includes `invite_token` when collaboration has token |

---

## 7. Application wizard

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Step 1 — products | Lists API products; OOS disabled; missing name shows `-` |
| 7.2 | Step 2 — creative tracks | Lists campaign briefs from API |
| 7.3 | Step 3 — terms | Checkbox required |
| 7.4 | Submit | `POST /api/v1/creator-uce/campaigns/:id/apply`; wizard closes; CTA shows already applied |
| 7.5 | Mobile | Wizard modal scrollable; footer buttons usable |

---

## 8. Command center (`/creator/campaigns`)

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Load page | Data from `GET /api/v1/creator/campaigns/workspace` |
| 8.2 | Tab counts | Active / Pending counts match API |
| 8.3 | Velocity alerts | Shown when pipeline health is overdue/approaching; empty state if none |
| 8.4 | Active production table | Rows with brand, campaign, milestone; missing avatar → `-` |
| 8.5 | **Open Collaboration** on active row | Links to `/creator/collaborations` (with `?collaboration=` when workflow exists) |
| 8.6 | Pending tab | Invitations vs applications styling; invitation CTA includes invite token |
| 8.7 | **View History (N)** | Navigates to history; N = `completed_count` |
| 8.8 | Mobile | Table hidden; stacked mobile rows with actions |

---

## 9. History (`/creator/campaigns/history`)

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Load page | `GET /api/v1/creator/campaigns/history` |
| 9.2 | Summary stats | Escrow total, deliverables count, avg match; `-` when no completed rows |
| 9.3 | Closed rows | Brand, campaign, outcome, payout, closed date |
| 9.4 | Missing payout | Shows `-` |
| 9.5 | **Back to Command Center** | Returns to `/creator/campaigns` |

---

## 10. End-to-end smoke (optional)

1. Guest `/marketplace` → open campaign → sign in → authed detail.
2. Brand invites prospect → creator opens invite URL → claim → apply.
3. Brand UCE pipeline → approve application.
4. Command center → pending clears or moves to active after brand actions.
5. Collaboration chat opens from active row when workflow collaboration exists.
6. Locked detail → cross-sell tray → open alternative campaign.

---

## 11. Error states

| Step | Action | Expected |
|------|--------|----------|
| 11.1 | Stop backend; reload marketplace | Error alert with message |
| 11.2 | Invalid campaign UUID in URL | Not found / error message |
| 11.3 | Apply twice to same campaign | Server error surfaced in wizard |

---

## 12. Public brand collaboration page

**Brand user (preview & share):** Sidebar → **Brand page** → `/brand/collaboration-page` — preview of the public page + copy link for creators.

**Creator entry:** Open shared link `/brand/<slug>` (e.g. `/brand/mamaearth-in`) — lands on brand page only; campaigns require sign-in.

| Step | Action | Expected |
|------|--------|----------|
| 12.1 | Log in as brand (e.g. Mamaearth) | Sidebar shows **Brand page** between Campaigns and Collaborations |
| 12.2 | Click **Brand page** | Preview banner with **Copy brand page link** |
| 12.3 | **Copy brand page link** | Copies public `/brand/<slug>` URL |
| 12.4 | Guest opens shared `/brand/<slug>` | Brand landing page only — no Share/Apply buttons |
| 12.5 | Guest **Sign in** or **Log in** | Both open login; `from` preserves `/brand/<slug>` |
| 12.6 | Guest **View open campaigns** | Opens login (not marketplace) |
| 12.7 | After creator login from brand link | Returns to `/brand/<slug>` (same brand context) |
| 12.8 | Logged-in creator **View open campaigns** | Navigates to `/creator/marketplace?brand_slug=<slug>` |
| 12.9 | Marketplace brand filter banner | Shows brand name + **Browse all brands** clears `brand_slug` |

---

## Notes

- **Not in scope for this checklist:** Real Instagram OAuth / Graph API live metrics.
- Brand hero inventory edit is tested under brand UCE flows (separate doc).
- Filter drawer Step 1/2 split from Stitch spec is simplified into a single drawer panel.
