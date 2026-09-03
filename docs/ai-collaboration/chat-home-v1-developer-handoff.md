# The Creator Shop — Chat Engine + Brand Home V1 Developer Handoff

**Status:** CLOSED / READY FOR DEVELOPER INTEGRATION, RELEASE PREP & PRODUCTION-SHAPED VERIFICATION  
**Prepared:** 3 September 2026  
**Scope:** Brand-side Chat Engine + Brand Home V1 — accepted backend and frontend runtime, integration/deployment guidance, production release controls, and deferred/future scope.  
**Audience:** Developer responsible for integration into the active application line, dev/prod deployment, release verification, and future maintenance.

---

## 1. Final canonical authority

### Product / architecture authority

- Repository: `Piyush1087/dummy_tcs`
- Branch: `main`
- Authority SHA: `d69ba6b8cb331bfa36b450307d9defcd26d09c6e`
- Principal Product authority: `intelligence/product_authority/chat_home_v1_product_authority_register.md`

This Product authority defines the permanent Brand V1 semantics. Runtime code must not override it because of legacy UI, legacy CoPilot behavior, provider behavior, or integration convenience.

### Backend

- Repository: `Piyush1087/creator-commerce-backend-v2-clone`
- Source branch: `program/chat-home-v1`
- **Accepted runtime SHA:** `00e1299ec2e97497bc6d81aeda808d6edd3b482a`
- P7 pre-Systems evidence SHA: `b30b1bb3473ec445f591336eec08a2b0ff8316e7`
- Final Systems closeout / acceptance ledger SHA: `c42a2cc44b922f8631c1e93606415407542869ce`
- Canonical execution ledger: `docs/ai-collaboration/chat-home-v1-execution-ledger.yaml`

### Frontend

- Repository: `Piyush1087/creator-commerce-frontend-v2-clone`
- Source branch: `program/chat-home-v1`
- **Accepted runtime SHA:** `1cf2e3bd93425f60fb3d40692320078aea567794`

### Final program state

```text
CHAT_HOME_BRAND_V1_RUNTIME_ACCEPTED = YES
P7 = CLOSED
P0_TO_P7_IMPLEMENTATION_PROGRAM = CLOSED
P8 = NOT_DEFINED
```

There is no remaining Chat/Home V1 implementation phase.

---

## 2. What this handoff covers

This handoff covers the accepted Brand-side application surface made up of:

1. **Brand Home V1** — proactive, request-time, deterministic decision surface.
2. **Permanent Chat** — persistent conversation workspace backed by real Gemini synthesis over authorized canonical capabilities.
3. **Small durable capability layer** — 13 registered Brand V1 capabilities; no `EXECUTE` capability.
4. **Common Intelligence consumer** — Brand Intelligence and Product Intelligence are consumed through the accepted Intelligence boundary rather than rebuilt in Chat.
5. **Canonical state reads** — Brand, Offering, Campaign, Collaboration, workspace readiness, and provider readiness.
6. **Fail-closed navigation** — server-authorized destination vocabulary only; no arbitrary model URLs.
7. **Conversation persistence and isolation** — user × Brand/workspace scoped conversation access.
8. **Brand Home frontend reconciliation** — real Home API, full state-family rendering, desktop/mobile integration, and permanent Chat UI.
9. **P7 production-shaped acceptance** — authenticated backend + frontend runtime, real Gemini Chat, browser verification, isolation, business-write purity, and degraded/unavailable states.
10. **P7-C1 correction** — generic Brand workspace authorization is side-effect-free; explicit Brand Centre activity still retains its own session/inactivity behavior.

---

## 3. Product behavior frozen in V1

### Brand Home

Canonical section order:

```text
1. NEEDS_ATTENTION
2. CREATOR_SHOP_HAS_LEARNED
3. OPPORTUNITIES_NEXT_ACTIONS
4. CURRENT_MOMENTUM
```

Backend endpoint:

```text
GET /api/v1/brand/home
contractVersion = "1.0"
```

Home is assembled at request time from canonical state and current Intelligence. It is not persisted as a separate business object and it does not call Gemini.

Accepted state grammar:

```text
Top-level: READY | PARTIAL | UNAVAILABLE
Section:   READY | EMPTY | PARTIAL | UNAVAILABLE
Freshness: CURRENT | STALE | UNKNOWN
```

The frontend must not manufacture recommendation authority, priority, freshness, or source state.

### Permanent Chat

Permanent Chat may:

```text
READ
REASON / SYNTHESIZE
RECOMMEND
NAVIGATE
PROPOSE NON-MUTATING NEXT STEPS
```

Permanent Chat may **not** execute business actions in V1.

