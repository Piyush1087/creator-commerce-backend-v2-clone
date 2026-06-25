import { Injectable } from "@nestjs/common";

import { BrandEscrowService } from "../../brand-escrow/services/brand-escrow.service";
import type { DataTableData } from "../schemas/copilot-payload.schema";
import type { MetricItem } from "../schemas/copilot-payload.schema";

@Injectable()
export class EscrowCoPilotToolsService {
  constructor(private readonly escrow: BrandEscrowService) {}

  async getEscrowReadContext(brandProfileId: string) {
    try {
      const vault = await this.escrow.getVault(brandProfileId);
      const ledger = await this.escrow.listLedger(brandProfileId, 20);
      return {
        available: true,
        vault,
        ledger,
      };
    } catch {
      return {
        available: false,
        unavailableReason: "Escrow vault not initialized for this brand.",
        vault: null,
        ledger: [],
      };
    }
  }

  buildVaultMetrics(context: Awaited<ReturnType<typeof this.getEscrowReadContext>>): MetricItem[] {
    if (!context.available || !context.vault) {
      return [
        {
          label: "Escrow vault",
          value: "Not initialized",
          statusColor: "YELLOW",
        },
      ];
    }

    const v = context.vault;
    return [
      {
        label: "Available balance",
        value: `${v.currency} ${Number(v.available_balance).toLocaleString()}`,
        statusColor: Number(v.available_balance) > 0 ? "GREEN" : "YELLOW",
      },
      {
        label: "Locked campaign funds",
        value: `${v.currency} ${Number(v.locked_campaign_funds).toLocaleString()}`,
        statusColor: "NEUTRAL",
      },
      {
        label: "TDS buffer",
        value: `${v.currency} ${Number(v.tds_buffer_balance).toLocaleString()}`,
        statusColor: "NEUTRAL",
      },
      {
        label: "Total pooled",
        value: `${v.currency} ${Number(v.total_pooled_balance).toLocaleString()}`,
        statusColor: "GREEN",
      },
    ];
  }

  buildLedgerTable(context: Awaited<ReturnType<typeof this.getEscrowReadContext>>): DataTableData {
    if (!context.available || context.ledger.length === 0) {
      return {
        headers: ["Status", "Detail"],
        rows: [{ Status: "—", Detail: context.unavailableReason ?? "No ledger entries" }],
      };
    }

    return {
      headers: ["Type", "Amount", "Status", "Reference", "Date"],
      rows: context.ledger.slice(0, 15).map((row) => ({
        Type: String(row.transaction_type),
        Amount: `${row.currency} ${Number(row.amount).toLocaleString()}`,
        Status: String(row.transaction_status),
        Reference: String(row.gateway_reference_id ?? row.transaction_id).slice(0, 12),
        Date: new Date(String(row.created_at)).toLocaleDateString(),
      })),
    };
  }
}
