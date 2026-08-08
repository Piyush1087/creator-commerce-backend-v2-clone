# Intelligence System Architecture

**Status:** MVP architecture

## Architecture

```text
Metadata Layer
├── Intelligence Objects
├── Processors
├── Execution Profiles
└── Artifacts

Execution Layer
└── Intelligence Compiler
    ├── AI Executor
    ├── Rule Executor
    ├── Formula Executor
    └── Future Executors

Runtime Layer
├── Processor Execution
└── Intelligence State / History

Validation Layer
└── Metadata & Runtime Integrity Validation
```

## Metadata layer

### Intelligence Objects
Defines the meaning and lifecycle of intelligence owned by the platform: canonical identifier, engine/branch ownership, type, producer, edit/lock/refresh behaviour, evidence requirements where applicable, and canonical backend destination.

For MVP, branch definition and object definition should be represented together wherever practical rather than maintained as duplicate BDR/IOR/ISR documents.

### Processors
A processor is a reusable unit that produces one or more intelligence objects. It declares inputs, outputs, evidence requirements and artifact references. A processor can be AI-backed or deterministic.

Processor boundaries follow execution behaviour, not documentation hierarchy. Multiple related objects may be produced by one processor when they naturally execute together.

### Execution Profiles
Execution profiles select processors and define orchestration: stages, dependencies, parallel groups, execution depth/output scope and checkpoint boundaries.

Profiles do not own intelligence logic.

### Artifacts
Reusable processor resources such as:
- global/shared instructions;
- reasoning;
- taxonomies;
- examples where useful;
- output contracts;
- evaluation assets.

Artifacts are independently versioned and referenced by processors. They should be shared only where behaviour genuinely overlaps.

## Execution layer

The Intelligence Compiler compiles metadata and runtime context into executable work. It delegates execution to the appropriate executor.

AI-specific expertise is assembled from processor artifacts and context; the platform does not require a permanently separate agent for every business capability.

## Runtime layer

### Processor Execution
Every execution creates immutable telemetry including processor/version, entity, model/executor, artifacts, timing, token usage where relevant, retries, status and errors.

This is runtime data and belongs in PostgreSQL rather than manually maintained YAML.

### Intelligence State / History
Stores object-level provenance and lifecycle state where this cannot or should not live in the canonical application table: evidence lineage, execution lineage, confidence where applicable, user confirmation/manual override, protection/lock state and historical values.

Canonical product-facing values should continue to live in the existing application schema wherever possible.

## Validation layer

Validation operates at two levels:

1. **Metadata integrity** — referenced objects, processors, profiles, artifacts and dependencies exist and are internally valid.
2. **Runtime integrity** — preflight requirements are satisfied, model/executor output matches the requested scope/contract, protected objects cannot be overwritten, and persistence succeeds.

## Architecture compression from earlier design

Earlier exploration used separate documents such as IBS/BDR, PDR, IOR/IOS, ISR, relationship maps and branch-specific PER definitions. The MVP architecture preserves their responsibilities but avoids duplicate manually maintained representations:

- branch + object ownership → Intelligence Object metadata;
- processor definition → Processor metadata;
- relationships → processor/object references and database relations;
- PER → global runtime table;
- ISR → object lifecycle metadata + runtime Intelligence State/History;
- relationship maps → generated from metadata when needed;
- integrity validation → executable global validation plus local rules where necessary.

The objective is to reduce architecture maintenance without reducing modularity, reliability or traceability.
