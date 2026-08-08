import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve executable Identity metadata for both `nest start` (src) and
 * compiled `dist/` deployments.
 */
export function resolveBrandIntelligenceMetadataRoot(): string {
  const candidates = [
    join(__dirname, "metadata"),
    join(__dirname, "..", "metadata"),
    join(process.cwd(), "src/features/brand-intelligence/metadata"),
    join(process.cwd(), "dist/features/brand-intelligence/metadata"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Brand Intelligence metadata root not found. Ensure metadata YAML assets are copied into dist.",
  );
}