Conversation persistence is intentional and permitted. Conversation history informs interaction; it does not become current business truth.

Backend API:

```text
POST  /api/v1/chat/conversations
GET   /api/v1/chat/conversations
GET   /api/v1/chat/conversations/:conversationId
PATCH /api/v1/chat/conversations/:conversationId
POST  /api/v1/chat/conversations/:conversationId/turns
```

### Registered capability catalog

```text
workspace.context.read
brand.current.read
offering.list
offering.read
brand_intelligence.current.read
product_intelligence.current.read
campaign.list
campaign.read
collaboration.list
collaboration.read
workspace.readiness.read
provider.readiness.read
app.navigate
```

Accepted classes are `READ` and `NAVIGATE`; accepted `EXECUTE` count is `0`.

### Navigation vocabulary

```text
HOME
BRAND_CENTRE
OFFERINGS
CAMPAIGNS
COLLABORATIONS
SETTINGS
SETTINGS_INTEGRATIONS
SETTINGS_BILLING
```

Entity-specific navigation is permitted only for authorized compatible entity types. Arbitrary model URLs must never be trusted.

---

## 4. Key implementation locations

### Backend

```text
src/features/chat/
src/features/brand-home/
src/features/intelligence-consumer/
src/features/brand-centre/brand-centre-auth.service.ts
src/features/brand-centre/brand-workspace-authorization.service.ts
src/features/brand-centre/consumer/
src/features/brand-workspace-readiness/
src/features/brand-settings/
src/features/brand-uce/
src/features/collaboration/
src/app.module.ts
docs/ai-collaboration/chat-home-v1-execution-ledger.yaml
```

### Frontend

```text
src/features/chat/
src/features/brand-dashboard/api/brand-home-client.ts
src/features/brand-dashboard/contracts/brand-home.schemas.ts
src/features/brand-dashboard/hooks/use-brand-home.ts
src/features/brand-dashboard/components/brand-home-briefing-workspace.tsx
src/features/brand-dashboard/brand-dashboard-home.css
src/features/auth/navigation/brand-destination-navigation.ts
src/features/chat/navigation/chat-navigation.ts
src/pages/brand/dashboard/brand-dashboard-page.tsx
```

---

## 5. Product Intelligence dependency and migrations

Chat/Home consumes the existing accepted Intelligence runtime; it does not create another Intelligence engine.

The backend Chat/Home line includes convergence of accepted Product Intelligence V1. Preserve these accepted migrations exactly during integration:

```text
20260827223000_product_intelligence_v1_canonical_offering_foundation
20260827234500_product_intelligence_v1_generic_intelligence_subject_scope
20260828120000_data_extraction_offering_commercial_evidence
```

Accepted migration blob identities:

```text
9718a592525b3b4551519acd8a520cd50d110eee
e00ea913ccd91e8cad5b09ba888c7e9abdecc935
e9b4252f579ebe8550cbefae9834acf8be253a4f
```

The P7 acceptance fixture contained **66 applied migrations**. This is an acceptance reference, not a permanent production count. The active integration target may contain newer migrations. Do not recreate or rename the accepted migrations.

---

## 6. P7-C1 authorization correction — do not regress

Production-shaped acceptance found:

```text
P7-C1_BRAND_CENTRE_SESSION_ACTIVITY_BOUNDARY_LEAK
```

Accepted correction at backend runtime SHA `00e1299...`:

```text
Generic Brand workspace authorization
→ resolveBrandProfileIdForWorkspace(...)
→ authorization only
→ no Brand Centre activity mutation

Explicit Brand Centre activity
→ resolveBrandProfileId(...)
→ inactivity eviction + activity touch preserved
```

Do not collapse these paths during integration conflict resolution.

Generic Home/Chat/workspace reads must not change Brand Centre activity/session state or create Intelligence persistence merely because a read occurred.

---

## 7. Final validation evidence

### Backend

```text
Runtime SHA: 00e1299ec2e97497bc6d81aeda808d6edd3b482a
Full suite: 1175 passed / 0 failed / 500 skipped
Prisma generate: PASS
Prisma validate: PASS
Intelligence contracts: PASS
Build: PASS
git diff --check: PASS
Changed-scope lint: PASS
```

### Frontend

```text
Runtime SHA: 1cf2e3bd93425f60fb3d40692320078aea567794
104 test files
849 tests passed
0 failed
Typecheck: PASS
Production build: PASS
git diff --check: PASS
Changed-scope lint: PASS
```

### Integrated P7 acceptance also proved

