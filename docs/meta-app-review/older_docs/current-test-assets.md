# Current Meta test assets (Brian)

Snapshot from Graph API Explorer on **2026-09-18**.  
No access tokens stored here.

Facebook user:

```text
id: 2821142811426313
name: Brian D'Silva
```

App under test: **The Creator Shop** (`1180027506417007`).

---

## `/me/accounts` (User token with Page grants)

| Page name | Page id | `instagram_business_account` |
| --- | --- | --- |
| **TCS ICM Test** | `1299588229909620` | **Yes** → `17841400493945501` |
| Test Page 1303 | `1025683673961319` | No |
| Growth Verse | `100359082868972` | No |
| Pura Milk | `105354015602476` | No |

Only **TCS ICM Test** can call Creator Marketplace APIs today.

---

## Token scopes (Explorer — ICM)

```text
pages_show_list
pages_manage_metadata
instagram_basic
business_management
instagram_creator_marketplace_discovery
```

See [permissions.md](./permissions.md). Insights / `pages_read_engagement` not in this review track.

---

## ICM API checks (Page token)

Endpoint pattern:

```http
GET /{ig-user-id}/creator_marketplace_creators?...
```

**IG id used (TCS when linked):** `17841400493945501`

**Commands run (2026-09-18):** all of the following returned the same shape — **success, empty inventory**:

- `recommendation_type=most_relevant_for_me` + fields id,username,biography,country,profile_picture_url  
- `query=fashion`  
- `creator_countries=["IN"]`  
- `creator_countries=["US"]`  
- `username=instagram`  
- richer fields as attempted  

**`GET /17841400493945501/creator_marketplace_brand_info` (separate endpoint):**

```json
{
  "error": {
    "message": "Authorization Error",
    "code": 100,
    "type": "GraphMethodException",
    "error_subcode": 33,
    "fbtrace_id": "AY2qTknDI30G43XJDJgeJj_"
  }
}
```

Needs `ads_management` / ad account — **deferred**; not part of core ICM discovery submit.

**Exact response for `creator_marketplace_creators` (every discovery variant):**

```json
{
  "data": [],
  "paging": {
    "cursors": {
      "before": "MAZDZD",
      "after": "MAZDZD"
    }
  }
}
```

**Interpretation (locked):**

- Not a missing-permission failure (no error object / no #10).  
- Page token + ICM scope path works.  
- Brand has **no creator inventory** yet (BV / Creator marketing ToS / eligibility / Standard Access empty mock).  
- Next unlock for **creators** rows is **ops** (portfolio BV + Suite Creator marketing onboard), not more Explorer scope tweaks.  
- `brand_info` auth error is unrelated — ignore until Product wants custom-audience discovery (`ads_management`).

See [explorer-runbook.md](./explorer-runbook.md) to re-run after BV/ToS.

---

## Business Suite observations

- TCS ICM Test shows in Meta Business Suite (Facebook + Instagram linked).
- **Creator marketing / Creator marketplace** not available in left nav / All tools for this asset.
- Suite prompts **Business portfolio verification**.
- Brian **cannot complete BV right now** — parked as a hard requirement before non-empty discovery / Suite Marketplace UI.

---

## Eligibility clarification (documented)

| Myth | Fact |
| --- | --- |
| Brand IG needs **1,000 followers** to call discovery | **False.** 1,000 followers is for **creators** joining Marketplace as talent. |
| Brand needs **verified business portfolio** + eligible Page/IG assets | **True** for business/brand access to Creator Marketplace. |

See [business-verification.md](./business-verification.md) and [brand-meta-setup.md](./brand-meta-setup.md).

---

## Snapshot update (2026-09-18 evening)

`/me/accounts` (tasks visible; IG field not requested this run):

| Page | Page id | `MANAGE`? |
| --- | --- | --- |
| TCS ICM Test | `1299588229909620` | Yes |
| Test Page 1303 | `1025683673961319` | Yes |
| Growth Verse | `100359082868972` | Yes |
| Pura Milk | `105354015602476` | **No** — blocks IG connect (“need full control of the Page”) |

Re-check IG with fields in [explorer-runbook.md](./explorer-runbook.md).

---

## Ready vs blocked

| Item | Status |
| --- | --- |
| FB user + Explorer access | Ready |
| Page `TCS ICM Test` + Professional IG link | Ready (plumbing) |
| Page token + ICM scopes | Ready |
| ICM endpoint callable | Ready |
| Non-empty creator `data` | **Blocked** — BV / brand Marketplace onboarding |
| Creator marketing in Suite | **Blocked** — same |
| **Growth Verse** (preferred next brand) | **No IG linked yet** — link IG + BV when ready |
| Pura Milk / Test Page 1303 | No IG — not in plan as primary |

Preferred path when ops resume: Growth Verse + portfolio BV (see [FULL-PLAN.md](./FULL-PLAN.md)). TCS remains the only callable IG until then.
