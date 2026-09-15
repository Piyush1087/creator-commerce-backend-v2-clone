import type { Prisma } from "@prisma/client";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { z } from "zod";
import type {
  WorkPreferencesMutationSchema,
  WorkPreferencesValues,
} from "../contracts/work-preferences.contract";
export const WORK_PREFERENCES_RATE_CARD_PORT = Symbol(
  "WORK_PREFERENCES_RATE_CARD_PORT",
);
/** Optional until the separate P2 aggregate exists. Same transaction, no owner duplication. */
export interface WorkPreferencesRateCardPort {
  reconcileInTransaction(
    tx: Prisma.TransactionClient,
    actor: CreatorWorkspaceActorContext,
    input: {
      command: z.infer<typeof WorkPreferencesMutationSchema>;
      previous: {
        reference: string;
        revision: number;
        values: WorkPreferencesValues;
      } | null;
      next: {
        reference: string;
        revision: number;
        values: WorkPreferencesValues;
      };
    },
  ): Promise<void>;
}
