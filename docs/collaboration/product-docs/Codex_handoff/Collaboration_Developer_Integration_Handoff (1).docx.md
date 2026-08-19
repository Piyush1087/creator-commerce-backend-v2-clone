# **Collaboration Module — Developer Integration Handoff**

**Review and reconcile frozen clone implementations into the developer-owned deployment repositories**

Prepared from the final reconciled Collaboration implementation and frozen canonical specifications.

| Backend source clone | Piyush1087/creator-commerce-backend-v2-clone |
| :---- | :---- |
| **Backend source branch** | collaboration/final-backend-reconciliation |
| **Backend source commit** | 13ce652f432560a91dde1f75ca9a21dfa76d054f |
| **Frontend source clone** | Piyush1087/creator-commerce-frontend-v2-clone |
| **Frontend source branch** | collaboration/frontend-production-reconciliation |
| **Frontend source commit** | 39510031066c44f20d59d1375c01678f34e585f8 |
| **Canonical product/spec repo** | Piyush1087/dummy\_tcs — collaboration/ |
| **Deployment ownership** | Developer-owned repositories \+ existing SST process |

# **1\. Handoff objective**

The Collaboration module has been redesigned and implemented across isolated backend and frontend clone repositories. The code has been cross-reconciled against the frozen dummy\_tcs Collaboration contracts. This handoff asks the developer to review these implementations, reconcile them into the actual developer-owned repositories in the order most appropriate for the current codebase, validate them there, and deploy through the team’s existing process when ready.

The clone repositories are implementation sources, not AWS-connected deployment repositories. No AWS or database mutation has been performed as part of the final reconciliation.

# **2\. Product behavior being integrated**

* Application-origin canonical Collaboration provisioning with Campaign / Brief / Deliverable lineage.  
* Negotiation with fixed or negotiable commercials and at most one Brand counter.  
* Platform-Escrow securement with Creator fee separated from the total commercial reserve.  
* Fulfillment with Brand support, Creator confirmation, issue/remediation and hard-stop paths.  
* Per-Deliverable Production with append-only submission versions, two Brand-requested revisions, approval/final rejection and 72-hour auto-approval boundary.  
* Per-Deliverable Publishing authorization, evidence, correction and compliance verification.  
* Backend-owned terminal/exception financial resolution.  
* Settlement as a separate execution layer with independent Creator payout and Brand refund legs.  
* Normal completion only after canonical settlement completion; terminal Collaborations remain terminal while residual settlement executes.  
* 48-hour double-blind Feedback after normal completion.  
* Persistent messaging and HTTP-first hydration with realtime invalidation/refetch.  
* Co-Pilot counter / accept-terms / secure-Escrow intents routed into canonical services.  
* Legacy compatibility retained where necessary, while canonical Application-origin rows are protected from legacy mutation paths.

# **3\. Source authority and merge principle**

| Authority | Source | How to use it |
| :---- | :---- | :---- |
| Product semantics | dummy\_tcs/collaboration/ | Use to understand intended state/command/read/financial behavior. Do not copy as runtime dependency. |
| Backend executable implementation | backend clone at final commit | Primary source for Prisma, migrations, services, routes, policies, read model and tests. |
| Frontend executable implementation | frontend clone at final commit | Primary source for contracts, API client, shared workspace, stage panels and command UI. |
| Deployment mechanics | Developer repo sst.config.ts \+ deployment README | Remain source of truth for dev/prod deployment and migration execution. |

Do not blindly overwrite the developer repositories. Reconcile by behavior and file intent because those repositories may contain parallel changes made after the clones diverged.

# **4\. Backend integration surface**

| Area | Source location | Developer action |
| :---- | :---- | :---- |
| Schema/migrations | prisma/schema.prisma \+ eight Collaboration migrations | Merge additive Collaboration persistence without deleting unrelated existing models. Preserve existing baseline migration history. |
| Collaboration module | src/features/collaboration/ | Review as the main canonical implementation: controller, module, services, schemas, policies, types, mappers and tests. |
| Application provisioning | src/features/brand-uce/ | Reconcile Application → Collaboration provisioning and snapshots. |
| Escrow boundary | src/features/brand-escrow/ | Preserve existing escrow ownership/ledger authority; Collaboration references it rather than replacing it. |
| Pricing/geography | src/features/pricing/ \+ Brand geography integration | Preserve pricing-owned commission/subscription/geography semantics; do not duplicate them inside Collaboration. |
| Co-Pilot | src/features/co-pilot/services/co-pilot-hitl.service.ts \+ modules/collaboration/ | Reconcile canonical action routing and canonical-row guards. |
| App wiring | src/app.module.ts | Ensure final Collaboration module dependencies are registered once and without duplicate legacy authority. |

