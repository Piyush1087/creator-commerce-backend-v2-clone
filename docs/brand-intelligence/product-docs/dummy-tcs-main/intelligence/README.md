# Intelligence Platform

Creator Shop models business understanding as reusable intelligence rather than feature-specific AI outputs.

## Platform documents

- `master_intelligence_schema.md` — top-level intelligence engines and ownership boundaries.
- `architecture/intelligence_system.md` — metadata, execution, runtime and validation architecture.
- `architecture/intelligence_compiler.md` — compiler responsibilities and runtime compilation flow.
- `architecture/execution_profiles.md` — orchestration specification for selecting and sequencing processors.
- `engines/` — engine definitions and branch implementations.

## Core principles

1. Intelligence is generated once and reused.
2. Intelligence objects have clear ownership.
3. Evidence acquisition is separated from reasoning.
4. AI, rules and formulas can all produce intelligence.
5. Processors reference reusable artifacts instead of embedding large prompt definitions.
6. Runtime execution and telemetry are stored as runtime data, not manually maintained branch documents.
7. Intelligence must remain traceable to evidence and execution history.
8. The architecture should remain modular without creating unnecessary documentation for MVP.
