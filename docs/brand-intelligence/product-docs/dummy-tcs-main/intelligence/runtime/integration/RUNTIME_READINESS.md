# Identity Runtime Readiness — Gap-Closing Pass

Status: NOT YET RUNNABLE end-to-end. Architecture is sufficiently closed; remaining blockers are concrete application adapters/configuration rather than new architecture.

## Correction completed in this pass

The real `executionId` is now threaded from `executionStarted()` through the Compiler into every AI/deterministic task, Prompt Builder context and ProcessorExecution telemetry. The previous `runtime_execution` placeholder is removed.

## Readiness matrix

| Component | Contract/design | Reference code | Concrete app binding | First dry-run blocker? |
|---|---|---|---|---|
| Identity Execution Profile | YES | YAML | loader missing | YES |
| Compiler DAG | YES | YES | generic | NO |
| Execution ID propagation | YES | YES | generic | NO |
| Global LLM artifacts | YES | files exist | loader missing | YES |
| Processor definitions/artifacts | YES | files exist | loader missing | YES |
| Intelligence Object definitions | YES | files exist | loader missing | YES |
| Model Registry | YES | models.yaml | resolver missing | YES |
| Prompt Builder | YES | reference TS | direct binding missing | YES |
| Gatekeeper website-direct provider | YES | provider boundary defined | real Gemini SDK/capability binding not verified | YES |
| Normalized evidence runtime | YES | evidence definitions exist | Zyte/Cheerio runtime/store binding missing | YES |
| Output validation | YES | Zod reference implementation | direct binding + taxonomy loader missing | YES |
| Canonical persistence | YES | mapping + adapter boundary | Prisma binding/migration unresolved | NO for dry run; YES for writes |
| Execution telemetry | YES | port defined | DB/log implementation missing | YES for traceable test |
| API/service trigger | YES | service.ts | framework route missing | YES for UI-triggered test |
| Scan admission/reuse/abuse rules | previously defined onboarding policy | not integrated here | production wrapper missing | NO for identity_test; YES for onboarding |

## P0 — blockers before first real `identity_test`

### 1. Repository/config loaders
Implement a server-only loader that resolves:
- `execution_profiles/identity_test.yaml`
- global artifacts
- processor definitions
- processor artifacts
- active Intelligence Object definitions
- Industry/Sub-industry taxonomy
- `models.yaml`

Do not dynamically accept repository paths from request input.

### 2. EvidenceRuntime concrete adapter
Bind the existing extraction path to the runtime port:
- `prepareIdentityEvidence()` starts homepage/about/header/footer acquisition/normalization immediately.
- `getEvidence()` awaits the evidence bundle required by the active processor.
- evidence bundle returns stable refs/run IDs plus normalized content.
- Gatekeeper `website_direct` must not wait for this evidence.

A failed warm-up must not be swallowed invisibly: warm-up may run asynchronously, but `getEvidence()` must surface the actual acquisition failure to the consuming task.

### 3. Gemini provider adapter
Bind the provider port to the actual Google Gemini SDK/API and environment secret.
Required before test:
- confirm configured model ID is accepted by the deployed provider account
- implement `website_direct` capability used by Gatekeeper
- implement normalized-evidence structured request
- timeout/retry policy from Model Registry
- usage/latency metadata
- no API key in prompts/logs

### 4. Prompt Builder binding
Use the existing Prompt Builder implementation rather than reconstructing prompts in the integration adapter. Resolve active output schema before provider call.

### 5. Validator binding
Route by processor/scope into `validateProcessorOutput()` and load canonical taxonomy for Gatekeeper semantic validation. Convert structured validator issues into task error metadata without losing paths/codes.

### 6. Telemetry adapter
Minimum dry-run telemetry must create an Execution and ProcessorExecution representation (DB rows if current schema supports them, otherwise structured server logs for the first developer test) with:
- execution/profile/task IDs
- start/end/duration
- model/profile/model ID
- prompt_build_id
- evidence refs
- artifact versions
- provider latency/usage when available
- validation status/error
- persistence skipped flag

### 7. Developer test entry point
Before wiring a frontend button, create one authenticated/dev-only server command or API endpoint that calls `IntelligenceService.execute()` with `persistResults=false`. This is the shortest path to proving the runtime.

## P1 — required before enabling canonical writes

- Apply/verify the six-field Identity BrandProfile schema patch.
- Resolve all VERIFY/RECONCILE persistence mappings against deployed Prisma schema.
- Implement Prisma transaction adapter.
- Add lifecycle/manual-value protection checks.
- Integration-test null behavior and partial processor writes.
- Keep `persist_results=false` until all above pass.

## P2 — required before production onboarding trigger

- existing verified-brand rejection
- seven-day scan reuse
- five-site / five-repeat abuse safeguard and pre-verification requirement
- onboarding one-time review checkpoint
- discard manual edits when domain verification fails
- domain verification workflow
- reuse of validated scan output without rerunning expensive AI
- production authorization/rate limits

These are application/onboarding controls and must wrap the Compiler; they do not belong inside Identity reasoning artifacts.

## First dry-run acceptance criteria

A single known supported brand URL should demonstrate:
1. Execution row/log starts with a real execution ID.
2. Gatekeeper starts immediately using Gemini direct website access.
3. Zyte/Cheerio evidence acquisition starts concurrently.
4. Gatekeeper returns a structurally + taxonomically valid supported classification.
5. Identity Core waits for normalized evidence, builds a traceable prompt and validates output.
6. Industry Niche, Reporting Currency and Market Geography become runnable after dependencies and execute concurrently where possible.
7. Every AI task records model/artifact/evidence/prompt metadata.
8. Final result contains only validated outputs.
9. `persistResults=false` results in zero BrandProfile mutation.
10. Any deliberately malformed provider fixture fails validation and is not published as a canonical dependency.

## Recommended implementation order

1. loaders + Model Registry resolver
2. Prompt Builder + validator direct bindings
3. telemetry adapter
4. Gemini normalized-evidence adapter
5. Gatekeeper website-direct adapter
6. EvidenceRuntime Zyte/Cheerio binding
7. dev-only execution endpoint/command
8. run fixture tests
9. run first live dry-run
10. only then Prisma persistence + production onboarding wrapper

## Architecture verdict

No new Intelligence architecture layer is required for the first Identity execution. The remaining work is implementation plumbing and testing. If a new abstraction is proposed before the first dry-run, it should be justified by a concrete blocker in this checklist rather than documentation symmetry.