# **5\. Required backend migrations**

* 20260810180000\_collaboration\_phase\_1\_foundation  
* 20260810193000\_collaboration\_phase\_3\_commercial\_commands  
* 20260810213000\_collaboration\_phase\_3\_1\_financial\_boundary  
* 20260810233000\_collaboration\_phase\_4\_1\_fulfillment  
* 20260811013000\_collaboration\_phase\_4\_2\_production  
* 20260811143000\_collaboration\_phase\_4\_4\_publishing  
* 20260811180000\_collaboration\_phase\_4\_6\_settlement  
* 20260812190000\_collaboration\_phase\_4\_7\_feedback

The final reconciliation verified all eight migrations exist in the backend clone and schema.prisma contains the complete additive result. In the developer repository, review migration ordering and any concurrent schema changes before deployment. Follow the repository’s existing SST migration process rather than this handoff for deployment mechanics.

# **6\. Frontend integration surface**

| Area | Source location | Developer action |
| :---- | :---- | :---- |
| Shared workspace | src/features/collaboration/components/CollaborationWorkspace.tsx | Use one shared Brand/Creator workspace and preserve HTTP-first hydration/deep-link behavior. |
| Execution routing | CollaborationExecutionHub.tsx \+ components/execution/ | Reconcile lifecycle precedence and five-stage functional panels. |
| Publishing/Settlement | components/publishing/ | Preserve per-Deliverable Publishing and separate Settlement presentation. |
| Contracts | contracts/collaboration.contracts.ts | Keep exact alignment with final backend read model and nullable/blocked states. |
| API client | api/collaboration-client.ts | Keep exact backend paths/payloads, commandId and expectedAggregateVersion. |
| Capabilities | utils/collaboration-capabilities.ts | All public backend availableActions must map here or be intentionally hidden. |
| Realtime | hooks/use-collaboration-realtime.ts | Keep one canonical invalidation/refetch hook; do not reconstruct workflow from socket payloads. |
| Routes/pages | Brand \+ Creator Collaboration page integrations | Both roles mount the shared workspace. Preserve canonical and legacy deep-link compatibility. |
| CSS | components/collaboration-workspace.css | Reconcile Collaboration-specific responsive behavior without replacing unrelated global design-system styling. |

# **7\. Critical invariants to preserve during merge**

* Lifecycle is separate from canonical stage. Feedback is not Stage 6\.  
* Backend availableActions is action authority; frontend must not infer permission from stage/role alone.  
* Creator agreed fee is not the same as total commercial reserve. Reserve \= Creator gross fee \+ pricing-owned commission \+ 18% GST on commission for current India MVP policy.  
* No fixed 30/70 commercial assumption is canonical.  
* Fulfillment workflow is subtype-driven, not industry-driven.  
* Production and Publishing are per Deliverable, not global Collaboration media/finalization.  
* AUTO\_APPROVED publishing-required content remains NOT\_AUTHORIZED until Brand authorization.  
* Financial entitlement is backend-owned and separate from Settlement execution.  
* Publishing compliance verification does not itself release funds or complete the Collaboration.  
* Normal completion occurs only under canonical Settlement completion semantics.  
* Terminal Collaborations retain terminal lifecycle after residual financial execution.  
* Feedback is double-blind and backend-persisted; frontend must not reveal on a local timer.  
* Legacy routes/fields may remain for compatibility but must not mutate or own canonical Application-origin truth.  
* dummy\_tcs must never become a runtime dependency.

# **8\. Validation already completed in source clones**

Backend final reconciliation: Prisma validate PASS; Prisma generate PASS; 101 Collaboration tests PASS; final Co-Pilot reconciliation tests PASS; Nest production build PASS; changed-file ESLint PASS; git diff \--check PASS. Standalone repository-wide tsc remains affected by pre-existing SST-generated global/config issues outside Collaboration.

Frontend final reconciliation: typecheck PASS; full src/features/collaboration ESLint PASS; production Vite build PASS; git diff \--check PASS. Existing large-chunk advisory is non-blocking.

# **9\. Developer review and integration sequence**

