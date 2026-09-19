# Permissions — request only these five

All granted via **Facebook Login for Business**.  
Do not add `instagram_creator_marketplace` as a substitute for `_discovery`.  
Do not add `instagram_creator_marketplace_messaging` or `ads_management`.  
Do not add `facebook_creator_marketplace_discovery` (that is the **Facebook** Creator Discovery API — see [instagram-vs-facebook.md](./instagram-vs-facebook.md)).

```text
instagram_creator_marketplace_discovery
instagram_basic
pages_show_list
pages_manage_metadata
business_management
```

Each permission needs its **own** allowed-usage text and screencast. Missing a recording = that permission denied (others may still pass).  
Media checklist: [screencast-and-media.md](./screencast-and-media.md).

Official lists:

- ICM required permissions: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace
- Allowed usage / screencast requirements: https://developers.facebook.com/docs/permissions/

---

### `instagram_creator_marketplace_discovery`

**Allowed usage:** Instagram businesses onboarded to Creator Marketplace retrieve insights for eligible creators (bio, follower count, account reach) and search/discover those creators.

**Dependencies:** `business_management`, `instagram_basic`, `pages_manage_metadata`, `pages_show_list`

**Screencast must show:** complete Facebook Login; grant this permission; **search creators in our app**; show bio, followers, reach.

**Form note:** This is the permission Meta’s ICM error 10 names. Login config and dialog must include it. Copy should say we search Marketplace creators for brand partnership discovery — not ads account management.

---

### `instagram_basic`

**Allowed usage:** Basic metadata of an Instagram Business profile (username, ID).

**Screencast must show:** Facebook Login; user selects their Instagram (via Page); our app displays the connected professional identity.

**Form note:** Brand IG identity so we can call ICM as that brand. Not creator-side Instagram Login.

---

### `pages_show_list`

**Allowed usage:** List Pages the user can perform tasks on, so they can pick the brand Page.

**Screencast must show:** after Login, the Page picker (or a single Page clearly selected).

**Form note:** Required to obtain the Page token ICM needs.

---

### `pages_manage_metadata`

**Allowed usage:** Page metadata / Instagram link Meta requires as an ICM dependency.

**Screencast must show:** successful Page + linked IG connect (the same connect flow, called out).

**Form note:** Requested as **dependency of discovery**, not to edit Page about-text as a product feature.

---

### `business_management`

**Allowed usage:** Business asset access required by ICM.

**Screencast must show:** Login granting this permission as part of the same connect (do not invent a Business Manager admin UI).

**Form note:** Requested **only as a dependency of** `instagram_creator_marketplace_discovery`.

---

## Out of this submission

| Permission | Why not |
| --- | --- |
| `instagram_creator_marketplace` | Not the Graph permission ICM documents |
| `instagram_creator_marketplace_messaging` | Partnership DMs — different review |
| `facebook_creator_marketplace_discovery` | Facebook Creator Discovery API — separate track |
| `ads_management` | `creator_marketplace_brand_info` / custom audiences — later |
| `pages_read_engagement` | Not required for creator cards |
| `instagram_manage_insights` | FB-Login insights path — not this review |
| `instagram_business_*` | Instagram Login family — different review |
