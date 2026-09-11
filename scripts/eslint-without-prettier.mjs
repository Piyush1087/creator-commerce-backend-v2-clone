import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const eslintBin = path.join(root, "node_modules", "eslint", "bin", "eslint.js");

const result = spawnSync(
  process.execPath,
  [eslintBin, "{src,test}/**/*.ts"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ESLINT_WITHOUT_PRETTIER: "1" },
  },
);

process.exit(result.status ?? 1);
