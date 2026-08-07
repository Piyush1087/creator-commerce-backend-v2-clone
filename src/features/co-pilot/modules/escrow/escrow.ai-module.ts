import { Injectable } from "@nestjs/common";
import { CoPilotScopeContext } from "@prisma/client";

import type {
  CoPilotAiModule,
  CoPilotModuleReadContext,
  CoPilotModuleReadResult,
} from "../../core/ai-module.contract";
import type { ReadQueryKind } from "../../core/read-kind.types";
import type { DetectedWriteIntent, WriteIntentKind } from "../../core/write-intent.types";
import { EscrowCoPilotToolsService } from "../../tools/escrow.tools";
import { presentDetailRead } from "../../utils/co-pilot-presentation.util";

const READ_KINDS: ReadQueryKind[] = [
  "ESCROW_AUDIT",
  "ESCROW_TDS",
  "ESCROW_SETUP",
];

@Injectable()
export class EscrowAiModule implements CoPilotAiModule {
  readonly id = "escrow";
  readonly name = "Escrow";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents: readonly WriteIntentKind[] = [];

  constructor(private readonly escrowTools: EscrowCoPilotToolsService) {}

  detectRead(userText: string, scopeContext: CoPilotScopeContext): ReadQueryKind | null {
    const n = userText.toLowerCase();
    if (
      n.includes("collaboration") ||
      n.includes("collab") ||
      n.includes("counter") ||
      n.includes("dispatch") ||
      n.includes("content review")
    ) {
      return null;
    }
    if (
      n.includes("enable escrow") ||
      n.includes("set up escrow") ||
      n.includes("setup escrow") ||
      (n.includes("escrow") && (n.includes("not set") || n.includes("vault")))
    ) {
      if (
        n.includes("how") ||
        n.includes("enable") ||
        n.includes("set up") ||
        n.includes("setup")
      ) {
        return "ESCROW_SETUP";
      }
    }

    if (
      scopeContext === CoPilotScopeContext.ESCROW ||
      n.includes("escrow") ||
      n.includes("ledger") ||
      n.includes("financial audit")
    ) {
      if (n.includes("tds") || n.includes("tax buffer")) {
        return "ESCROW_TDS";
      }
      return "ESCROW_AUDIT";
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
    if (kind === "ESCROW_SETUP") {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "Your escrow vault isn’t active yet, so I can’t show balances or ledger entries here. To get started, open Settings → Billing (/brand/settings/billing) to confirm your plan and billing setup, then go to Settings → Escrow (/brand/settings/escrow) to enable the vault and add funds. After that, ask me for an escrow audit or ledger report and I’ll pull read-only data. I can’t enable the vault from chat.",
        toolsInvoked: ["escrow.setupGuidance"],
      };
    }

    if (kind === "ESCROW_AUDIT" || kind === "ESCROW_TDS") {
      const escrowCtx = await this.escrowTools.getEscrowReadContext(
        ctx.brandProfileId,
      );
      const metrics = this.escrowTools.buildVaultMetrics(escrowCtx);
      const table = this.escrowTools.buildLedgerTable(escrowCtx);
      const tds =
        escrowCtx.available && escrowCtx.vault
          ? `${escrowCtx.vault.currency} ${Number(escrowCtx.vault.tds_buffer_balance).toLocaleString()}`
          : "Vault not initialized";

      if (kind === "ESCROW_TDS") {
        return {
          ...presentDetailRead({
            userText: ctx.userText,
            narrativeText: `Your TDS tax buffer balance is ${tds}.`,
            metricGridData: metrics,
            toolsInvoked: ["escrow.getEscrowReadContext"],
          }),
        };
      }

      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText:
          "Here’s a read-only escrow vault summary and recent ledger entries.",
        metricGridData: metrics,
        tableData: table,
        toolsInvoked: ["escrow.getEscrowReadContext"],
      };
    }

    return null;
  }
}
