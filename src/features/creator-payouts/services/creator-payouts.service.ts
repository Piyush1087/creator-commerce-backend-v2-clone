import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CreatorBankVerificationStatus,
  EscrowTransactionType,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import { COLLABORATION_THREAD_INCLUDE } from "../../collaboration/services/collaboration-access.service";

const ACTIVE_ESCROW_STATUSES: CollaborationEscrowStatus[] = [
  CollaborationEscrowStatus.FUNDED,
  CollaborationEscrowStatus.PARTIAL_RELEASE,
];

const STAGE_LABELS: Record<string, string> = {
  STAGE_1_NEGOTIATION: "Negotiation",
  STAGE_2_SECUREMENT: "Securement / Awaiting escrow funding",
  STAGE_3_LOGISTICS: "Logistics / Product receipt",
  STAGE_4_CONTENT_REVIEW: "Content drafting / Awaiting brand review",
  STAGE_5_PUBLISHING: "Publishing / Link verification",
  STAGE_6_FEEDBACK_SYNC: "Feedback sync / Closing",
};

@Injectable()
export class CreatorPayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPayoutsHub(user: AuthUser) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
      include: {
        bankDetails: { where: { isPrimary: true }, take: 1 },
      },
    });

    const collaborations = await this.prisma.collaboration.findMany({
      where: {
        creatorUserId: user.id,
        isTerminated: false,
      },
      include: {
        ...COLLABORATION_THREAD_INCLUDE,
        escrowLock: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const collaborationIds = collaborations.map((row) => row.id);

    const ledgerRows =
      collaborationIds.length > 0
        ? await this.prisma.escrowTransactionLedger.findMany({
            where: {
              collaborationId: { in: collaborationIds },
              transactionType: {
                in: [
                  EscrowTransactionType.TRANCHE_ADVANCE_RELEASE,
                  EscrowTransactionType.TRANCHE_FINAL_RELEASE,
                ],
              },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
          })
        : [];

    let totalEscrowBalance = 0;
    let processingBalance = 0;
    let activeCampaignCount = 0;

    const escrowPipeline = collaborations
      .filter((row) => {
        const status = row.commercials?.escrowStatus;
        return status && ACTIVE_ESCROW_STATUSES.includes(status);
      })
      .map((row) => {
        const commercials = row.commercials;
        const totalQuote = decimalToNumber(commercials?.finalQuote ?? commercials?.initialQuote);
        const advance30 = decimalToNumber(commercials?.advance30Amount);
        const balance70 = decimalToNumber(commercials?.balance70Amount);
        const escrowStatus = commercials?.escrowStatus ?? null;

        if (escrowStatus === CollaborationEscrowStatus.FUNDED) {
          totalEscrowBalance += totalQuote;
          activeCampaignCount += 1;
        } else if (escrowStatus === CollaborationEscrowStatus.PARTIAL_RELEASE) {
          totalEscrowBalance += balance70;
          processingBalance += advance30;
          activeCampaignCount += 1;
        }

        const stageLabel = STAGE_LABELS[row.currentStage] ?? row.currentStage;
        const grossQuote = totalQuote;
        const platformFee = decimalToNumber(row.escrowLock?.platformCommissionFee);
        const netPool = decimalToNumber(
          row.escrowLock?.netCreatorPayoutPool ?? commercials?.finalQuote,
        );

        return {
          collaboration_id: row.id,
          brand_name: row.brandProfile.name,
          campaign_name: row.campaign.name,
          amount_locked:
            escrowStatus === CollaborationEscrowStatus.PARTIAL_RELEASE
              ? balance70
              : totalQuote,
          milestone_status: stageLabel,
          escrow_status: escrowStatus,
          fee_breakdown: {
            gross_quote: grossQuote,
            platform_fee: platformFee,
            net_payout: netPool,
          },
        };
      });

    type ClearedRow = {
      cleared_at: string;
      collaboration_id: string;
      brand_name: string;
      campaign_name: string;
      net_payout: number;
      status: string;
      transaction_id: string | null;
      tranche: string | null;
      fee_breakdown: {
        gross_quote: number;
        platform_fee: number;
        net_payout: number;
      };
    };

    const clearedFromLedger: ClearedRow[] = ledgerRows.map((entry) => {
      const collab = collaborations.find((row) => row.id === entry.collaborationId);
      const gross = decimalToNumber(
        collab?.commercials?.finalQuote ?? collab?.commercials?.initialQuote,
      );
      const platformFee = decimalToNumber(collab?.escrowLock?.platformCommissionFee);
      const net = decimalToNumber(entry.amount);
      return {
        cleared_at: entry.createdAt.toISOString(),
        collaboration_id: entry.collaborationId ?? "",
        brand_name: collab?.brandProfile.name ?? "-",
        campaign_name: collab?.campaign.name ?? "-",
        net_payout: net,
        status: String(entry.transactionStatus),
        transaction_id: entry.id,
        tranche: entry.payoutTrancheTarget ? String(entry.payoutTrancheTarget) : null,
        fee_breakdown: {
          gross_quote: gross,
          platform_fee: platformFee,
          net_payout: net,
        },
      };
    });

    const clearedFromHistory: ClearedRow[] = collaborations
      .filter((row) => row.commercials?.escrowStatus === CollaborationEscrowStatus.SETTLED)
      .map((row) => {
        const gross = decimalToNumber(
          row.commercials?.finalQuote ?? row.commercials?.initialQuote,
        );
        const platformFee = decimalToNumber(row.escrowLock?.platformCommissionFee);
        const net = gross;
        return {
          cleared_at: row.updatedAt.toISOString(),
          collaboration_id: row.id,
          brand_name: row.brandProfile.name,
          campaign_name: row.campaign.name,
          net_payout: net,
          status: "SETTLED",
          transaction_id: null,
          tranche: null,
          fee_breakdown: {
            gross_quote: gross,
            platform_fee: platformFee,
            net_payout: net,
          },
        };
      });

    const clearedMap = new Map<string, ClearedRow>();
    for (const row of [...clearedFromLedger, ...clearedFromHistory]) {
      const key = row.transaction_id ?? `${row.collaboration_id}-${row.cleared_at}`;
      if (!clearedMap.has(key)) {
        clearedMap.set(key, row);
      }
    }
    const clearedPayouts = [...clearedMap.values()].sort(
      (a, b) => new Date(b.cleared_at).getTime() - new Date(a.cleared_at).getTime(),
    );

    const lifetimeCleared = clearedPayouts.reduce(
      (sum, row) => sum + row.net_payout,
      0,
    );

    const primaryBank = profile?.bankDetails[0] ?? null;
    const bankMethod = this.resolveBankMethod(primaryBank);

    const createdYear = profile?.createdAt
      ? new Date(profile.createdAt).getFullYear()
      : new Date().getFullYear();

    const nextPayoutDate = this.estimateNextPayoutDate(processingBalance);

    return {
      summary: {
        currency: "INR",
        total_escrow_balance: totalEscrowBalance,
        processing_balance: processingBalance,
        lifetime_cleared_balance: lifetimeCleared,
        active_campaign_count: activeCampaignCount,
        next_payout_date: nextPayoutDate,
        account_creation_year: createdYear,
      },
      bank_method: bankMethod,
      escrow_pipeline: escrowPipeline,
      cleared_payouts: clearedPayouts,
      counts: {
        escrow_pipeline: escrowPipeline.length,
        cleared_payouts: clearedPayouts.length,
      },
    };
  }

  private resolveBankMethod(
    bank: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      isPrimary: boolean;
      verificationStatus: CreatorBankVerificationStatus;
    } | null,
  ) {
    if (!bank) {
      return {
        status: "none" as const,
        bank_name: null,
        account_last_4: null,
        account_holder: null,
      };
    }

    const digits = bank.accountNumber.replace(/\D/g, "");
    const last4 = digits.length >= 4 ? digits.slice(-4) : null;

    if (bank.verificationStatus === CreatorBankVerificationStatus.SUSPENDED) {
      return {
        status: "suspended" as const,
        bank_name: bank.bankName,
        account_last_4: last4,
        account_holder: bank.accountHolder,
      };
    }

    return {
      status: "verified" as const,
      bank_name: bank.bankName,
      account_last_4: last4,
      account_holder: bank.accountHolder,
    };
  }

  private estimateNextPayoutDate(processingBalance: number): string | null {
    if (processingBalance <= 0) {
      return null;
    }
    const eta = new Date();
    eta.setDate(eta.getDate() + 3);
    return eta.toISOString().slice(0, 10);
  }

  private assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }
}
