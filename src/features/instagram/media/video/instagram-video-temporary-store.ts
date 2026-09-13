import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { InstagramVideoError } from "./instagram-video.types";

const SCOPE_NAME = /^scope-[a-f0-9]{64}$/;
const ARTIFACT_NAME = /^[a-f0-9]{48}\.(?:video|jpg)$/;

export class InstagramVideoTemporaryStore {
  constructor(
    private readonly root = join(
      tmpdir(),
      "creator-shop-instagram-video-acquisition-v1",
    ),
  ) {}

  async createVideo(scopeIdentity: string) {
    return this.create(scopeIdentity, "video");
  }

  async createFrame(scopeIdentity: string) {
    return this.create(scopeIdentity, "jpg");
  }

  async remove(path: string): Promise<void> {
    await rm(await this.assertOwnedPath(path), { force: true });
  }

  async purgeScope(scopeIdentity: string): Promise<number> {
    await this.ensureRoot();
    const scope = this.scopePath(scopeIdentity);
    try {
      const info = await lstat(scope);
      if (!info.isDirectory() || info.isSymbolicLink()) return 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    let removed = 0;
    for (const entry of await readdir(scope, { withFileTypes: true })) {
      if (!entry.isFile() || !ARTIFACT_NAME.test(entry.name)) continue;
      await rm(join(scope, entry.name), { force: true });
      removed += 1;
    }
    return removed;
  }

  getRootForDiagnostics(): string {
    return this.root;
  }

  private async create(scopeIdentity: string, extension: "video" | "jpg") {
    const scope = await this.ensureScope(scopeIdentity);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const path = join(
        scope,
        `${randomBytes(24).toString("hex")}.${extension}`,
      );
      try {
        return { path, handle: await open(path, "wx", 0o600) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") break;
      }
    }
    throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
  }

  private async ensureRoot() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    }
    if (resolve(await realpath(this.root)) !== resolve(this.root)) {
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    }
  }

  private async ensureScope(scopeIdentity: string) {
    await this.ensureRoot();
    const scope = this.scopePath(scopeIdentity);
    await mkdir(scope, { recursive: true, mode: 0o700 });
    const info = await lstat(scope);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    }
    if (resolve(await realpath(scope)) !== resolve(scope)) {
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    }
    return scope;
  }

  private scopePath(scopeIdentity: string) {
    if (!scopeIdentity.trim())
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    return join(
      this.root,
      `scope-${createHash("sha256").update(scopeIdentity).digest("hex")}`,
    );
  }

  private async assertOwnedPath(path: string) {
    await this.ensureRoot();
    const candidate = resolve(path);
    const root = resolve(this.root);
    if (
      !candidate.startsWith(`${root}${sep}`) ||
      !ARTIFACT_NAME.test(basename(candidate)) ||
      !SCOPE_NAME.test(basename(dirname(candidate))) ||
      dirname(dirname(candidate)) !== root
    ) {
      throw new InstagramVideoError("TEMPORARY_STORAGE_FAILURE");
    }
    return candidate;
  }
}
