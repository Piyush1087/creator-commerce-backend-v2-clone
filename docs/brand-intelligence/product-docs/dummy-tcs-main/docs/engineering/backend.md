# BACKEND_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED

Supplements `AI_ENGINEERING_STANDARD.md`. This document owns backend-specific implementation requirements.

## 1. Backend Context
Before material backend work, inspect relevant NestJS modules, controllers, services, dependency injection, data-access patterns, authentication/authorization, API/error conventions, external integration patterns and tests.

Load `database.md`, `validation.md` or `ai-integration.md` only when the task affects those concerns.

## 2. Module Implementation
Backend structure SHOULD preserve domain/module ownership defined by applicable contracts. Cross-module capabilities SHOULD be consumed through explicit interfaces/contracts appropriate to the architecture.

When a non-owning module requires a snapshot, projection, cache or read model of canonical data, its non-canonical role SHOULD be explicit.

## 3. Controllers
Controllers SHOULD primarily receive transport input, obtain request/authentication context, invoke appropriate validation, call the owning application capability and return defined transport responses.

Substantial business/domain logic SHOULD NOT primarily live in controllers. External mutation inputs MUST pass applicable executable validation defined by `docs/engineering/validation.md`.

## 4. Services & Domain Operations
Services SHOULD implement behavior belonging to their domain/application responsibility. Avoid generic services containing unrelated business operations.

Substantial deterministic domain decisions SHOULD be isolated into testable logic where doing so materially improves comprehension or verification.

Lifecycle changes SHOULD be expressed through owned domain operations rather than arbitrary direct status assignment when transition behavior exists.

## 5. Persistence Boundary
Follow established repository data-access patterns. Avoid scattering direct persistence operations through unrelated layers when an established persistence boundary exists.

Database shape does not automatically determine domain architecture, and domain objects do not automatically require one-to-one database models. Persistence/schema changes are governed by `docs/engineering/database.md`.

## 6. Transactions
Operations that must succeed or fail together require an appropriate atomic boundary. Keep transaction scope limited to operations requiring atomicity.

Avoid holding database transactions open across slow external network operations unless explicitly required. When database state and external side effects form one workflow, define appropriate failure/recovery behavior.

## 7. Idempotency, Duplicate Execution & Concurrency
Operations vulnerable to retries or duplicate execution SHOULD define duplicate behavior. Particular attention may be required for lifecycle operations, webhooks, asynchronous jobs, payments, external callbacks and AI-triggered creation.

Determine whether an operation is naturally idempotent, explicitly deduplicated, protected by an idempotency mechanism or intentionally repeatable. Frontend duplicate prevention is not backend idempotency.

Where concurrent mutation can violate a domain invariant or overwrite meaningful state, use an appropriate concurrency strategy rather than assuming requests execute sequentially.

## 8. API Contracts
Request, response and meaningful error semantics SHOULD be explicit. Do not expose persistence models directly merely to avoid defining an appropriate transport/domain contract.

Before changing an existing API contract, identify applicable consumers. Prefer additive evolution where reasonable.

Where failures must be distinguished programmatically, expose stable machine-readable semantics rather than requiring consumers to parse human-readable error strings.

## 9. Backend Error Handling
Distinguish relevant failure categories such as validation/domain, authentication, authorization, not found, conflict, dependency and unexpected system failure.

Do not expose raw infrastructure/provider errors directly to clients. Translate provider/infrastructure failures at an appropriate boundary when consumers should not depend on provider-specific details. Preserve useful diagnostics internally without exposing sensitive information.

## 10. External Integrations
External integrations SHOULD define where applicable authentication, input/output contract, response validation, timeout, retry, rate limits, failure semantics and observability.

Provider-specific structures SHOULD be translated into application-owned contracts where practical. Whether dependency failure blocks, degrades, retries or falls back derives from the applicable product/integration contract.

## 11. Asynchronous Work
Use established repository job/event infrastructure. Async work SHOULD define where relevant job identity, input contract, retry behavior, duplicate behavior, terminal failure handling and observability.

Do not assume exactly-once delivery unless infrastructure guarantees it. Handlers SHOULD be safe under actual delivery semantics.

Events SHOULD represent meaningful facts or integration signals rather than substitute unnecessarily for clear module interfaces.

## 12. Backend Authorization
Use established authentication and authorization architecture. Authorization MUST be enforced at the appropriate backend capability/resource boundary.

Where access depends on resource ownership or membership, verify that relationship server-side. Do not trust client-supplied ownership claims.

## 13. Configuration
Use established environment/configuration mechanisms. Critical configuration SHOULD fail clearly when missing or invalid rather than producing ambiguous downstream runtime behavior. Universal secret-handling requirements continue to apply.

## 14. Observability
Prioritize observability around meaningful operational boundaries such as critical lifecycle transitions, external integrations, asynchronous processing, Intelligence execution and unexpected failures.

Logs SHOULD preserve useful non-sensitive operational context. Use correlation/request/job identity where needed to diagnose multi-step operations.

## 15. Backend Performance
Avoid clearly inefficient patterns such as N+1 queries, repeated database requests, unbounded reads, excessive relation loading and repeated identical external requests.

Do not introduce caching, queues, denormalization or other architectural complexity based solely on speculative scale.

## 16. Backend Verification
In addition to the universal Definition of Done, verify where applicable:
- domain/module ownership;
- API/error behavior;
- validation boundary;
- transaction behavior;
- duplicate/retry/concurrency behavior;
- authorization;
- external dependency failure behavior;
- relevant domain/service/integration tests;
- relevant build/type checks.

Persistence-specific verification follows `docs/engineering/database.md`. Only report checks actually performed.