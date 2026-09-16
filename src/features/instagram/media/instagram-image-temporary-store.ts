import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import {
  INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS,
  InstagramImageAcquisitionError,
} from "./instagram-image-acquisition.types";

const FILE_NAME = /^[a-f0-9]{48}\.img$/;
const SCOPE_NAME = /^scope-[a-f0-9]{64}$/;

export class InstagramImageTemporaryStore {
  constructor(
    private readonly root = join(
      tmpdir(),
      "creator-shop-instagram-image-acquisition-v1",
    ),
  ) {}

  async create(scopeIdentity: string): Promise<{
    path: string;
    handle: Awaited<ReturnType<typeof open>>;
  }> {
    const scope = await this.ensureScope(scopeIdentity);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const path = join(scope, `${randomBytes(24).toString("hex")}.img`);
      try {
        const handle = await open(path, "wx", 0o600);
        return { path, handle };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
        }
      }
    }
    throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
  }

  async remove(path: string): Promise<void> {
    const owned = await this.assertOwnedArtifactPath(path);
    await rm(owned, { force: true });
  }

  async purgeScope(scopeIdentity: string): Promise<number> {
    await this.ensureRoot();
    const scope = this.scopePath(scopeIdentity);
    return this.removeOwnedFiles(scope, () => true);
  }

  async cleanupStale(
    nowMs = Date.now(),
    maximumAgeMs = INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS,
  ): Promise<number> {
    if (
      !Number.isSafeInteger(maximumAgeMs) ||
      maximumAgeMs <= 0 ||
      maximumAgeMs > 24 * 60 * 60 * 1_000
    ) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    await this.ensureRoot();
    const entries = await readdir(this.root, { withFileTypes: true });
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !SCOPE_NAME.test(entry.name)) continue;
      removed += await this.removeOwnedFiles(join(this.root, entry.name), (s) =>
        Boolean(nowMs - s.mtimeMs >= maximumAgeMs),
      );
    }
    return removed;
  }

  getRootForDiagnostics(): string {
    return this.root;
  }

  private async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const rootStat = await lstat(this.root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    const actual = await realpath(this.root);
    if (resolve(actual) !== resolve(this.root)) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
  }

  private async ensureScope(scopeIdentity: string): Promise<string> {
    await this.ensureRoot();
    const scope = this.scopePath(scopeIdentity);
    await mkdir(scope, { recursive: true, mode: 0o700 });
    const scopeStat = await lstat(scope);
    if (!scopeStat.isDirectory() || scopeStat.isSymbolicLink()) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    const actual = await realpath(scope);
    if (resolve(actual) !== resolve(scope)) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    return scope;
  }

  private scopePath(scopeIdentity: string): string {
    if (!scopeIdentity.trim()) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    return join(
      this.root,
      `scope-${createHash("sha256").update(scopeIdentity).digest("hex")}`,
    );
  }

  private async assertOwnedArtifactPath(path: string): Promise<string> {
    await this.ensureRoot();
    const candidate = resolve(path);
    const root = resolve(this.root);
    if (
      !candidate.startsWith(`${root}${sep}`) ||
      !FILE_NAME.test(basename(candidate)) ||
      !SCOPE_NAME.test(basename(dirname(candidate))) ||
      dirname(dirname(candidate)) !== root
    ) {
      throw new InstagramImageAcquisitionError("TEMPORARY_STORAGE_FAILURE");
    }
    return candidate;
  }

  private async removeOwnedFiles(
    scope: string,
    predicate: (value: { mtimeMs: number }) => boolean,
  ): Promise<number> {
    try {
      const scopeStat = await lstat(scope);
      if (!scopeStat.isDirectory() || scopeStat.isSymbolicLink()) return 0;
      if (resolve(await realpath(scope)) !== resolve(scope)) return 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    let removed = 0;
    for (const entry of await readdir(scope, { withFileTypes: true })) {
      if (!FILE_NAME.test(entry.name)) continue;
      const candidate = join(scope, entry.name);
      const candidateStat = await lstat(candidate);
      if (candidateStat.isSymbolicLink()) {
        await rm(candidate, { force: true });
        removed += 1;
        continue;
      }
      if (!candidateStat.isFile() || !predicate(candidateStat)) continue;
      await rm(candidate, { force: true });
      removed += 1;
    }
    return removed;
  }
}
