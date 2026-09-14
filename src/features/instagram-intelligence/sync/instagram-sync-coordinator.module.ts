import { Module } from "@nestjs/common";

import { InstagramSyncCoordinatorRepository } from "./instagram-sync-coordinator.repository";

/** One owner-neutral Instagram scheduler repository shared by Brand and Creator. */
@Module({
  providers: [InstagramSyncCoordinatorRepository],
  exports: [InstagramSyncCoordinatorRepository],
})
export class InstagramSyncCoordinatorModule {}
