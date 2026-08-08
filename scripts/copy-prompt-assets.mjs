/**
 * Copy human-editable prompt markdown into dist/ next to compiled loaders.
 * Nest `compilerOptions.assets` globs have missed `*.prompt.md` (and sometimes
 * surface templates) in Docker/CI — this step is the source of truth for deploy.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  ["src/features/brand-onboarding/prompts", "dist/features/brand-onboarding/prompts"],
  ["src/features/brand-centre/prompts", "dist/features/brand-centre/prompts"],
  ["src/features/creator-onboarding/prompts", "dist/features/creator-onboarding/prompts"],
  [
    "src/features/brand-intelligence/metadata",
    "dist/features/brand-intelligence/metadata",
  ],
];

const required = [
  // Brand onboarding (Stage 1A/1B / DNA / gatekeeper)
  "dist/features/brand-onboarding/prompts/mcp-planner.prompt.md",
  "dist/features/brand-onboarding/prompts/surface/brand_dna/developer.md",
  "dist/features/brand-onboarding/prompts/gatekeeper.prompt.md",
  "dist/features/brand-onboarding/prompts/surface-scan-synthesis.prompt.md",
  // Brand Centre workers (deep scan / intelligence / planner aggregate)
  "dist/features/brand-centre/prompts/deep-scan-strategy.prompt.md",
  "dist/features/brand-centre/prompts/intelligence-leaks.prompt.md",
  "dist/features/brand-centre/prompts/planner-aggregator.prompt.md",
  "dist/features/brand-centre/prompts/contracts/deep-scan-prompt1.contract.md",
  // Creator onboarding AI
  "dist/features/creator-onboarding/prompts/welcome-insight.prompt.md",
  "dist/features/creator-onboarding/prompts/handle-eligibility.prompt.md",
  // Brand Intelligence identity_test metadata
  "dist/features/brand-intelligence/metadata/execution_profiles/identity_test.yaml",
  "dist/features/brand-intelligence/metadata/models.yaml",
  "dist/features/brand-intelligence/metadata/engines/brand_intelligence/branches/identity/objects.yaml",
];

for (const [fromRel, toRel] of pairs) {
  const from = join(root, fromRel);
  const to = join(root, toRel);
  if (!existsSync(from)) {
    throw new Error(`copy-prompt-assets: missing source ${fromRel}`);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
  console.log(`copy-prompt-assets: ${fromRel} → ${toRel}`);
}

for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    throw new Error(`copy-prompt-assets: required file missing after copy: ${rel}`);
  }
}

console.log("copy-prompt-assets: ok");
