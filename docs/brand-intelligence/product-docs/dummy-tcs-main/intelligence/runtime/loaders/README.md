# Runtime Loaders + Model Registry Resolver

P0 #1 status: IMPLEMENTED AS REFERENCE RUNTIME CODE.

## What this closes

The Intelligence runtime can now resolve repository-owned configuration without letting request input choose arbitrary repository paths:

- `identity_test` Execution Profile
- Identity processor definitions
- active Intelligence Object definitions
- minimal global LLM artifacts
- processor reasoning/output contracts
- Model Registry processor/scope bindings
- model profile → alias → provider → concrete model ID → effective runtime

## Files

- `yaml_loader.ts` — safe server-side YAML loader constrained to repository root.
- `identity_repository_loader.ts` — Identity allow-listed definition/artifact/profile loader.
- `../models/resolver.ts` — Model Registry resolver.

## Security/reliability boundary

Runtime requests provide semantic IDs (`identity_test`, `identity_core`, etc.), never filesystem paths. Identity paths are allow-listed in code. Missing definitions/artifacts fail precheck rather than falling back to guessed files.

Provider credentials are **not loaded by the Model Registry resolver**. It returns the configured `credential_ref` (`env.GEMINI_API_KEY`); the existing backend Gemini integration resolves the actual secret.

## Developer binding

The backend should instantiate these with its repository/config root and environment, then expose them through the integration ports:

```ts
const yaml = new SafeYamlLoader(process.cwd());
const repo = new IdentityRepositoryLoader(yaml);
const models = new ModelRegistryResolver(yaml, environment);

profiles.load = id => repo.loadExecutionProfile(id);
definitions.loadProcessor = (id, scope) => repo.loadProcessor(id, scope);
definitions.loadGlobalArtifacts = () => repo.loadGlobalArtifacts();
definitions.loadProcessorArtifacts = (id, scope) => repo.loadProcessorArtifacts(id, scope);
definitions.loadObjects = outputs => repo.loadObjects(outputs);
modelRuntime.resolve = (id, scope) => models.resolve(id, scope);
```

## One integration check for developer

The loader contains explicit expected paths for the frozen artifacts. If the actual repository artifact filenames differ, update only the allow-list/path mapping—not processor logic or the Compiler. This is a wiring correction.

## P0 status after this step

1. Loaders + Model Registry resolver — CLOSED (reference implementation; developer binds to app runtime)
2. Zyte/Cheerio EvidenceRuntime — DEVELOPER_BINDING_REQUIRED; existing backend implementation
3. Gemini provider — DEVELOPER_BINDING_REQUIRED; existing backend implementation
4. Prompt Builder binding — NEXT
5. Validator binding — pending
6. Telemetry adapter — pending
7. Developer test entry point — pending
