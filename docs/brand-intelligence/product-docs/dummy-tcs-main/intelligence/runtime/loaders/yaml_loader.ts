import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export class RuntimeConfigError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "RuntimeConfigError"; }
}

export class SafeYamlLoader {
  constructor(private readonly repoRoot: string) {}

  private resolve(relativePath: string): string {
    if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
      throw new RuntimeConfigError("CONFIG_PATH_INVALID", `Unsafe config path: ${relativePath}`);
    }
    const root = path.resolve(this.repoRoot);
    const resolved = path.resolve(root, relativePath);
    if (!resolved.startsWith(root + path.sep)) throw new RuntimeConfigError("CONFIG_PATH_INVALID", "Config path escapes repository root");
    return resolved;
  }

  async load<T = unknown>(relativePath: string): Promise<T> {
    try {
      const text = await fs.readFile(this.resolve(relativePath), "utf8");
      return YAML.parse(text) as T;
    } catch (error) {
      if (error instanceof RuntimeConfigError) throw error;
      throw new RuntimeConfigError("CONFIG_LOAD_FAILED", `Failed to load ${relativePath}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}
