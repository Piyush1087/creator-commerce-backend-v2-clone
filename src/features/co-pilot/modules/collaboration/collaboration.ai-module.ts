import { Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";

import type { AuthUser } from "../../../auth/types/auth-user";
import type {
  CoPilotAiModule,
  CoPilotModuleReadContext,
  CoPilotModuleReadResult,
} from "../../core/ai-module.contract";
import type { ReadQueryKind } from "../../core/read-kind.types";
import type { DetectedWriteIntent, WriteIntentKind } from "../../core/write-intent.types";
import { CollaborationCoPilotToolsService } from "../../tools/collaboration.tools";

const READ_KINDS: ReadQueryKind[] = ["COLLAB_PIPELINE", "COLLAB_ISSUES"];

@Injectable()
export class CollaborationAiModule implements CoPilotAiModule {
  readonly id = "collaboration";
  readonly name = "Collaboration";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents: readonly WriteIntentKind[] = [];

  constructor(private readonly collabTools: CollaborationCoPilotToolsService) {}

  detectRead(userText: string, _scope: CoPilotScopeContext): ReadQueryKind | null {
    const n = userText.toLowerCase();
    if (
      n.includes("collaboration") ||
      n.includes("collab") ||
      n.includes("logistics") ||
      n.includes("production stage") ||
      n.includes("fulfillment issue")
    ) {
      if (
        n.includes("issue") ||
        n.includes("rejection") ||
        n.includes("fulfillment")
      ) {
        return "COLLAB_ISSUES";
      }
      return "COLLAB_PIPELINE";
    }
    return null;
  }

  detectWrite(): DetectedWriteIntent | null {
    return null;
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (kind !== "COLLAB_PIPELINE" && kind !== "COLLAB_ISSUES") {
      return null;
    }
    const authUser = ctx.authUser as AuthUser | undefined;
    if (!authUser) {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "I couldn’t load collaborations without an authenticated brand session.",
      };
    }

    const collabCtx = await this.collabTools.getCollabReadContext(authUser);
    const table = this.collabTools.buildCollabTable(collabCtx);
    return {
      formatType: "TABULAR_AUDIT_DATA",
      narrativeText:
        kind === "COLLAB_ISSUES"
          ? `${collabCtx.withFulfillmentIssues} collaboration(s) with fulfillment issues; ${collabCtx.stuckLogistics} in Logistics, ${collabCtx.stuckProduction} in Production.`
          : `${collabCtx.totalActive} active collaboration(s). Pipeline snapshot below (read-only).`,
      tableData: table,
      toolsInvoked: ["collab.getCollabReadContext"],
    };
  }
}
