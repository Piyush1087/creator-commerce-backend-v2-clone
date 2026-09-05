# Chat Home V1 â€” Pre-Merge Closure (Piyush authority)

**Authority:** Piyush pre-merge closure mail (bounded integration-validation / release-hygiene).
**Date:** 2026-09-05
**Status:** Ready for `INTEGRATION_MERGE_AUTHORIZED` review
**Not done:** merge to `development`, SST deploy, production.

Vocabulary: `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

---

## 1. Deployment authority repositories and `origin/development` SHAs

| Repo | Remote (`origin`) | Branch tip (candidate) | `origin/development` (deployment authority baseline) |
|------|-------------------|------------------------|------------------------------------------------------|
| Backend | `https://github.com/growth-verse/creator-commerce-backend-v2.git` | see Final SHAs below | `2f03819a6ef974a26afd98064909de6f7b2a04a2` |
| Frontend | `https://github.com/growth-verse/creator-commerce-frontend-v2.git` | see Final SHAs below | `f4e6c49b61c49ecf784961c5d770f9fb050c288b` |

Clone mirror (review only): `piyush` â†’ `Piyush1087/*-clone`.

**Development moved since integration branch create?**
No. Merge-base equals `origin/development` on both repos (`ahead` only on integration; `behind` = 0).
No additional merge of `development` into integration was required.

---

## 2. Full-suite differential (baseline vs candidate)

Baseline = exact `origin/development` tips above (git worktrees).
Candidate = `integration/chat-home-v1` after Gemini fallback restore + candidate-only fixes.
Chat/Home DB flags **cleared** for full suites (postgres Chat suites skip by design).

### Backend

| | Baseline (`2f03819`) | Candidate |
|--|----------------------|-----------|
| Summary | 21 failed / 997 passed / 487 skipped | 10 failed / 1214 passed / 504 skipped |
| Test files | 24 failed / 142 passed / 38 skipped | 21 failed / 177 passed / 42 skipped |

**FAIL key differential (file/suite keys):**

| Bucket | Count |
|--------|-------|
| Present on **both** | 22 |
| **Baseline-only** | 4 |
| **Candidate-only** | **0** |

Logs: `docs/handoff-audit/.logs/premerge-be-baseline-full.log`, `premerge-be-candidate-full-rerun.log`.

### Frontend

| | Baseline (`f4e6c49`) | Candidate |
|--|----------------------|-----------|
| Summary | 8 failed / 521 passed | 3 failed / 817 passed |
| Test files | 4 failed / 62 passed | 2 failed / 101 passed |

| Bucket | Count |
|--------|-------|
| Present on **both** | 3 |
| **Baseline-only** | 2 |
| **Candidate-only** | **0** |

Logs: `premerge-fe-baseline-full.log`, `premerge-fe-candidate-full-rerun.log`.

### Candidate-only failures cleared (then re-proven)

| Item | Action |
|------|--------|
| BE `route-webhook.service.test` | **FIXED** â€” ConfigService mock ignores empty `.env` `RAZORPAY_ROUTE_WEBHOOK_SECRET=` |
| BE DE-W1.0F architecture imports assert | **FIXED** â€” allow Chat `NotificationsModule`/`forwardRef` while requiring DE + BrandCanonical imports |
| BE `notifications-module-wiring` | **FIXED** â€” asserts updated to merged development CreatorSettings/Instagram shapes |
| FE obsolete `social-sync-view.test.ts` | **FIXED** â€” removed; tested Settings APIs not used by development `SocialSyncView` |
| FE `google-id-token.test.ts` | **FIXED** â€” `vi.stubEnv` for unset client ID |

**Merge bar:** zero candidate-only failures â€” **PASS**.

---

## 3. Intelligence contracts verification â€” PASS

Official CLI (design of the tool):

- **cwd:** clean backend worktree at candidate SHA (generated bundles under tip)
- **`--source`:** clean `dummy_tcs` worktree at pinned architecture commit `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f`
- **`--commit`:** `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f`

```text
verified contract bundles from bbb0be3345c36e9cc7c4f06ca68fb491b742b83f
CONTRACTS_EXIT=0
```

Log: `premerge-be-contracts-verify-clean.log`.

Note: architecture YAML lives in `Piyush1087/dummy_tcs`, not in the backend tree. The npm verify script always overlays `PROCESSOR_ARCHITECTURE_COMMITS` and requires those pins as ancestors of `--commit` in `--source`. Backend candidate SHA is the **cwd** that owns the generated bundle tree being verified.

---

## 4. Gemini SST fallback â€” restored

`sst.config.ts` generic fallback:

```ts
GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
```

Matches `origin/development`.
**Chat/Home release:** set `GEMINI_MODEL=gemini-3.5-flash` explicitly in the **deployment environment** (not via global source fallback).

---

## 5. Reconfirm after changes

| Gate | Result |
|------|--------|
| P7-C1 workspace auth postgres | **PASS** â€” 11/11 (`premerge-be-p7c1-reconfirm.log`) |
| Backend `nest build` | **PASS** |
| Frontend `tsc -b` | **PASS** |
| Frontend `npm run build` | **PASS** |
| `git diff --check` vs `origin/development` | **PASS** after trailing-whitespace doc cleanup (commit on tip) |
| Migration integrity | **PASS** â€” 74 migration folders; accepted PI SQL blobs unchanged: `9718a592â€¦`, `e00ea913â€¦`, `e9b4252fâ€¦` |

P5 fixture + authenticated browser smoke: **deferred** to D1â€“D3 per mail (do not block merge).

---

## 6. Final candidate SHAs

| Repo | Branch | SHA |
|------|--------|-----|
| Backend | `integration/chat-home-v1` | `2ddab48df5a8f350911fe1ae3bd4aaf8f350d0f1` |
| Frontend | `integration/chat-home-v1` | `83aa665a008958eb50859d975e8955b9486583b0` |

Accepted runtimes still ancestors: BE `00e1299e…` · FE `1cf2e3bd…`.

---

## 7. Ask

Please authorize **`INTEGRATION_MERGE_AUTHORIZED`** for merge of these tips into `origin/development`.
After merge is confirmed, we can proceed to **dev deploy + D1–D3 smoke**.
**Production remains separately gated.**
