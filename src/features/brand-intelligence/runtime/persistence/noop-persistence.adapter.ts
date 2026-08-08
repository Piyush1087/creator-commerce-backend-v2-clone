import { Injectable } from "@nestjs/common";

import type { ExecutionTask } from "../compiler/compiler";
import type { PersistencePort } from "../integration/types";

/**
 * identity_test dry-run persistence: never writes BrandProfile.
 */
@Injectable()
export class NoopPersistenceAdapter implements PersistencePort {
  async persist(args: {
    task: ExecutionTask;
    entityId: string;
    values: Record<string, unknown>;
    persistResults: boolean;
  }): Promise<void> {
    if (args.persistResults) {
      throw new Error(
        "Canonical persistence is disabled for identity_test dry-run",
      );
    }
  }
}
