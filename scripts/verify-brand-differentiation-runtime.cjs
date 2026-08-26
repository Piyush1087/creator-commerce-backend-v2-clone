/* Built-dist startup/registration smoke test: no DB or provider execution. */
require("reflect-metadata");
const assert = require("node:assert/strict");
const path = require("node:path");
const base = path.resolve(__dirname, "../dist/features/brand-intelligence");
const load = (file) => require(path.join(base, file));
const { ContractRuntimeRegistry } = load(
  "contracts/registry/contract-runtime.registry",
);
const { ContractBundleIntegrityVerifier } = load(
  "contracts/bundle/contract-bundle.integrity",
);
const { SemanticValidator } = load("contracts/validation/semantic.validator");
const { ProcessorExecutorRegistry } = load(
  "execution/executor/processor-executor.registry",
);
const { SyntheticProcessorExecutor } = load(
  "execution/executor/synthetic-processor.executor",
);
const { SYNTHETIC_PROCESSOR_ID } = load(
  "execution/domain/intelligence-execution.types",
);
const { BrandIntelligenceModule } = load("brand-intelligence.module");
const { ComponentPathCodec } = load("semantic-path/component-path.codec");
const { BundlePathOwnershipRegistry } = load(
  "contracts/registry/bundle-path-ownership.registry",
);
const { IntelligenceCurrentContractScopeService } = load(
  "projection/intelligence-current-contract-scope.service",
);
const { READ_ONLY_OBJECT_CONTRACTS } = load(
  "projection/current-read-contracts.generated",
);
const specs = [
  [
    "brand-communication",
    "BrandCommunicationProcessorExecutor",
    "brand_communication",
    "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
  ],
  [
    "brand-meaning",
    "BrandMeaningProcessorExecutor",
    "brand_meaning",
    "2e13fa40235094d127f72b38f43c510232e38be4",
  ],
  [
    "brand-character",
    "BrandCharacterProcessorExecutor",
    "brand_character",
    "56b52c1106feff2a92f23a7c49674fd116bf8c63",
  ],
  [
    "audience-persona",
    "AudiencePersonaProcessorExecutor",
    "audience_persona_synthesis",
    "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
  ],
  [
    "brand-differentiation",
    "BrandDifferentiationProcessorExecutor",
    "brand_differentiation",
    "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
  ],
];
const runtime = new ContractRuntimeRegistry(
  new ContractBundleIntegrityVerifier(),
  new SemanticValidator(),
);
runtime.onModuleInit();
assert.equal(
  runtime.isReady(),
  true,
  JSON.stringify(runtime.readinessFailure()),
);
const providers = Reflect.getMetadata("providers", BrandIntelligenceModule);
const instances = specs.map(([folder, name]) => {
  const Type = load(`processors/${folder}/${folder}-processor.executor`)[name];
  assert(providers.includes(Type), `${name} missing from production module`);
  return new Type(); // Inspect registration only; never execute unbound dependencies.
});
const executors = new ProcessorExecutorRegistry(
  new SyntheticProcessorExecutor(),
  ...instances,
);
const expected = specs.map((s) => s[2]).sort();
assert.deepEqual(
  runtime
    .registrations()
    .filter((r) => r.executionEnabled)
    .map((r) => r.processorId)
    .sort(),
  expected,
);
assert.deepEqual(
  executors
    .registeredProcessorIds()
    .filter((id) => id !== SYNTHETIC_PROCESSOR_ID)
    .sort(),
  expected,
);
for (const [, , processorId, pin] of specs) {
  const registration = runtime
    .registrations()
    .find((r) => r.processorId === processorId);
  assert(
    registration.bundled &&
      registration.registered &&
      registration.executionEnabled,
  );
  assert.equal(
    runtime.getVerifiedBundle(registration).manifest.architectureCommitSha,
    pin,
  );
}
assert(!executors.has("visual_style_synthesis"));
assert(!executors.has("serviceability_synthesis"));
const codec = new ComponentPathCodec();
const scope = new IntelligenceCurrentContractScopeService(
  runtime,
  new BundlePathOwnershipRegistry(runtime, codec),
  codec,
);
assert.deepEqual(
  scope.resolveObject("differentiation_and_proof").ownedPathPatterns,
  [
    ...READ_ONLY_OBJECT_CONTRACTS.find(
      (r) => r.objectSemanticId === "differentiation_and_proof",
    ).ownedPathPatterns,
  ].sort(),
);
console.log(
  "Built-dist startup READY; exactly five real executors/pins and frozen differentiation projection paths verified.",
);
