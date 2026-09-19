# Graph API Explorer runbook

Commands to re-check Pages / IG / Creator Marketplace until discovery returns
non-empty `data` (or a clear eligibility error).

**Never paste access tokens into git, chat, or this file.**

App: **The Creator Shop** (`1180027506417007`)  
Explorer: https://developers.facebook.com/tools/explorer/

---

## Setup every session

1. Meta App = **The Creator Shop**
2. Token type = **User Token** first
3. Permissions (ICM path):

```text
pages_show_list
pages_manage_metadata
instagram_basic
business_management
instagram_creator_marketplace_discovery
```
4. **Generate Access Token** → in the Facebook dialog, **tick every Page** you need  
5. Optional later: switch dropdown to **Page Token** for a specific Page

If `/me/accounts` is `[]` but you manage Pages in facebook.com → regenerate and tick Pages again.

---

## Snapshot — `/me/accounts` (2026-09-18 evening)

Query used (approximate):

```http
GET /me/accounts
```

| Page | Page id | `MANAGE` task? | Notes |
| --- | --- | --- | --- |
| TCS ICM Test | `1299588229909620` | **Yes** | Full task set including MANAGE |
| Test Page 1303 | `1025683673961319` | **Yes** | Has MANAGE |
| Growth Verse | `100359082868972` | **Yes** | Has MANAGE — preferred brand once IG linked |
| Pura Milk | `105354015602476` | **No** | Tasks lack `MANAGE` → explains Suite error “need full control of the Page” to connect IG |

This run did **not** include `instagram_business_account` in fields. Re-run with fields below to see IG link state.

**Pura Milk fix (ops, not Explorer):** Business Suite → Pages → Pura Milk → People → give yourself **Full control** / Admin so `tasks` includes `MANAGE`. Then retry IG connect.

---

## Command sequence (copy/paste)

### 1. Who am I?

```http
GET /me?fields=id,name
```

### 2. Pages I can use (+ IG + tasks)

```http
GET /me/accounts?fields=id,name,category,tasks,instagram_business_account&limit=50
```

**Want for a candidate brand Page:**

- `tasks` includes **`MANAGE`**
- `instagram_business_account.id` present  

| Outcome | Next |
| --- | --- |
| No `MANAGE` | Fix Page full control in Suite (see Pura Milk above) |
| No `instagram_business_account` | Link Professional IG to that Page, then re-run |
| Both present | Go to step 3–5 |

### 3. Confirm Page + IG (optional)

Replace `{page-id}`:

```http
GET /{page-id}?fields=id,name,tasks,instagram_business_account
```

### 4. Switch to Page token

In Explorer: **User or Page** → select that Page  
(or use Page `access_token` from step 2 — do not save it here)

### 5. Creator Marketplace discovery

Replace `{ig-user-id}` with `instagram_business_account.id`:

```http
GET /{ig-user-id}/creator_marketplace_creators?recommendation_type=most_relevant_for_me&fields=id,username,biography,country,profile_picture_url&limit=5
```

Also try:

```http
GET /{ig-user-id}/creator_marketplace_creators?query=fashion&fields=id,username&limit=5
```

```http
GET /{ig-user-id}/creator_marketplace_creators?creator_countries=["IN"]&fields=id,username&limit=5
```

```http
GET /{ig-user-id}/creator_marketplace_creators?username=instagram&fields=id,username,biography&limit=1
```

### 6. Optional brand info (not required for ICM discovery App Review)

```http
GET /17841400493945501/creator_marketplace_brand_info
```

**Result 2026-09-18 (Page token):**

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

This endpoint also needs **`ads_management`** (+ ad account access). We are **not**
submitting `ads_management` on this pass (custom-audience discovery deferred).
Treat this error as **expected / out of scope** — it does **not** invalidate the
empty-but-successful `creator_marketplace_creators` plumbing result.
---

## How to read results

| Response | Meaning | What to do |
| --- | --- | --- |
| `/me/accounts` → `data: []` | No Page grant on token | Regenerate token; tick Pages |
| Page without `MANAGE` | Not full Page control | Suite → Page people → Full control |
| Page without `instagram_business_account` | IG not linked | Link Professional IG to Page |
| creators → permission / missing permission error | Bad token type or scopes | Page token + ICM permission; app role |
| creators → brand eligibility error (#10) | Brand not eligible / ToS | Suite Creator marketing → Get started / Agree; BV if prompted |
| creators → `data: []` + paging (`MAZDZD`), no error | **Confirmed** TCS IG | Auth OK; inventory blocked on BV/ToS |
| `creator_marketplace_brand_info` → code 100 / subcode 33 Authorization Error | **Confirmed** same IG | Needs `ads_management` + ads path — **out of scope** this pass |
| creators → `data: [ {...} ]` | Success | Update [current-test-assets.md](./current-test-assets.md) |

---

## Confirmed empty discovery (2026-09-18)

Page token against TCS IG `17841400493945501` — all variants below returned:

```json
{ "data": [], "paging": { "cursors": { "before": "MAZDZD", "after": "MAZDZD" } } }
```

Variants: `most_relevant_for_me`, `query=fashion`, `creator_countries=["IN"]`, `["US"]`, `username=instagram`.

Treat as **plumbing pass / inventory fail**. Do not keep changing scopes expecting rows. After portfolio BV + Creator marketing Get started/Agree (prefer Growth Verse once IG linked), re-run section 5.

---

## Known ids (safe to keep)

| Name | Page id | IG business id (when linked) |
| --- | --- | --- |
| TCS ICM Test | `1299588229909620` | Was `17841400493945501` when linked; re-check after unlink/relink |
| Test Page 1303 | `1025683673961319` | — |
| Growth Verse | `100359082868972` | — until IG linked |
| Pura Milk | `105354015602476` | — until MANAGE + IG linked |

Brian FB user id (earlier): `2821142811426313`

---

## Done criteria for “Explorer ready”

- [ ] Candidate Page has `MANAGE`  
- [ ] Same Page has `instagram_business_account`  
- [ ] Page-token call to `creator_marketplace_creators` returns **non-empty** `data` **or** Suite Discover shows creators (then API may still be mock/empty under Standard Access — note which)  

Until then, re-run this file top-to-bottom when testing.
