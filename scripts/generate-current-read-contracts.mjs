import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { format, resolveConfig } from "prettier";

const pin = "a6bed1f28564c002f7d76931de0b4dd960ea5ae1";
const arg = process.argv.indexOf("--source");
if (arg < 0 || !process.argv[arg + 1])
  throw new Error("--source authority checkout required");
const source = resolve(process.argv[arg + 1]);
const specs = [
  ["brand_expression", "brand_differentiation", "differentiation_and_proof"],
  ["audience", "audience_persona_synthesis", "audience_personas"],
  ["visual_identity", "visual_style_synthesis", "visual_style_profile"],
  ["serviceability", "serviceability_synthesis", "serviceability_profile"],
];
const entries = specs.map(([branch, processor, object]) => {
  const path = `intelligence/engines/brand_intelligence/branches/${branch}/artifacts/${processor}/output_contract.yaml`;
  const bytes = execFileSync("git", ["-C", source, "show", `${pin}:${path}`]);
  const contract = parse(bytes.toString("utf8"));
  if (
    contract.status !== "FROZEN" ||
    contract.object !== object ||
    contract.version !== "1.0"
  )
    throw new Error("Unfrozen or mismatched current-read authority");
  const paths = new Set();
  function visit(schema, currentPath) {
    if (typeof schema === "string") schema = contract[schema];
    if (!schema || typeof schema !== "object") return;
    paths.add(currentPath);
    const fields = schema.fields ?? schema.properties;
    for (const [field, value] of Object.entries(fields ?? {})) {
      if (field !== "semantic_id") visit(value, `${currentPath}/f/${field}`);
    }
    let item = schema.item;
    if (typeof item === "string") item = contract[item];
    if (item?.fields?.semantic_id)
      visit(item, `${currentPath}/i/{semantic_id}`);
  }
  visit(contract.response.properties[object], "$");
  return {
    objectSemanticId: object,
    outputContractId: contract.id,
    outputContractVersion: contract.version,
    ownedPathPatterns: [...paths].sort(),
    requiredMaterializedPaths: ["$"],
    authorityPath: path,
    authoritySha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
const target = resolve(
  "src/features/brand-intelligence/projection/current-read-contracts.generated.ts",
);
const result = await format(
  `// GENERATED from frozen current-read authority. No processor execution registration.\nexport const CURRENT_READ_AUTHORITY = ${JSON.stringify(pin)};\nexport const READ_ONLY_OBJECT_CONTRACTS = ${JSON.stringify(entries, null, 2)} as const;\n`,
  { ...(await resolveConfig(target)), parser: "typescript", endOfLine: "lf" },
);
if (process.argv.includes("--verify")) {
  if (readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== result)
    throw new Error("CURRENT_READ_CONTRACT_DRIFT");
} else writeFileSync(target, result);
console.log(
  `Verified four read-only Object contracts at ${pin}; executable registry untouched.`,
);