- authenticated backend + frontend runtime;
- real Home and true `UNAVAILABLE` state;
- real Gemini Chat;
- Brand/Product Intelligence, Offering, Campaign, Collaboration, readiness/provider state;
- grounded recommendation basis refs;
- conversation persistence/reload;
- all eight navigation destinations + fail-closed invalid navigation;
- cross-Brand isolation and Intelligence read purity;
- business-write purity;
- desktop/mobile browser runtime and accessibility semantics;
- no Meta/Instagram/Razorpay/email/notification calls during ordinary acceptance reads;
- streaming: `NOT_RETAINED`.

---

## 8. Integration state at handoff creation

**Chat/Home is accepted but is not yet integrated into the current `development` branches.**

Observed remote `development` heads on 3 September 2026:

| Repository | Development SHA | Relationship to accepted Chat/Home line |
|---|---|---|
| Backend | `4c5f42858b950b7cd342f8972f99f548f3daa942` | **DIVERGED** |
| Frontend | `323658d4b147b95b5629ff8d91fa90b8fe9077e4` | **DIVERGED** |

Observed backend merge base:

```text
517531682f6286d5ee45bd48ec4e145e96d583a7
```

Observed frontend merge base:

```text
b50c36fd4b99b6e0ec0718291d794d7a58353f4c
```

These development SHAs are observations only. Re-fetch true remotes immediately before integration.

**Implication:** do not fast-forward the accepted Chat/Home branches over `development`; do not rebase/rewrite accepted runtime history.

---

## 9. Recommended integration procedure

Use the companion document `chat-home-v1-ai-worker-integration-production-initiation.md` as the execution instruction for the developer's AI worker.

Recommended shape:

```text
latest development
      +
accepted program/chat-home-v1
      ↓
dedicated integration branch
      ↓
validation
      ↓
normal non-force integration into development
```

Create isolated integration branches from current true remote `development`. Preserve accepted source history; do not force-push, rebase, or piecemeal cherry-pick the implementation merely to make history linear.

For conflicts:

1. preserve newer unrelated `development` work;
2. preserve accepted Chat/Home Product/security semantics;
3. resolve shared-file conflicts by semantic union, not wholesale side selection;
4. treat schema/migration/auth/Intelligence/AppShell/routing conflicts as high-risk;
5. stop for Product/security authority if a resolution would change capability classes/count, authorization, Home semantics, migration semantics, or business-write boundaries.

Backend candidate must pass Prisma generate/validate, Intelligence contracts, build, targeted tests, full suite, and `git diff --check`.

Frontend candidate must pass targeted Home/Chat/navigation tests, full suite, typecheck, production build, and `git diff --check`.

---

## 10. Environment and Gemini release requirement

Chat uses the existing `GeminiJsonClient` and reads `GEMINI_API_KEY` / `GEMINI_MODEL` from backend environment configuration.

**Accepted P7 real-provider runtime was validated with:**

```text
GEMINI_MODEL=gemini-3.5-flash
```

The generic code/SST fallback currently defaults to `gemini-2.5-flash`. A release expected to reproduce acceptance must therefore explicitly configure:

```text
GEMINI_API_KEY=<server-side secret>
GEMINI_MODEL=gemini-3.5-flash
```

unless a different model receives separate acceptance later.

Never place the Gemini key in Git, frontend variables, browser code, handoff docs, or logs.

---

## 11. Development deployment handoff

Deployment authority:

```text
Backend:  docs/deployment/README.md
Frontend: creator-commerce-frontend-v2-clone/docs/deployment/README.md
```

Current documented identities:

```text
Backend SST app: creatorshop-be
Frontend SST app: creatorshop-fe
AWS region: ap-south-1
Dev profile: creator-dev
Prod profile: creator-prod
Dev API: api.dev.thecreatorshop.in
Dev dashboard: dashboard.dev.thecreatorshop.in
Prod API: api.thecreatorshop.in
Prod dashboard: dashboard.thecreatorshop.in
```

Recommended dev order:

1. integrate and validate backend candidate;
2. integrate and validate frontend candidate;
3. after the integration gate passes and the human developer authorizes it, integrate the proven candidates into current `development` using the normal non-force process;
4. freeze exact backend/frontend `development` SHAs as dev release candidates;
5. review the pending migration set against dev Postgres;
6. deploy backend first using the existing SST/WSL runbook;
7. verify `/health/live`, migration/startup logs, and authenticated Home/Chat API smoke;
8. deploy frontend against the healthy dev backend;
9. run desktop/mobile browser smoke;
10. route any release-only defect through a version-controlled release-fix branch and revalidation — never patch the historical accepted source branches.

The current backend runbook says dev ECS runs `prisma migrate deploy` on startup when `RUN_MIGRATIONS_ON_START=true`; do not add an ad-hoc second migration process unless the runbook/infrastructure has changed.

