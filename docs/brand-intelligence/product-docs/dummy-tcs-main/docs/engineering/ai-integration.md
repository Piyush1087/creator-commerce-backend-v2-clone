# AI_INTEGRATION_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED

Supplements `AI_ENGINEERING_STANDARD.md`. This document governs how application modules integrate with AI models, Creator Shop Intelligence capabilities and governed prompt systems. It does not define Intelligence calculations, product decisions or prompt content.

## 1. AI Integration Context
Before modifying an AI/Intelligence integration, identify the owning capability, consuming module, input/output contracts, trigger, failure behavior, human-confirmation requirements, persistence/provenance requirements, applicable Prompt Builder specification and relevant existing implementation.

Do not load unrelated Intelligence internals merely because they exist.

## 2. Capability Boundary
Treat an Intelligence capability as an explicit application boundary: **input → Intelligence capability → structured output**. Consumers invoke the owning capability through its declared contract rather than depend on internal calculation or prompt implementation.

## 3. Input Contracts
Inputs SHOULD explicitly contain context required by the capability. Do not allow integration code to silently gather unrelated application data merely because it might improve output. Input ownership/permissible context derive from the applicable contract.

## 4. Output Contracts
Application-dependent AI outputs SHOULD use explicit structured contracts where practical. Consumers MUST NOT infer stable application behavior by parsing arbitrary natural-language responses when a structured contract is appropriate.

Output schemas SHOULD represent what the consuming application needs rather than expose unnecessary provider internals.

## 5. Output Validation
All model-generated structured output is untrusted until validated according to `docs/engineering/validation.md`. Invalid output MUST NOT silently become canonical application state.

Applicable Intelligence contracts determine whether invalid output retries, falls back, degrades, regenerates, blocks or returns no result.

## 6. Intelligence Ownership
If a consumer needs additional canonical output, modify the owning Intelligence contract rather than extending the response privately. Locally approximated Intelligence is permitted only when an explicit fallback contract allows it.

## 7. Trigger Ownership
Intelligence execution MUST follow its canonical trigger, such as explicit user action, creation, publish/launch, relevant field change, scheduled refresh or upstream-data refresh where defined.

Do not introduce additional AI/model calls simply because sufficient data happens to be available.

## 8. Human Confirmation & Autonomy
Whether AI recommends, drafts, mutates, publishes, approves or triggers another operation without human confirmation is a product/domain decision. Technical capability does not imply permission for autonomous action.

## 9. Prompt Builder
Where a governed Prompt Builder owns production prompt construction, application modules MUST use it rather than maintain competing production prompts.

Application code SHOULD separate **domain context → prompt/context builder → model invocation → structured output → validation → domain consumption**.

Avoid embedding substantial production prompts directly inside unrelated business/service logic when governed prompt architecture exists.

## 10. Prompt Inputs
Prompt/context inputs SHOULD be explicit and traceable. Untrusted external/user content SHOULD remain distinguishable from system/application instructions where relevant to prompt safety. Do not silently broaden prompt context beyond what the owning capability permits.

## 11. Prompt & Model Versioning
Material production prompt/model configuration SHOULD preserve version identity where required for reproducibility, evaluation, debugging, comparison, provenance or controlled rollout.

Not every minor prompt requires elaborate version infrastructure; follow applicable Prompt Builder/Intelligence requirements.

## 12. Model & Provider Boundary
Product/domain behavior SHOULD depend on declared capability contracts rather than provider-specific response structures. Model/provider configuration SHOULD be separated from unrelated domain logic where practical.

Changing model/provider MUST NOT silently change the expected application output contract.

## 13. Fallbacks
Fallbacks MUST be explicit when they can materially alter product behavior. Do not independently introduce alternate models, alternate prompts, heuristic scoring or locally approximated Intelligence as silent fallbacks.

## 14. Provenance
Material derived/Intelligence outputs SHOULD preserve sufficient provenance where required to interpret, reproduce, compare, refresh or audit results. Depending on the capability this may include capability/version, prompt/model version, generation time, source/context identity or result identity.

The owning Intelligence specification determines required fields and persistence.

## 15. Refresh & Staleness
Where Intelligence depends on changeable upstream data, the owning capability SHOULD define staleness/refresh behavior when it matters to the product. Consumers MUST NOT invent independent freshness policies for canonical Intelligence outputs.

## 16. Failure & Reliability
AI/model dependencies are fallible. Integration behavior SHOULD define applicable timeout, retry, rate-limit behavior, malformed-output handling, provider failure and fallback/degradation.

Retries SHOULD account for cost, latency and duplicate downstream effects. Do not present fabricated or stale output as newly generated unless the contract explicitly permits it.

## 17. Persistence
Persist AI/Intelligence output only when required by product/architecture. Where persisted, distinguish canonical user/domain data, derived Intelligence, historical snapshots and temporary generation state. Persistence decisions follow `docs/engineering/database.md`.

## 18. Observability
Material AI operations SHOULD provide sufficient operational visibility to diagnose execution, validation/provider failure, latency, retries and version/provenance issues. Do not log sensitive prompt context, secrets or unnecessary user data.

## 19. Evaluation
Critical Intelligence/prompt capabilities SHOULD have repeatable evaluation appropriate to their purpose. Separate **contract correctness** from **model-output quality**.

Deterministic integration behavior such as schema validation, trigger logic, fallback handling and persistence SHOULD be testable independently from subjective model quality. Detailed evaluation methodology belongs to the applicable Intelligence/Prompt Builder specification.

## 20. AI Integration Verification
In addition to the universal Definition of Done, verify where applicable:
- owning capability and consumer are clear;
- input/output contracts are followed;
- structured output is validated;
- trigger behavior is correct;
- human-confirmation/autonomy behavior matches the product contract;
- Prompt Builder ownership is respected;
- fallback behavior is explicit;
- provenance/version requirements are preserved;
- invalid/provider-failure paths are handled;
- deterministic integration behavior is tested where material.

Only report checks actually performed.