1\. Review the product/file-map document and dummy\_tcs canonical contracts before merging.

2\. Reconcile the backend clone into the actual backend repository, preserving unrelated concurrent work.

3\. Reconcile Prisma schema and all eight Collaboration migrations; resolve any schema/migration conflicts before deployment.

4\. Run backend validation in the actual repository: Prisma validate/generate, Collaboration tests, relevant lint/type/build checks.

5\. Reconcile the frontend clone into the actual frontend repository.

6\. Run frontend validation in the actual repository: typecheck, Collaboration lint and production build.

7\. Compare final frontend API paths/types/actions against the merged backend one final time.

8\. Use the existing developer-owned SST/deployment documentation for dev deployment and migration execution.

9\. Create fresh Collaborations for runtime testing; do not depend on legacy Collaboration rows for acceptance.

10\. Run Brand and Creator acceptance flows across normal and selected terminal paths.

11\. Report any merge-time/runtime divergence back against the clone commit and canonical contract rather than silently changing product semantics.

# **10\. Suggested runtime acceptance coverage after integration**

* Negotiation: fixed path; negotiable path with one counter; decline.  
* Securement: request funding; processing/completed projection; payout-details prerequisite.  
* Fulfillment: no-support path; support confirmation; issue → remediation; hard-stop path.  
* Production: v1 approval; revision v2/v3; final rejection; auto-approved presentation.  
* Publishing: explicit approval; auto-approved authorization; evidence; correction; verification; blocked state.  
* Settlement: eligible, processing, confirmed, blocked, zero-cash and residual terminal settlement presentation.  
* Completion/Feedback: completion summary, first hidden review, second-review reveal, deadline-driven reveal when scheduler exists.  
* Re-entry/realtime: refresh, deep link, socket disconnect/reconnect, stale aggregate conflict.  
* Role security: Brand/Creator controls match backend availableActions and wrong-role commands are rejected.

# **11\. Deferred / external dependencies**

| Dependency | Current status / implication |
| :---- | :---- |
| Asset storage/upload provider | Needed for production-grade Deliverable asset handling; current contract uses provider-neutral references. |
| Settlement payout/refund adapter | Needed for real money movement. Current deferred gateway must not falsely report processing. |
| AutoApprove scheduler | Needed to invoke trusted deadline auto-approval automatically. |
| RevealFeedback scheduler | Needed to invoke trusted 48-hour reveal automatically. |
| Publishing platform/API verification | Current evidence/compliance model is provider-neutral. |
| Relationship-history context endpoint | Context drawer expansion; not core workflow blocker. |
| Frontend automated-test framework | No test stack was introduced in the clone. |
| TDS / FX / non-India policy | Explicitly deferred beyond current India MVP Collaboration boundary. |
| Pause/resume | Explicitly deferred product semantics. |

# **12\. Legacy data and compatibility**

Fresh Collaborations should be created for dev acceptance. Existing legacy Collaborations should not be used as proof of the new canonical flow. However, do not remove the compatibility guards and legacy read/write boundaries during merge: the clone intentionally prevents legacy commercial, media, posting and finalization paths from mutating canonical Application-origin rows while retaining compatibility for legacy rows.

# **13\. Deployment boundary**

This handoff does not prescribe AWS operations. The developer’s actual repository sst.config.ts and deployment README remain the source of truth. The earlier developer review confirmed dev RUN\_MIGRATIONS\_ON\_START is enabled and routine dev releases use the existing SST/Docker migration path. Review the merged migrations before authorizing deployment.

No code in the clone repositories is directly connected to AWS deployment. Developer review/reconciliation into the actual repositories is required first.

# **14\. Expected developer output**

* Backend integration commit/PR and any merge conflicts or intentional deviations.  
* Frontend integration commit/PR and any merge conflicts or intentional deviations.  
* Confirmation that the eight migrations are present and schema reconciliation is clean in the actual backend repo.  
* Backend and frontend validation results in the actual repositories.  
* List of any canonical contract deviations that require product review.  
* Dev deployment result when the developer chooses to deploy.  
* Runtime acceptance findings and any defects requiring correction.  
* Confirmation of which deferred integrations are still pending before production use.

# **15\. Safety / authority statement**

The final source reconciliation performed no AWS access, no AWS mutation, no database access, no database mutation, and no modification of developer deployment repositories. The developer owns all subsequent repository integration, deployment, migration execution and environment acceptance.