---

## 12. Production release procedure

This handoff documents production procedure but does **not** itself authorize unattended production deployment. Production starts only after the human developer/release owner explicitly authorizes the exact release commits.

Freeze:

```text
BACKEND_RELEASE_SHA=<integrated, validated commit>
FRONTEND_RELEASE_SHA=<integrated, validated commit>
```

The backend runbook states `RUN_MIGRATIONS_ON_START=false` on prod. Therefore production migration is a separate reviewed step.

Before prod deploy:

- inspect exact pending migrations;
- preserve accepted Product Intelligence migration SQL/hashes;
- do not create ad-hoc replacements;
- do not run `migrate reset` on prod;
- follow the existing production migration/tunnel runbook;
- verify `GEMINI_MODEL=gemini-3.5-flash` unless separately superseded;
- verify server-side secrets without printing them.

Recommended production order:

```text
1. Reviewed production migrations
2. Backend deployment
3. Backend health + authenticated API smoke
4. Frontend deployment
5. Browser smoke
6. Observe logs/metrics before release completion
```

Production Chat/Home smoke should include Home section order/state truthfulness, zero Home Gemini calls, a few grounded Chat questions, conversation persistence, bounded navigation, P7-C1 purity, and mobile/desktop operation.

If rollback is necessary, deploy the last known-good application release through the existing SST process. Do not rewrite Git history or improvise destructive database rollback SQL.

---

## 13. Deferred / intentionally out-of-scope work

These are **not defects** and must not be added casually during integration:

```text
Creator-side Chat
write-capable / EXECUTE Chat
provider-side actions from Chat
financial execution from Chat
persistent autonomous agents
personal memory
vector memory
Recommendation Intelligence Engine
new generic workflow engine
streaming transport restoration
```

Creator Chat requires new Creator-specific Product/architecture authority. Do not simply expose Brand capability handlers to Creator actors.

Write-capable Chat requires a new command/authorization/confirmation/idempotency/audit/failure/rollback design. Do not convert the current `READ`/`NAVIGATE` catalog into `EXECUTE` under maintenance/release authority.

---

## 14. Deferred debt / release notes

### Product scope deferrals

- Creator Chat — future separate program.
- Write-capable Chat — future separate program.
- Streaming — deliberately not retained.
- Personal/vector memory — deliberately absent.
- Autonomous agent execution — deliberately absent.

### Release/integration obligations still pending

- integrate both accepted module branches into the active `development` lines;
- reconcile newer `development` work that landed after handoff creation;
- validate integrated migration history against target dev/prod Postgres;
- explicitly configure accepted Gemini model (`gemini-3.5-flash`) unless superseded;
- execute dev deployment/smoke and, when separately authorized, production rollout.

These are release operations, not reasons to reopen Chat/Home architecture.

---

## 15. Developer quick-start

1. Read this file and `chat-home-v1-ai-worker-integration-production-initiation.md`.
2. Read the final execution ledger at `c42a2cc...` and Product authority at `d69ba6b...`.
3. Fetch true remote source/target refs in both repos.
4. Create isolated integration branches from current `development`.
5. Preserve Product Intelligence migrations and the P7-C1 authorization split.
6. Validate backend and frontend integrated candidates fully.
7. Integrate proven candidates into `development` through normal non-force history.
8. Deploy backend then frontend to dev and run smoke.
9. If production is requested, freeze exact SHAs and follow the production runbook.
10. For Creator Chat, write-capable Chat, provider actions, or autonomous memory/agents: stop and obtain new Product/Systems authority.

---

## 16. Final handoff summary

```text
MODULE:
Chat Engine + Brand Home V1 — Brand side

PRODUCT AUTHORITY:
d69ba6b8cb331bfa36b450307d9defcd26d09c6e

BACKEND RUNTIME:
00e1299ec2e97497bc6d81aeda808d6edd3b482a

BACKEND FINAL SYSTEMS CLOSEOUT:
c42a2cc44b922f8631c1e93606415407542869ce

FRONTEND RUNTIME:
1cf2e3bd93425f60fb3d40692320078aea567794

RUNTIME STATUS:
ACCEPTED

IMPLEMENTATION PROGRAM:
CLOSED

CURRENT DEVELOPMENT INTEGRATION:
PENDING — BOTH REPOSITORIES DIVERGED AT HANDOFF CHECK

PRODUCTION DEPLOYMENT:
NOT PERFORMED BY CHAT/HOME PROGRAM

FUTURE CREATOR / WRITE-CAPABLE CHAT:
NEW AUTHORITY REQUIRED
```
