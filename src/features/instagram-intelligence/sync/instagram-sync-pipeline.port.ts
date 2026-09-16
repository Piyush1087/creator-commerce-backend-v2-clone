import type { InstagramSyncLease } from "./instagram-sync-coordinator.repository";

export type InstagramSyncPipelineResult = Readonly<{
  generationIds: readonly string[];
}>;

export abstract class InstagramSyncPipelinePort {
  abstract execute(
    lease: InstagramSyncLease,
  ): Promise<InstagramSyncPipelineResult>;
}
